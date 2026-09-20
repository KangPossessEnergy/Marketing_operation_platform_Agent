import { SwaggerConfig } from './swagger.interface.js';

/**
 * Configuration for the swagger UI (found at /docs).
 * Change this to suit your app!
 */
export const SWAGGER_CONFIG: SwaggerConfig = {
  title: '营销运营平台 AI Agent API',
  description: '基于 NestJS + Vercel AI SDK 的营销运营平台 AI 助手接口文档',
  version: '1.0',
  tags: ['AI 对话', '健康检查'],
};