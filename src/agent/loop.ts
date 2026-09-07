import { streamText, type ModelMessage } from 'ai';
import { ToolRegistry } from '../tools/tool-registry';

const MAX_STEPS = 50;

export interface AgentEvents {
  onStep?: (step: number) => void;
  onText?: (delta: string) => void;
  onToolCall?: (toolName: string, input: unknown) => void;
  onToolResult?: (toolName: string, output: unknown) => void;
  onContinue?: () => void;
  onMaxSteps?: () => void;
}

export async function agentLoop(
  model: any,
  registry: ToolRegistry,
  messages: ModelMessage[],
  system: string,
  events: AgentEvents = {},
) {
  let step = 0;

  while (step < MAX_STEPS) {
    step++;
    events.onStep?.(step);

    const result = streamText({
      model,
      system,
      tools: registry.toAISDKFormat(),
      messages,
      // 不设 stopWhen，每次只跑一步
    });

    let hasToolCall = false;

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          events.onText?.(part.text);
          break;

        case 'tool-call':
          hasToolCall = true;
          events.onToolCall?.(part.toolName, part.input);
          break;

        case 'tool-result':
          events.onToolResult?.(part.toolName, part.output);
          break;
      }
    }

    // 拿到这一步的完整结果，追加到消息历史
    const stepMessages = await result.response;
    messages.push(...stepMessages.messages);

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
