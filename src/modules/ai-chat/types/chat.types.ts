import type { DetectionResult } from "../../../core/agent/loop-detection";

/**
 * 客户端发起对话请求的 Payload
 */
export interface ChatRequestPayload {
  /**
   * 会话唯一标识，用于隔离和持久化历史上下文（缺省时使用 "default"）
   */
  sessionId?: string;
  /**
   * 用户输入的文本消息
   */
  message?: string;
  /**
   * 是否重置/清空该会话的历史消息
   */
  reset?: boolean;
  /**
   * 当前操作员名称，用于动态注入 System Prompt
   */
  operatorName?: string;
}

/**
 * 标准 SSE 下发事件联合类型
 */
export type ChatSSEEvent =
  | { type: "step"; step: number }
  | { type: "text"; delta: string }
  | { type: "tool-call"; toolName: string; input: unknown }
  | { type: "tool-result"; toolName: string; output: unknown }
  | { type: "loop-detected"; detection: DetectionResult }
  | { type: "retry"; attempt: number; delayMs: number; message: string }
  | { type: "continue" }
  | { type: "max-steps" }
  | { type: "done" }
  | { type: "error"; message: string };
