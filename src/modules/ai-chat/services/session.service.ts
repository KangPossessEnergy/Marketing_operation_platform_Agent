import type { ModelMessage } from "ai";

export interface SessionConfig {
  maxHistoryLength?: number;
}

export class SessionService {
  private sessions = new Map<string, ModelMessage[]>();
  private maxHistoryLength: number;

  constructor(config: SessionConfig = {}) {
    this.maxHistoryLength = config.maxHistoryLength ?? 30;
  }

  public getOrCreate(sessionId: string = "default", reset: boolean = false): ModelMessage[] {
    if (reset || !this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    return this.sessions.get(sessionId)!;
  }

  public appendUserMessage(sessionId: string = "default", text: string): ModelMessage[] {
    const messages = this.getOrCreate(sessionId);
    messages.push({ role: "user", content: text });
    this.trimHistory(sessionId);
    return messages;
  }

  public clear(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  private trimHistory(sessionId: string): void {
    const messages = this.sessions.get(sessionId);
    if (messages && messages.length > this.maxHistoryLength) {
      const trimmed = messages.slice(messages.length - this.maxHistoryLength);
      this.sessions.set(sessionId, trimmed);
    }
  }
}

export const sessionService = new SessionService();
