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
import {
  ReasoningMarkerParser,
  stripEncodedReasoning,
} from './reasoning';
import { type AgentEvent, type AgentEventListener } from './types';
import { MessageQueue } from './queue';
import { DEFAULT_MAX_RETRIES, DEFAULT_MAX_STEPS } from './constant';



export interface RunLoopOptions {
  model: any;
  registry: ToolRegistry;
  messages: ModelMessage[];
  system: string;
  steeringQueue: MessageQueue<ModelMessage>;
  followUpQueue: MessageQueue<ModelMessage>;
  emit: AgentEventListener;
  signal?: AbortSignal;
  maxSteps?: number;
  maxRetries?: number;
  resetLoopHistory?: boolean;
}

/**
 * 核心 Agent 运行引擎 (双层 While + 双队列 + 事件驱动)
 *
 * - 外层循环：消费 followUpQueue，处理一轮完整的对话/任务交互 (Turn)
 * - 内层循环：消费 steeringQueue 与执行工具链，驱动每一步的思考与行动决策 (Step)
 */
export async function runLoop(options: RunLoopOptions): Promise<void> {
  const {
    model,
    registry,
    messages,
    system,
    steeringQueue,
    followUpQueue,
    emit,
    signal,
    maxSteps = DEFAULT_MAX_STEPS,
    maxRetries = DEFAULT_MAX_RETRIES,
    resetLoopHistory = true,
  } = options;

  if (resetLoopHistory) {
    resetHistory();
  }

  // =========================================================================
  // 外层循环：消费 followUpQueue，管理多轮交互生命周期 (Turn-level)
  // =========================================================================
  while (!signal?.aborted && !followUpQueue.isEmpty()) {
    const nextFollowUp = await followUpQueue.popAsync();
    if (!nextFollowUp) break;
    console.log('kkdw-外层循环')
    messages.push(nextFollowUp);

    const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    emit({ type: 'turn:start', turnId });

    let step = 0;

    // =======================================================================
    // 内层循环：消费 steeringQueue，驱动思考/工具决策闭环 (Step-level)
    // =======================================================================
    while (!signal?.aborted && step < maxSteps) {
      step++;
      emit({ type: 'step:start', step });

      // 1. 消费内层转向/纠偏指令（如用户中途打断、运行时系统矫正）
      if (!steeringQueue.isEmpty()) {
        const steeringItems = steeringQueue.drain();
        messages.push(...steeringItems);
      }

          console.log('kkdw-内层循环')
      let hasToolCall = false;
      let criticalDetection: DetectionResult | null = null;
      let warningDetections: DetectionResult[] = [];
      let stepMessages: any = null;

      // 2. 带指数退避重试的流式模型调用
      let attempt = 0;
      while (!signal?.aborted) {
        try {
          const result = streamText({
            model,
            system,
            tools: registry.toAISDKFormat(),
            messages,
            abortSignal: signal,
          });

          let reasoningActive = false;
          let textActive = false;

          const closeReasoning = () => {
            if (reasoningActive) {
              emit({ type: 'reasoning:end' });
              reasoningActive = false;
            }
          };

          const closeText = () => {
            if (textActive) {
              emit({ type: 'text:end' });
              textActive = false;
            }
          };

          const reasoningParser = new ReasoningMarkerParser(
            (delta) => {
              closeText();
              if (!reasoningActive) {
                emit({ type: 'reasoning:start' });
                reasoningActive = true;
              }
              emit({ type: 'reasoning:delta', delta });
            },
            (delta) => {
              closeReasoning();
              if (!textActive) {
                emit({ type: 'text:start' });
                textActive = true;
              }
              emit({ type: 'text:delta', delta });
            },
          );

          for await (const part of result.fullStream) {
            if (signal?.aborted) break;

            switch (part.type) {
              case 'reasoning-delta':
                closeText();
                if (!reasoningActive) {
                  emit({ type: 'reasoning:start' });
                  reasoningActive = true;
                }
                emit({ type: 'reasoning:delta', delta: part.text });
                break;

              case 'text-delta':
                reasoningParser.push(part.text);
                break;

              case 'tool-call': {
                closeReasoning();
                closeText();
                hasToolCall = true;
                emit({
                  type: 'tool:call',
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: part.input,
                });

                // 死循环防范与熔断检测
                const detection = detect(part.toolName, part.input);
                recordCall(part.toolName, part.input);

                if (detection.stuck) {
                  emit({ type: 'loop:detected', detection });
                  if (detection.level === 'critical') {
                    criticalDetection = detection;
                  } else if (detection.level === 'warning') {
                    warningDetections.push(detection);
                  }
                }
                break;
              }

              case 'tool-result': {
                closeReasoning();
                closeText();
                emit({
                  type: 'tool:result',
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  output: part.output,
                });
                recordResult(part.toolName, part.input, part.output);
                break;
              }
            }
          }

          reasoningParser.flush();
          closeReasoning();
          closeText();

          stepMessages = await result.response;
          break; // 本步成功
        } catch (error) {
          if (signal?.aborted) throw error;
          attempt++;
          if (isRetryable(error) && attempt <= maxRetries) {
            const delayMs = calculateDelay(attempt);
            emit({ type: 'retry', attempt, error, delayMs });
            await sleep(delayMs);
            continue;
          }
          emit({ type: 'error', error });
          throw error;
        }
      }

      // 3. 追加本步消息（清理思考标签）
      if (stepMessages?.messages) {
        messages.push(...stripEncodedReasoning(stepMessages.messages));
      }

      emit({ type: 'step:end', step });

      // 4. 严重熔断，直接跳出内层循环
      if (criticalDetection) {
        break;
      }

      // 5. 循环警告自愈：将纠偏提示注入 steeringQueue 供下一步决策
      if (warningDetections.length > 0) {
        const warnMsg = warningDetections
          .map((d) => ('message' in d ? d.message : ''))
          .filter(Boolean)
          .join('; ');
        steeringQueue.push({
          role: 'system',
          content: `[系统检测提醒] ${warnMsg}。请停止重复相同的工具调用或无效参数，尝试换一种策略解决问题。`,
        });
      }

      // 6. 内层循环退出判定：
      // 模型没有要求调用工具，且 steeringQueue 中没有待处理纠偏指令
      if (!hasToolCall && steeringQueue.isEmpty()) {
        break;
      }

      emit({ type: 'continue' });
    }

    if (step >= maxSteps) {
      emit({ type: 'max-steps', maxSteps });
    }

    emit({ type: 'turn:end', turnId });
  }
}

