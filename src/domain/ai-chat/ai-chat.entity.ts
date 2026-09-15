import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { UIMessage } from 'ai';
import type { DetectionResult } from '../../core/agent/loop-detection';

/**
 * 客户端发起对话请求的 DTO
 */
export class ChatRequestDto {
  /**
   * 会话唯一标识，用于隔离和持久化历史上下文（缺省时使用 "default"）
   */
  @ApiPropertyOptional({
    description: '会话唯一标识，用于隔离和持久化历史上下文（缺省时使用 "default"）',
    example: 'user-001',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  /**
   * 用户输入的文本消息（必填，空白字符串视为无效）
   */
  @ApiProperty({
    description: '用户输入的文本消息（必填，空白字符串会被拒绝）',
    example: '帮我针对即将到来的中秋节，策划一份私域用户激活与裂变活动方案',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  message!: string;

  /**
   * 是否重置/清空该会话的历史消息
   */
  @ApiPropertyOptional({
    description: '是否重置/清空该会话的历史消息',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  reset?: boolean;

  /**
   * 当前操作员名称，用于动态注入 System Prompt
   */
  @ApiPropertyOptional({
    description: '当前操作员名称，用于动态注入 System Prompt',
    example: '运营负责人',
  })
  @IsOptional()
  @IsString()
  operatorName?: string;
}

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
};

export type ChatUIMessage = UIMessage<unknown, ChatDataParts>;
