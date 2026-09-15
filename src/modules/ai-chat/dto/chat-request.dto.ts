import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * 客户端发起对话请求的 DTO
 */
export class ChatRequestDto {
  /**
   * 会话唯一标识，用于隔离和持久化历史上下文（缺省时使用 "default"）
   */
  @IsOptional()
  @IsString()
  sessionId?: string;

  /**
   * 用户输入的文本消息（必填，空白字符串视为无效）
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  message!: string;

  /**
   * 是否重置/清空该会话的历史消息
   */
  @IsOptional()
  @IsBoolean()
  reset?: boolean;

  /**
   * 当前操作员名称，用于动态注入 System Prompt
   */
  @IsOptional()
  @IsString()
  operatorName?: string;
}
