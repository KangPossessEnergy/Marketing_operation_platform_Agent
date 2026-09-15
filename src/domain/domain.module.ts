import { Module } from '@nestjs/common';
import { AiChatModule } from './ai-chat/chat.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AiChatModule,HealthModule],
  controllers: [],
  providers: [],
  exports: [AiChatModule],
})
export class DomainModule {}









//DomainModule 管"业务"