import { Module } from '@nestjs/common';
import { createAgentRuntime } from '../../core/agent/runtime';
import { AiChatController } from './ai-chat.controller';
import { AiChatDaoService } from './ai-chat.dao.service';
import { AGENT_RUNTIME, AiChatService } from './ai-chat.services';

@Module({
  controllers: [AiChatController],
  providers: [
    {
      provide: AGENT_RUNTIME,
      useFactory: createAgentRuntime,
    },
    AiChatService,
    AiChatDaoService,
  ],
  exports: [AiChatService, AGENT_RUNTIME],
})
export class AiChatModule {}
