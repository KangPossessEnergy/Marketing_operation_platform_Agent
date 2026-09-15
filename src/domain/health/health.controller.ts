import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from '../ai-chat/chat.service';
import { HealthResponseDto } from './types/health.types';

@ApiTags('健康检查')
@Controller('api/health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: '健康检查', description: '返回服务状态、运行时长与已注册的 Agent 工具数量' })
  @ApiOkResponse({ type: HealthResponseDto, description: '服务健康状态' })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: Date.now(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      toolsCount: this.chatService.getRegisteredToolsCount(),
    };
  }
}
