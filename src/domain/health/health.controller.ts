import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './health.entity';
import { HealthService } from './health.services';

@ApiTags('健康检查')
@Controller('api/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '健康检查', description: '返回服务状态、运行时长与已注册的 Agent 工具数量' })
  @ApiOkResponse({ type: HealthResponseDto, description: '服务健康状态' })
  check(): HealthResponseDto {
    return this.healthService.getHealth();
  }
}
