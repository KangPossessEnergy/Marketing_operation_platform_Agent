# Marketing_operation_platform_Agent

营销运营平台的 AI 智能助手——一个基于 **NestJS + Vercel AI SDK** 的企业级全栈 Agent 系统（架构对齐 [vercel/ai examples/nest](https://github.com/vercel/ai/tree/main/examples/nest)），面向全域营销与电商运营业务场景，支持标准 UI Message Stream 流式输出、多步工具调用、循环检测与 API 容错重试。

---

## 技术栈

- **Web 框架**: NestJS 11（装饰器 + 依赖注入 + nest-cli 构建）
- **AI 框架**: Vercel AI SDK（`ai` + `@ai-sdk/openai`），流式协议为 **UI Message Stream**（`createUIMessageStream` + `pipeUIMessageStreamToResponse`）
- **参数校验**: class-validator / class-transformer（全局 ValidationPipe）
- **架构设计**: Nest 特性模块 + 领域分层（core 引擎与业务模块解耦）
- **运行时**: Node.js + nest-cli / tsx（CLI）
- **包管理器**: pnpm (锁定版本，请勿使用 npm/yarn 安装依赖)



---

## 环境要求

- Node.js >= 18
- pnpm >= 8

---

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env   # 填入你的 API_KEY / BASE_URL / NAME

# 3. 启动 HTTP 服务 (开发模式，文件变更自动重启)
pnpm start:dev

# 生产模式
pnpm build && pnpm start:prod

# 4. 启动 CLI 交互式终端 (单机调试)
pnpm dev

# 类型检查 / 编译
pnpm build
```

CLI 启动后进入交互式对话，输入 `exit` 退出。

> 💡 未配置 `API_KEY` 时会自动切换到内置的 mock 模型，方便本地无鉴权调试 Agent 流程。

---

## 架构设计 (NestJS 特性模块 + 领域分层)

```text
src/
├── main.ts                              # 【Nest 引导入口】NestFactory / CORS / ValidationPipe / 优雅停机
├── app.module.ts                        # 【根模块】聚合各特性模块
├── app.controller.ts                    # 【演示控制器】对齐 vercel/ai examples/nest：POST / 与 POST /stream-data
├── cli.ts                               # 【CLI 终端交互单机调试入口】(pnpm dev)
│
├── core/                                # 【核心底层底座 - AI Agent Engine & Infrastructure】
│   ├── agent/                           # Agent 执行引擎
│   │   ├── loop.ts                      # ReAct 核心执行循环 (单步迭代驱动)
│   │   ├── loop-detection.ts            # 循环/振荡/卡死检测 (SHA-256 参数及结果指纹)
│   │   ├── retry.ts                     # API 容错与重试机制 (指数退避 + 随机 Jitter)
│   │   └── runtime.ts                   # 运行时装配工厂 (模型加载与工具挂载，供 Nest provider 与 CLI 复用)
│   ├── context/                         # 系统提示词管道 (动静分界优化 KV Cache)
│   │   ├── prompt-builder.ts            # 管道构建器 (PromptBuilder Pipe 模式)
│   │   ├── index.ts                     # 提示词拼装主入口
│   │   └── modules/                     # 提示词子模块 (identity, capabilities, principles 等)
│   ├── tools/                           # 工具注册中心与内置系统工具
│   │   ├── index.ts                     # 工具统一导出入口
│   │   ├── tool-registry.ts             # 工具注册表 (自动转换 AI SDK Schema，长输出截断)
│   │   ├── common/                      # 基础文件读写、目录搜索、Shell 执行工具
│   │   └── mcp/                         # Model Context Protocol (MCP) 扩展目录
│   └── mock/
│       └── mock-model.ts                # 本地模拟大模型 Provider
│
├── swagger/                             # 【API 文档】swagger.ts / swagger.config.ts（UI 挂载在 /docs）
├── domain/                              # 【业务领域模块 - Nest 特性模块，五件套标准结构】
│   ├── index.ts                         # 领域说明文档（各子模块目录结构注释）
│   ├── domain.module.ts                 # 领域聚合模块（统一 imports 并 re-export 业务能力）
│   │
│   ├── ai-chat/                         # 【AI 对话领域】
│   │   ├── ai-chat.controller.ts        # 路由入口：POST /api/chat（createUIMessageStream + pipeUIMessageStreamToResponse）
│   │   ├── ai-chat.services.ts          # 业务逻辑：驱动 agentLoop，领域事件 → UI chunk 映射（导出 AGENT_RUNTIME）
│   │   ├── ai-chat.dao.service.ts       # 数据访问层：多会话历史存储（内存 Map + 滑动窗口截断）
│   │   ├── ai-chat.entity.ts            # 实体定义：ChatRequestDto / ChatDataParts / ChatUIMessage
│   │   └── ai-chat.module.ts            # 模块定义：组装以上各部分（exports: AiChatService / AGENT_RUNTIME）
│   │
│   ├── health/                          # 【系统健康监控领域】（无持久化需求，不含 DAO）
│   │   ├── health.controller.ts         # 路由入口：GET /api/health
│   │   ├── health.services.ts           # 业务逻辑：汇总状态/运行时长/工具数（注入 AiChatService）
│   │   ├── health.entity.ts             # 实体定义：HealthResponseDto
│   │   └── health.module.ts             # 模块定义：imports AiChatModule
│   │
│   ├── marketing/                       # 【可扩展业务：智能营销活动/文案批量生成】
│   │   └── ...
│   ├── crm/                             # 【可扩展业务：CRM 客户线索跟进与画像】
│   │   └── ...
│   ├── erp/                             # 【可扩展业务：ERP 进销存/采购单据流】
│   │   └── ...
│   └── auth/                            # 【可扩展业务：统一鉴权/权限模块】
│       └── ...
```

---

## 业务模块拓展指南 (如何添加新 Domain)

得益于 `src/domain/` 的五件套标准结构，添加新业务模块极为简便：

1. **创建新特性模块**（例如智能营销文案模块），按标准目录结构组织：
   ```text
   src/domain/marketing/
   ├── marketing.controller.ts      # 路由入口，接收 HTTP 请求
   ├── marketing.services.ts        # 业务逻辑
   ├── marketing.dao.service.ts     # 数据访问层（DAO，可选——有持久化需求时添加）
   ├── marketing.entity.ts          # 数据实体定义（DTO / 类型）
   └── marketing.module.ts          # 模块定义，组装以上各部分
   ```
2. **挂载到领域聚合模块 [src/domain/domain.module.ts](src/domain/domain.module.ts)**：
   在 `imports` 中加入 `MarketingModule` 即可暴露新端点，无需侵入 `core/` Agent 核心引擎。
   注意：若上层模块（如 AppModule）需要注入新模块导出的 provider，记得在 `domain.module.ts` 补 `exports`（Nest 模块导出不会自动传递）。
3. 如需复用 Agent 能力，在新模块 `imports: [AiChatModule]` 后注入 `AGENT_RUNTIME` / `AiChatService` 使用。

---

## 参与贡献

1. Fork 本仓库
2. 新建 `feat/xxx` 分支
3. 提交修改并保证 `pnpm build` 通过
4. 创建 Pull Request
