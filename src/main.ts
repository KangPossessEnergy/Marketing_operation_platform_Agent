import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  console.log(`营销运营平台 AI 助手 (NestJS) 已启动: http://localhost:${port}`);
  console.log(`  - 健康检查: GET  http://localhost:${port}/api/health`);
  console.log(`  - 对话接口: POST http://localhost:${port}/api/chat (UI Message Stream / SSE)`);
}

void bootstrap();
