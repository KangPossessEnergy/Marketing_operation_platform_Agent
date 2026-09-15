import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AiChatModule } from './modules/ai-chat/chat.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [AiChatModule, HealthModule],
  controllers: [AppController],
})
export class AppModule {}
