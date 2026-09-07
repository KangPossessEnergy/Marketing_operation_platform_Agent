// 判断错误是否值得重试：限流/5xx/网络抖动等临时错误返回 true，4xx 等请求本身有问题的错误返回 false
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message || '';

  // 从错误信息中提取 HTTP 状态码：429/408/529 和 5xx 可重试，4xx 重试无意义
  const statusMatch = message.match(/(\d{3})/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1]);
    if ([429, 529, 408].includes(status)) return true;
    if (status >= 500 && status < 600) return true;
    if (status >= 400 && status < 500) return false;
  }

  // 网络层错误：连接断开、超时、fetch 失败，都属于临时故障
  if (message.includes('ECONNRESET') || message.includes('EPIPE')) return true;
  if (message.includes('ETIMEDOUT') || message.includes('timeout')) return true;
  if (message.includes('fetch failed') || message.includes('network')) return true;
  // AI SDK 会把流式中断包装成 NoOutputGeneratedError，同样可重试
  if (message.includes('No output generated')) return true;

  return false;
}

// 计算重试等待时间：指数退避（每次翻倍）→ 上限截断 → ±25% 随机抖动（避免多方同时重试造成雪崩）
export function calculateDelay(attempt: number, baseMs = 500, maxMs = 30000): number {
  const exponential = baseMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, maxMs);
  const jitterRange = capped * 0.25;
  const jittered = capped + (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.round(jittered));
}

// 休眠指定毫秒数，供重试间隔使用
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
