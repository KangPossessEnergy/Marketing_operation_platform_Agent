import { Inject, Injectable } from '@nestjs/common';
import type { UIMessageStreamWriter } from 'ai';
import { AgentSession } from '../../core/agent/session';
import { DEFAULT_MAX_STEPS } from '../../core/agent/constant';
import { createAgentRuntime } from '../../core/agent/runtime';
import { buildSystemPrompt } from '../../core/context';
import { AiChatDaoService } from './ai-chat.dao.service';
import type { ChatRequestDto, ChatUIMessage } from './ai-chat.entity';

export const AGENT_RUNTIME = 'AGENT_RUNTIME';
export type AgentRuntime = ReturnType<typeof createAgentRuntime>;
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
console.log('收到前端请求 message:', dto.message);
    if (dto.reset) {
      this.aiChatDao.clear(sessionId);
    }
    const messages = this.aiChatDao.appendUserMessage(sessionId, dto.message.trim());

    // 取出最新的用户输入交由 session.prompt() 触发外层循环
    const userMsg = messages.pop();
    if (!userMsg) {
      writer.write({ type: 'finish' });
      return;
    }

    const systemPrompt = buildSystemPrompt({
      operatorName: dto.operatorName,
    });

    const session = new AgentSession({
      model: this.runtime.model,
      registry: this.runtime.registry,
      systemPrompt,
      initialMessages: messages,
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

    // 基于发布/订阅模式监听 AgentSession 的标准事件并映射给客户端 SSE
    const unsubscribe = session.subscribe((event) => {
      switch (event.type) {
        case 'step:start':
          step = event.step;
          closeReasoning();
          closeText();
          if (step > 1) {
            writer.write({ type: 'finish-step' });
          }
          writer.write({ type: 'start-step' });
          writer.write({ type: 'data-step', data: { step }, transient: true });
          break;

        case 'reasoning:delta':
          closeText();
          if (openReasoningId === null) {
            openReasoningId = `reasoning-${step}-${++reasoningSeq}`;
            writer.write({ type: 'reasoning-start', id: openReasoningId });
          }
          writer.write({ type: 'reasoning-delta', id: openReasoningId, delta: event.delta });
          break;

        case 'text:delta':
          closeReasoning();
          if (openTextId === null) {
            openTextId = `text-${step}-${++textSeq}`;
            writer.write({ type: 'text-start', id: openTextId });
          }
          writer.write({ type: 'text-delta', id: openTextId, delta: event.delta });
          break;

        case 'tool:call':
          closeReasoning();
          closeText();
          writer.write({
            type: 'tool-input-available',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.input,
          });
          break;

        case 'tool:result':
          writer.write({
            type: 'tool-output-available',
            toolCallId: event.toolCallId,
            output: event.output,
          });
          break;

        case 'loop:detected':
          writer.write({ type: 'data-loop-detected', data: event.detection, transient: true });
          break;

        case 'retry':
          writer.write({
            type: 'data-retry',
            data: {
              attempt: event.attempt,
              delayMs: event.delayMs,
              message: event.error instanceof Error ? event.error.message : String(event.error),
            },
            transient: true,
          });
          break;

        case 'continue':
          writer.write({ type: 'data-continue', data: {}, transient: true });
          break;

        case 'max-steps':
          writer.write({
            type: 'data-max-steps',
            data: { maxSteps: event.maxSteps ?? DEFAULT_MAX_STEPS },
            transient: true,
          });
          break;
      }
    });

    try {
      const content = typeof userMsg.content === 'string' ? userMsg.content : JSON.stringify(userMsg.content);
      await session.prompt(content);
    } finally {
      unsubscribe();
      closeReasoning();
      closeText();
      if (step > 0) {
        writer.write({ type: 'finish-step' });
      }
      writer.write({ type: 'finish' });
      // 同步最新会话历史记录回仓储
      this.aiChatDao.replaceMessages(sessionId, session.getMessages());
    }
  }
}
