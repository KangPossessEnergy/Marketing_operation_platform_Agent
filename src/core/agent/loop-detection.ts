import { createHash } from 'node:crypto'; // Node 内置加密模块，用于生成参数/结果的 SHA-256 指纹

// 一条工具调用记录：存哈希指纹而非原始参数/结果，省内存且便于比较
export interface ToolCallRecord {
  toolName: string;
  argsHash: string;        // 工具名 + 参数的指纹，由 hashToolCall 生成
  resultHash?: string;     // 结果的指纹，调用返回后由 recordResult 补录
  timestamp: number;       // 调用时间戳（毫秒）
}

// 三种检测器：通用重复 / A-B 交替（乒乓）/ 无进展熔断
export type DetectorKind = 'generic_repeat' | 'ping_pong' | 'global_circuit_breaker';

// 检测结果：未卡住，或卡住并给出级别（warning 提醒模型 / critical 强制停止）
export type DetectionResult =
  | { stuck: false }
  | { stuck: true; level: 'warning' | 'critical'; detector: DetectorKind; count: number; message: string };

const HISTORY_SIZE = 30;      // 滑动窗口大小：只保留最近 30 条调用记录
const WARNING_THRESHOLD = 5;  // 警告阈值：注入系统提醒，让模型换策略（演示用，生产环境通常 10）
const CRITICAL_THRESHOLD = 8; // 严重阈值：阻断工具调用，强制停止循环（演示用，生产环境通常 20）
const BREAKER_THRESHOLD = 10; // 熔断阈值：无论如何强制停止（演示用，生产环境通常 30）

// 稳定序列化：对象属性按键排序后再序列化，保证等价对象得到相同哈希（不处理循环引用等边界情况）
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(',')}}`;
}

// 计算字符串的 SHA-256 并取前 16 位作为短指纹，兼顾唯一性与可读性
function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// 生成调用指纹：工具名 + 参数哈希，任一不同则指纹不同
export function hashToolCall(toolName: string, params: unknown): string {
  return `${toolName}:${hash(stableStringify(params))}`;
}

// 生成结果指纹：用于判断同一调用是否反复返回相同结果
export function hashResult(result: unknown): string {
  return hash(stableStringify(result));
}

// 全局历史队列：按调用顺序保存记录，作为所有检测器的数据源
const history: ToolCallRecord[] = [];

// 记录一次工具调用（调用发生时先记参数指纹）；队列超长时移除最旧记录，维持滑动窗口
export function recordCall(toolName: string, params: unknown): void {
  history.push({
    toolName,
    argsHash: hashToolCall(toolName, params),
    timestamp: Date.now(),
  });
  if (history.length > HISTORY_SIZE) history.shift();
}

// 调用返回后补录结果指纹：从后往前找第一个工具名、参数指纹都相同且还没记录结果的槽位
export function recordResult(toolName: string, params: unknown, result: unknown): void {
  const argsHash = hashToolCall(toolName, params);
  const resultH = hashResult(result);
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].toolName === toolName && history[i].argsHash === argsHash && !history[i].resultHash) {
      history[i].resultHash = resultH;
      break;
    }
  }
}

// 清空全部调用历史：开始新会话时调用，避免上一次会话的记录干扰本次检测
export function resetHistory(): void {
  history.length = 0;
}

// 计算"无进展"连续次数：同一调用从最近往回数，结果指纹一直相同的次数；结果一变说明有进展，停止计数
function getNoProgressStreak(toolName: string, argsHash: string): number {
  let streak = 0;
  let lastResultHash: string | undefined;

  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i];
    // 只关心同一工具、相同参数的调用
    if (r.toolName !== toolName || r.argsHash !== argsHash) continue;
    // 还没返回结果的记录无法判断进展，跳过但不打断连续性
    if (!r.resultHash) continue;
    if (!lastResultHash) {
      // 第一次命中：以该结果指纹作为基准
      lastResultHash = r.resultHash;
      streak = 1;
      continue;
    }
    // 结果与基准不同：出现过新进展，连续无中断，停止计数
    if (r.resultHash !== lastResultHash) break;
    streak++;
  }
  return streak;
}

// 检测 A-B 乒乓循环：从末尾往前验证历史是否严格交替；currentHash 是即将发起的调用，若正好接上交替则计入
function getPingPongCount(currentHash: string): number {
  if (history.length < 3) return 0; // 不足 3 条不可能形成 A-B-A 交替

  const last = history[history.length - 1];
  let otherHash: string | undefined;

  // 从倒数第二条往前找第一个与 last 不同的指纹，作为交替的"另一方"
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].argsHash !== last.argsHash) {
      otherHash = history[i].argsHash;
      break;
    }
  }
  if (!otherHash) return 0; // 窗口内全是同一调用，是普通重复而非乒乓

  // 从末尾往前校验严格交替：偶数位应为 last，奇数位应为 otherHash，不符即停
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const expected = count % 2 === 0 ? last.argsHash : otherHash;
    if (history[i].argsHash !== expected) break;
    count++;
  }

  // 本次调用恰好接上另一方，且历史已至少交替一次，则把本次计入
  if (currentHash === otherHash && count >= 2) return count + 1;
  return 0;
}

// 对即将发起的工具调用做循环检测，按严重程度依次判断：无进展熔断 > 乒乓 > 通用重复
export function detect(toolName: string, params: unknown): DetectionResult {
  const argsHash = hashToolCall(toolName, params);

  // 1. 无进展熔断：同一调用反复返回相同结果，agent 在原地踏步，最严重
  const noProgress = getNoProgressStreak(toolName, argsHash);
  if (noProgress >= BREAKER_THRESHOLD) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'global_circuit_breaker',
      count: noProgress,
      message: `[熔断] ${toolName} 已重复 ${noProgress} 次且无进展，强制停止`,
    };
  }

  // 2. 乒乓循环：A-B-A-B 交替调用，常见于两类工具互相拉扯
  const pingPong = getPingPongCount(argsHash);
  if (pingPong >= CRITICAL_THRESHOLD) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'ping_pong',
      count: pingPong,
      message: `[熔断] 检测到乒乓循环（${pingPong} 次交替），强制停止`,
    };
  }
  if (pingPong >= WARNING_THRESHOLD) {
    return {
      stuck: true,
      level: 'warning',
      detector: 'ping_pong',
      count: pingPong,
      message: `[警告] 检测到乒乓循环（${pingPong} 次交替），建议换个思路`,
    };
  }

  // 3. 通用重复：同一工具、相同参数在窗口内出现多次
  const recentCount = history.filter(h => h.toolName === toolName && h.argsHash === argsHash).length;
  if (recentCount >= CRITICAL_THRESHOLD) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'generic_repeat',
      count: recentCount,
      message: `[熔断] ${toolName} 相同参数已调用 ${recentCount} 次，强制停止`,
    };
  }
  if (recentCount >= WARNING_THRESHOLD) {
    return {
      stuck: true,
      level: 'warning',
      detector: 'generic_repeat',
      count: recentCount,
      message: `[警告] ${toolName} 相同参数已调用 ${recentCount} 次，你可能陷入了重复`,
    };
  }

  return { stuck: false }; // 未命中任何阈值，正常放行
}
