import { Controller, Inject, Post, Res } from '@nestjs/common';
import {
  createUIMessageStream,
  streamText,
  pipeUIMessageStreamToResponse,
  toUIMessageStream,
} from 'ai';
import type { Response } from 'express';
import { AGENT_RUNTIME, type AgentRuntime } from './modules/ai-chat/chat.service';

/**
 * 演示控制器：与 vercel/ai examples/nest 的 app.controller.ts 保持一致，
 * 唯一差异是模型来自项目统一的环境变量装配 (AGENT_RUNTIME)，未配置 API_KEY 时自动降级为 mock 模型。
 */
@Controller()
export class AppController {
  constructor(@Inject(AGENT_RUNTIME) private readonly runtime: AgentRuntime) {}

  @Post('/')
  async root(@Res() res: Response) {
    const result = streamText({
      model: this.runtime.model,
      prompt: 'Invent a new holiday and describe its traditions.',
    });

    pipeUIMessageStreamToResponse({
      response: res,
      stream: toUIMessageStream({ stream: result.stream }),
    });
  }

  @Post('/stream-data')
  async streamData(@Res() response: Response) {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        // write some data
        writer.write({ type: 'start' });

        writer.write({
          type: 'data-custom',
          data: {
            custom: 'Hello, world!',
          },
        });

        const result = streamText({
          model: this.runtime.model,
          prompt: 'Invent a new holiday and describe its traditions.',
        });
        writer.merge(
          toUIMessageStream({
            stream: result.stream,
            sendStart: false,
            onError: error => {
              // Error messages are masked by default for security reasons.
              // If you want to expose the error message to the client, you can do so here:
              return error instanceof Error ? error.message : String(error);
            },
          }),
        );
      },
    });
    pipeUIMessageStreamToResponse({ stream, response });
  }
}
