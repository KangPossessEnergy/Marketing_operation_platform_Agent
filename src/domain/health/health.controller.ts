import { Controller, Get } from '@nestjs/common';
import { ChatService } from '../ai-chat/chat.service';
import type { HealthResponse } from './types/health.types';

@Controller('api/health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly chatService: ChatService) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: Date.now(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      toolsCount: this.chatService.getRegisteredToolsCount(),
    };
  }
}
