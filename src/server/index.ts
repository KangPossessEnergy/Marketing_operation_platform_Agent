import { createServer } from "node:http";
import { app } from "./app";

const PORT = Number(process.env.PORT || 3001);

const server = createServer((req, res) => {
  app(req, res);
});

// 监听服务器级别错误（如端口占用等）
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ [Server 启动失败] 端口 ${PORT} 已被占用 (EADDRINUSE)。`);
    console.error(`💡 解决方式:`);
    console.error(`   1. 查看并关闭占用端口的进程: lsof -i :${PORT} && kill -9 <PID>`);
    console.error(`   2. 或者指定其他端口启动: PORT=3002 pnpm run server:dev\n`);
    process.exit(1);
  } else {
    console.error(`❌ [Server 异常]:`, err);
    process.exit(1);
  }
});

// 优雅停机信号捕获
function handleShutdown(signal: string) {
  console.log(`\n[Server] 收到 ${signal} 信号，正在优雅关闭服务器...`);
  server.close(() => {
    console.log("[Server] HTTP 服务器已安全关闭。");
    process.exit(0);
  });

  // 超时强制退出保护
  setTimeout(() => {
    console.error("[Server] 强制退出：关闭超时");
    process.exit(1);
  }, 5000);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Marketing Operation Agent HTTP 服务已启动`);
  console.log(`📡 监听地址: http://localhost:${PORT}`);
  console.log(`🩺 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`💬 对话接口: POST http://localhost:${PORT}/api/chat`);
  console.log(`=============================================`);
});
