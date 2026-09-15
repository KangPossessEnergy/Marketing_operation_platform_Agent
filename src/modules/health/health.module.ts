import { Module } from '@nestjs/common';
import { AiChatModule } from '../ai-chat/chat.module';
import { HealthController } from './health.controller';

@Module({
  imports: [AiChatModule],
  controllers: [HealthController],
})
export class HealthModule {}
