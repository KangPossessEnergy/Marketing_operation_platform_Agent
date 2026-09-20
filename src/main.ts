//main.ts 基于NestJS框架构建的后端应用程序入口文件,主要用来初始化应用、配置全局中间件/管道并启动HTTP服务

/* 导入依赖项 */
import "dotenv/config";
import "reflect-metadata"; //reflect-metadata：NestJS的装饰器依赖这个库在运行时读取装饰器和元数据，必须最先执行且全进程一次
import { NestFactory } from "@nestjs/core"; //NestFactory：Nest工厂,扫描模块元数据、构建依赖注入(DI)容器、装配express适配器
import { AppModule } from "./app.module"; //AppModule：根模块，import 执行时会连带加载模块图，runtime.ts 里的 dotenv/config 也在此时加载 .env
import { ValidationPipe } from "@nestjs/common"; //ValidationPipe：内置校验管道，配合class-validator 做 DTO校验
import { createDocument } from "./swagger/swagger";

// 异步引导函数，启动流程含异步生命周期（模块解析/钩子）
async function bootstrap() {
  const app = await NestFactory.create(AppModule); //构建模块图+ 实例化全部provider 并解析依赖（AGENT_RUNTIME 工厂、注册 7 个工具在此执行），但尚未监听端口

  /* 应用全局配置 */
  app.enableCors(); // 启动跨域资源共享（CORS），允许前端网页跨域调用后端api
  // 注册全局管道。
  // whitelist: true：自动过滤掉DTO中没有通过装饰器定义的“非法/多余”字段
  // transform: true：自动将请求传入的原始数据（如Query参数 字符串）转换为DTO中指定的类型（如nunber、boolean）
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  //加载Swagger 构建器
  createDocument(app);

  //端口监听和启动
  const port = Number(process.env.PORT ?? 3001); //优先读取环境变量中的端口号,未设置默认使用3001端口
  await app.listen(port); //启动HTTP服务器，开始监听指定端口的请求

  console.log(`营销运营平台 AI 助手 (NestJS) 已启动: http://localhost:${port}`);
  console.log(`  - 接口文档: GET  http://localhost:${port}/docs (Swagger UI)`);
  console.log(`  - 健康检查: GET  http://localhost:${port}/api/health`);
  console.log(
    `  - 对话接口: POST http://localhost:${port}/api/chat (UI Message Stream / SSE)`,
  );
}

//安全启动与异常兜底部分
void bootstrap().catch((err) => {
  console.error("❌ 应用启动失败:", err);
  process.exit(1); // 发生致命错误时，强制退出进程并返回错误码，配合 Docker/K8s 重启策略
});

/* 

AppModule      = 应用组装层（监控/数据库/鉴权 + 业务入口）         "管基础设施"
DomainModule   = 业务聚合层（把各个业务域打包成一个单元）           "管业务"
UserModule 等  = 具体业务（controller + service + 自己的依赖）

*/
