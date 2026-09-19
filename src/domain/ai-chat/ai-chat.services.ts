import { Inject, Injectable } from '@nestjs/common';
import type { UIMessageStreamWriter } from 'ai';
import { agentLoop } from '../../core/agent/loop';
import { createAgentRuntime } from '../../core/agent/runtime';
import { buildSystemPrompt } from '../../core/context';
import { AiChatDaoService } from './ai-chat.dao.service';
import type { ChatRequestDto, ChatUIMessage } from './ai-chat.entity';

export const AGENT_RUNTIME = 'AGENT_RUNTIME';
export type AgentRuntime = ReturnType<typeof createAgentRuntime>;

const MAX_STEPS = 50;

/**
 * AI 对话核心领域服务：驱动 ReAct Agent 循环，并把领域事件映射为 AI SDK UI Message Stream chunk
 */
@Injectable()
export class AiChatService {
  constructor(
    @Inject(AGENT_RUNTIME) private readonly runtime: AgentRuntime,
    private readonly aiChatDao: AiChatDaoService,
  ) {
    console.log(
      `[AiChatService] AI 对话引擎初始化完成，注册工具数量: ${this.runtime.registry.getAll().length}`,
    );
  }

  public getRegisteredToolsCount(): number {
    return this.runtime.registry.getAll().length;
  }

  public async handleChat(
    dto: ChatRequestDto,
    writer: UIMessageStreamWriter<ChatUIMessage>,
  ): Promise<void> {
    const sessionId = dto.sessionId?.trim() || 'default';

    if (dto.reset) {
      this.aiChatDao.clear(sessionId);
    }
    const messages = this.aiChatDao.appendUserMessage(sessionId, dto.message.trim());

    const systemPrompt = buildSystemPrompt({
      operatorName: dto.operatorName,
    });

    writer.write({ type: 'start' });

    let step = 0;
    let textSeq = 0;
    let openTextId: string | null = null;
    let reasoningSeq = 0;
    let openReasoningId: string | null = null;
    const closeText = () => {
      if (openTextId !== null) {
        writer.write({ type: 'text-end', id: openTextId });
        openTextId = null;
      }
    };
    const closeReasoning = () => {
      if (openReasoningId !== null) {
        writer.write({ type: 'reasoning-end', id: openReasoningId });
        openReasoningId = null;
      }
    };

    await agentLoop(this.runtime.model, this.runtime.registry, messages, systemPrompt, {
      onStep: (n) => {
        step = n;
        closeReasoning();
        closeText();
        if (n > 1) {
          writer.write({ type: 'finish-step' });
        }
        writer.write({ type: 'start-step' });
        writer.write({ type: 'data-step', data: { step: n }, transient: true });
      },
      onReasoning: (delta) => {
        closeText();
        if (openReasoningId === null) {
          openReasoningId = `reasoning-${step}-${++reasoningSeq}`;
          writer.write({ type: 'reasoning-start', id: openReasoningId });
        }
        writer.write({ type: 'reasoning-delta', id: openReasoningId, delta });
      },
      onText: (delta) => {
        closeReasoning();
        if (openTextId === null) {
          openTextId = `text-${step}-${++textSeq}`;
          writer.write({ type: 'text-start', id: openTextId });
        }
        writer.write({ type: 'text-delta', id: openTextId, delta });
      },
      onToolCall: (toolCallId, toolName, input) => {
        closeReasoning();
        closeText();
        writer.write({ type: 'tool-input-available', toolCallId, toolName, input });
      },
      onToolResult: (toolCallId, _toolName, output) => {
        writer.write({ type: 'tool-output-available', toolCallId, output });
      },
      onLoopDetected: (detection) => {
        writer.write({ type: 'data-loop-detected', data: detection, transient: true });
      },
      onRetry: (attempt, error, delayMs) => {
        writer.write({
          type: 'data-retry',
          data: {
            attempt,
            delayMs,
            message: error instanceof Error ? error.message : String(error),
          },
          transient: true,
        });
      },
      onContinue: () => {
        writer.write({ type: 'data-continue', data: {}, transient: true });
      },
      onMaxSteps: () => {
        writer.write({ type: 'data-max-steps', data: { maxSteps: MAX_STEPS }, transient: true });
      },
    });

    closeReasoning();
    closeText();
    if (step > 0) {
      writer.write({ type: 'finish-step' });
    }
    writer.write({ type: 'finish' });
  }
}
