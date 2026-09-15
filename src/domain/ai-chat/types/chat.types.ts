import type { UIMessage } from 'ai';
import type { DetectionResult } from '../../../core/agent/loop-detection';

/**
 * 随 UI Message Stream 下发的自定义数据部分（type 为 data-<key>，均为 transient 通知，不进入消息历史）
 */
export type ChatDataParts = {
  /** Agent 第 N 步开始 */
  step: { step: number };
  /** 循环/振荡/卡死检测提醒 */
  'loop-detected': DetectionResult;
  /** API 异常重试事件 (429/5xx/断流) */
  retry: { attempt: number; delayMs: number; message: string };
  /** 模型判定需继续下一步思考 */
  continue: Record<string, never>;
  /** 达到最大步数限制 (50 步) */
  'max-steps': { maxSteps: number };
}

export type ChatUIMessage = UIMessage<unknown, ChatDataParts>;
