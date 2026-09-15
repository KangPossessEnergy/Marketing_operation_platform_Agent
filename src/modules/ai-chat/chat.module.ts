import { Module } from '@nestjs/common';
import { createAgentRuntime } from '../../core/agent/runtime';
import { ChatController } from './chat.controller';
import { AGENT_RUNTIME, ChatService } from './chat.service';
import { SessionService } from './session.service';

@Module({
  controllers: [ChatController],
  providers: [
    {
      provide: AGENT_RUNTIME,
      useFactory: createAgentRuntime,
    },
    ChatService,
    SessionService,
  ],
  exports: [ChatService, AGENT_RUNTIME],
})
export class AiChatModule {}
