import type { ServerResponse } from "node:http";
import type { ChatSSEEvent } from "../types/chat.types";

/**
 * SSE 流式输出封装器
 * 负责协议头写入、消息序列化、连接保活与断连感知
 */
export class SSEStream {
  private res: ServerResponse;
  private _isClosed = false;
  private closeListeners: Array<() => void> = [];

  constructor(res: ServerResponse) {
    this.res = res;

    // 建立标准 SSE HTTP 响应头
    this.res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // 禁用 Nginx 代理缓冲
    });

    // 监听客户端连接关闭
    this.res.on("close", () => {
      this._isClosed = true;
      for (const listener of this.closeListeners) {
        try {
          listener();
        } catch {
          // 忽略监听器内部异常
        }
      }
    });
  }

  public get isClosed(): boolean {
    return this._isClosed;
  }

  public onClose(callback: () => void): void {
    if (this._isClosed) {
      callback();
    } else {
      this.closeListeners.push(callback);
    }
  }

  public send(event: ChatSSEEvent): boolean {
    if (this._isClosed) return false;
    try {
      this.res.write(`data: ${JSON.stringify(event)}\n\n`);
      return true;
    } catch {
      this._isClosed = true;
      return false;
    }
  }

  public close(): void {
    if (!this._isClosed) {
      this._isClosed = true;
      try {
        this.res.end();
      } catch {
        // 忽略关闭异常
      }
    }
  }
}
