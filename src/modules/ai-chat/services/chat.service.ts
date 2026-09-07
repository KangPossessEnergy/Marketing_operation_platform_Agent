import { createAgentRuntime } from "../../../core/agent/runtime";
import { agentLoop } from "../../../core/agent/loop";
import { buildSystemPrompt } from "../../../core/context";
import { sessionService } from "./session.service";
import type { SSEStream } from "../sse/sse-stream";
import type { ChatRequestPayload } from "../types/chat.types";

/**
 * AI 对话核心领域服务
 */
export class ChatService {
  private runtime: ReturnType<typeof createAgentRuntime>;

  constructor() {
    this.runtime = createAgentRuntime();
    console.log(`[ChatService] AI 对话引擎初始化完成，注册工具数量: ${this.runtime.registry.getAll().length}`);
  }

  public getRegisteredToolsCount(): number {
    return this.runtime.registry.getAll().length;
  }

  public async handleChat(payload: ChatRequestPayload, stream: SSEStream): Promise<void> {
    const sessionId = payload.sessionId?.trim() || "default";
    const userMessage = payload.message?.trim() || "";

    if (payload.reset) {
      sessionService.clear(sessionId);
    }
    const messages = sessionService.appendUserMessage(sessionId, userMessage);

    const systemPrompt = buildSystemPrompt({
      operatorName: payload.operatorName,
    });

    try {
      await agentLoop(
        this.runtime.model,
        this.runtime.registry,
        messages,
        systemPrompt,
        {
          onStep: (step) => {
            if (stream.isClosed) return;
            stream.send({ type: "step", step });
          },
          onText: (delta) => {
            if (stream.isClosed) return;
            stream.send({ type: "text", delta });
          },
          onToolCall: (toolName, input) => {
            if (stream.isClosed) return;
            stream.send({ type: "tool-call", toolName, input });
          },
          onToolResult: (toolName, output) => {
            if (stream.isClosed) return;
            stream.send({ type: "tool-result", toolName, output });
          },
          onLoopDetected: (detection) => {
            if (stream.isClosed) return;
            stream.send({ type: "loop-detected", detection });
          },
          onRetry: (attempt, error, delayMs) => {
            if (stream.isClosed) return;
            stream.send({
              type: "retry",
              attempt,
              delayMs,
              message: error instanceof Error ? error.message : String(error),
            });
          },
          onContinue: () => {
            if (stream.isClosed) return;
            stream.send({ type: "continue" });
          },
          onMaxSteps: () => {
            if (stream.isClosed) return;
            stream.send({ type: "max-steps" });
          },
        }
      );

      if (!stream.isClosed) {
        stream.send({ type: "done" });
      }
    } catch (error) {
      if (!stream.isClosed) {
        stream.send({
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      stream.close();
    }
  }
}

export const chatService = new ChatService();
