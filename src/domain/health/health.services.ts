import { Injectable } from '@nestjs/common';
import { AiChatService } from '../ai-chat/ai-chat.services';
import { HealthResponseDto } from './health.entity';

/**
 * 健康检查领域服务：汇总服务状态、运行时长与已注册工具数量
 */
@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly aiChatService: AiChatService) {}

  public getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: Date.now(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      toolsCount: this.aiChatService.getRegisteredToolsCount(),
    };
  }
}
