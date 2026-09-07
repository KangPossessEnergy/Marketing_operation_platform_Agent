import type { IncomingMessage, ServerResponse } from "node:http";
import { chatController } from "../modules/ai-chat/controllers/chat.controller";
import { healthController } from "../modules/health/controllers/health.controller";

/**
 * 设置全局 CORS 响应头
 */
function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

/**
 * 返回 JSON 响应助手函数
 */
function json(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

/**
 * 主 HTTP 请求分发器 (App Dispatcher)
 */
export async function app(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);

  // 处理 OPTIONS 预检请求
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url || "/";
  const path = url.split("?")[0];
  const method = req.method?.toUpperCase();

  try {
    // 路由分发
    if (method === "GET" && path === "/api/health") {
      healthController.handleHealth(req, res);
      return;
    }

    if (method === "POST" && path === "/api/chat") {
      await chatController.handleChat(req, res);
      return;
    }

    // 404 未找到
    json(res, 404, {
      error: "Not Found",
      message: `Cannot ${method} ${path}`,
    });
  } catch (error) {
    // 500 全局未捕获异常保护
    console.error(`[App] 处理请求 ${method} ${path} 发生未捕获异常:`, error);
    if (!res.headersSent) {
      json(res, 500, {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "未知服务器内部错误",
      });
    }
  }
}
