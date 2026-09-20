import { type DetectionResult } from './loop-detection';

/**
 * Agent 统一事件体系
 * 用于发布订阅模式 (Pub/Sub)
 */
export type AgentEvent =
  | { type: 'turn:start'; turnId: string }
  | { type: 'turn:end'; turnId: string }
  | { type: 'step:start'; step: number }
  | { type: 'step:end'; step: number }
  | { type: 'reasoning:start'; id?: string }
  | { type: 'reasoning:delta'; delta: string; id?: string }
  | { type: 'reasoning:end'; id?: string }
  | { type: 'text:start'; id?: string }
  | { type: 'text:delta'; delta: string; id?: string }
  | { type: 'text:end'; id?: string }
  | { type: 'tool:call'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool:result'; toolCallId: string; toolName: string; output: unknown }
  | { type: 'loop:detected'; detection: DetectionResult }
  | { type: 'retry'; attempt: number; error: unknown; delayMs: number }
  | { type: 'continue' }
  | { type: 'max-steps'; maxSteps: number }
  | { type: 'error'; error: unknown };

export type AgentEventListener = (event: AgentEvent) => void;
export type Unsubscribe = () => void;
