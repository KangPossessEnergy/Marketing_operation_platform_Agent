import { Module } from '@nestjs/common';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.services';

@Module({
  imports: [AiChatModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
