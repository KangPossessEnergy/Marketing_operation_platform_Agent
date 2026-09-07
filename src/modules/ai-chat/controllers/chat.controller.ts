import type { IncomingMessage, ServerResponse } from "node:http";
import { SSEStream } from "../sse/sse-stream";
import { chatService } from "../services/chat.service";
import type { ChatRequestPayload } from "../types/chat.types";

async function parseJsonBody(req: IncomingMessage): Promise<ChatRequestPayload> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  if (!body.trim()) {
    throw new Error("请求体不能为空");
  }
  return JSON.parse(body);
}

export class ChatController {
  public async handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let payload: ChatRequestPayload;

    try {
      payload = await parseJsonBody(req);
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "请求参数错误: 请求体必须是合法的 JSON",
          detail: error instanceof Error ? error.message : String(error),
        })
      );
      return;
    }

    const message = payload.message?.trim();
    if (!message) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "参数校验失败: 'message' 不能为空" }));
      return;
    }

    const sseStream = new SSEStream(res);
    await chatService.handleChat(payload, sseStream);
  }
}

export const chatController = new ChatController();
