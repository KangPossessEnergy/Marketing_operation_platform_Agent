import { streamText, type ModelMessage } from 'ai';
import { ToolRegistry } from '../tools/tool-registry';
import {
  detect,
  recordCall,
  recordResult,
  resetHistory,
  type DetectionResult,
} from './loop-detection';
import { isRetryable, calculateDelay, sleep } from './retry';

const MAX_STEPS = 50;
const MAX_RETRIES = 3;

export interface AgentEvents {
  onStep?: (step: number) => void;
  onText?: (delta: string) => void;
  onToolCall?: (toolName: string, input: unknown) => void;
  onToolResult?: (toolName: string, output: unknown) => void;
  onContinue?: () => void;
  onMaxSteps?: () => void;
  onLoopDetected?: (detection: DetectionResult) => void;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export interface AgentLoopOptions {
  resetLoopHistory?: boolean;
  maxRetries?: number;
}

export async function agentLoop(
  model: any,
  registry: ToolRegistry,
  messages: ModelMessage[],
  system: string,
  events: AgentEvents = {},
  options: AgentLoopOptions = {},
) {
  if (options.resetLoopHistory !== false) {
    resetHistory();
  }

  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  let step = 0;

  while (step < MAX_STEPS) {
    step++;
    events.onStep?.(step);

    let hasToolCall = false;
    let criticalDetection: DetectionResult | null = null;
    let warningDetections: DetectionResult[] = [];
    let stepMessages: any = null;

    // API 容错：遇到可重试错误（网络抖动、限流 429、5xx 等）按指数退避 + 随机抖动重试
    let attempt = 0;
    while (true) {
      try {
        const result = streamText({
          model,
          system,
          tools: registry.toAISDKFormat(),
          messages,
          // 不设 stopWhen，每次只跑一步
        });

        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              events.onText?.(part.text);
              break;

            case 'tool-call': {
              hasToolCall = true;
              events.onToolCall?.(part.toolName, part.input);

              // 循环检测：先检测当前调用是否陷入循环，再记录调用
              const detection = detect(part.toolName, part.input);
              recordCall(part.toolName, part.input);

              if (detection.stuck) {
                events.onLoopDetected?.(detection);
                if (detection.level === 'critical') {
                  criticalDetection = detection;
                } else if (detection.level === 'warning') {
                  warningDetections.push(detection);
                }
              }
              break;
            }

            case 'tool-result': {
              events.onToolResult?.(part.toolName, part.output);
              // 补录工具结果哈希，用于无进展熔断检测
              recordResult(part.toolName, part.input, part.output);
              break;
            }
          }
        }

        // 拿到这一步的完整结果
        stepMessages = await result.response;
        break; // 本步调用成功，跳出重试循环
      } catch (error) {
        attempt++;
        if (isRetryable(error) && attempt <= maxRetries) {
          const delayMs = calculateDelay(attempt);
          events.onRetry?.(attempt, error, delayMs);
          await sleep(delayMs);
          continue;
        }
        // 不可重试或超过最大重试次数，向外抛出异常
        throw error;
      }
    }

    // 追加到消息历史
    if (stepMessages?.messages) {
      messages.push(...stepMessages.messages);
    }

    // 如果检测到严重卡死（熔断），强制停止循环
    if (criticalDetection) {
      break;
    }

    // 如果检测到警告，向对话历史注入系统提示引导模型换思路
    if (warningDetections.length > 0) {
      const warnMsg = warningDetections.map(d => ('message' in d ? d.message : '')).filter(Boolean).join('; ');
      messages.push({
        role: 'system',
        content: `[系统检测提醒] ${warnMsg}。请停止重复相同的工具调用或无效参数，尝试换一种策略解决问题。`,
      });
    }

    // 退出条件：模型没有调用任何工具，说明它认为可以直接回复了
    if (!hasToolCall) {
      break;
    }

    // 还有工具调用 → 继续循环，让模型看到工具结果后继续思考
    events.onContinue?.();
  }

  if (step >= MAX_STEPS) {
    events.onMaxSteps?.();
  }
}
