import type { IncomingMessage, ServerResponse } from "node:http";
import { chatService } from "../../ai-chat/services/chat.service";
import type { HealthResponse } from "../types/health.types";

export class HealthController {
  private startTime = Date.now();

  public handleHealth(_req: IncomingMessage, res: ServerResponse): void {
    const payload: HealthResponse = {
      status: "ok",
      timestamp: Date.now(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      toolsCount: chatService.getRegisteredToolsCount(),
    };

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
  }
}

export const healthController = new HealthController();
