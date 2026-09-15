import { Body, Controller, Post, Res } from '@nestjs/common';
import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import type { ChatUIMessage } from './types/chat.types';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  chat(@Body() dto: ChatRequestDto, @Res() res: Response): void {
    const stream = createUIMessageStream<ChatUIMessage>({
      execute: async ({ writer }) => {
        await this.chatService.handleChat(dto, writer);
      },
      onError: (error) => (error instanceof Error ? error.message : String(error)),
    });

    void pipeUIMessageStreamToResponse({ response: res, stream });
  }
}
