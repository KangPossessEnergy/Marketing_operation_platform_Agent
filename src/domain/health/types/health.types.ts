import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ description: '服务状态', enum: ['ok', 'degraded', 'error'], example: 'ok' })
  status!: 'ok' | 'degraded' | 'error';

  @ApiProperty({ description: '服务器当前时间戳（毫秒）', example: 1789493635406 })
  timestamp!: number;

  @ApiProperty({ description: '服务已运行时长（秒）', example: 15 })
  uptime!: number;

  @ApiProperty({ description: '已注册的 Agent 工具数量', example: 7 })
  toolsCount!: number;
}
