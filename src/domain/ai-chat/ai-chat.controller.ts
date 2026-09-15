import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai';
import type { Response } from 'express';
import { ChatRequestDto, type ChatUIMessage } from './ai-chat.entity';
import { AiChatService } from './ai-chat.services';

@ApiTags('AI 对话')
@Controller('api/chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post()
  @ApiOperation({
    summary: 'AI 对话（流式）',
    description:
      '驱动 ReAct Agent 多步推理与工具调用，以 AI SDK UI Message Stream 协议（SSE）实时下发回复文本、工具调用与领域事件。',
  })
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 200,
    description:
      'SSE 流（text/event-stream），每行一个 data: {...} chunk：start → start-step → text-start/text-delta/text-end、tool-input-available/tool-output-available、data-step/data-loop-detected/data-retry/data-continue/data-max-steps → finish，最终以 data: [DONE] 结束。',
  })
  @ApiResponse({ status: 400, description: '请求参数校验失败（如 message 为空）' })
  chat(@Body() dto: ChatRequestDto, @Res() res: Response): void {
    const stream = createUIMessageStream<ChatUIMessage>({
      execute: async ({ writer }) => {
        await this.aiChatService.handleChat(dto, writer);
      },
      onError: (error) => (error instanceof Error ? error.message : String(error)),
    });

    void pipeUIMessageStreamToResponse({ response: res, stream });
  }
}
