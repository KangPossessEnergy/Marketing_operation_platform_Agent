# Marketing_operation_platform_Agent

营销运营平台的 AI 智能助手——一个基于 **NestJS + Vercel AI SDK** 的企业级全栈 Agent 系统（架构对齐 [vercel/ai examples/nest](https://github.com/vercel/ai/tree/main/examples/nest)），面向全域营销与电商运营业务场景，支持标准 UI Message Stream 流式输出、多步工具调用、循环检测与 API 容错重试。

---

## 技术栈

- **Web 框架**: NestJS 11（装饰器 + 依赖注入 + nest-cli 构建）
- **AI 框架**: Vercel AI SDK（`ai` + `@ai-sdk/openai`），流式协议为 **UI Message Stream**（`createUIMessageStream` + `pipeUIMessageStreamToResponse`）
- **参数校验**: class-validator / class-transformer（全局 ValidationPipe）
- **架构设计**: Nest 特性模块 + 领域分层（core 引擎与业务模块解耦）
- **提示词工程**: PromptBuilder Pipe (动静分界管道模式，优化 LLM KV Cache)
- **语言**: TypeScript（CommonJS 输出）
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

## HTTP API

服务默认监听 **3001** 端口（可用 `PORT` 环境变量覆盖），已开启 CORS。

### 1. 健康检查接口
- **URL**: `GET /api/health`
- **响应格式**:
```json
{
  "status": "ok",
  "timestamp": 1788815944265,
  "uptime": 15,
  "toolsCount": 7
}
```

### 2. 演示端点（对齐 vercel/ai examples/nest 的 app.controller.ts）

位于 [src/app.controller.ts](src/app.controller.ts)，演示 AI SDK 的两种标准流式用法（模型走项目统一环境变量配置，未配置 `API_KEY` 时为 mock 模型）：

- `POST /`：`streamText` + `toUIMessageStream` 直接转换输出 UI Message Stream
- `POST /stream-data`：`createUIMessageStream` 手动写入 `data-custom` 自定义数据部分后 `writer.merge` 模型流

```bash
curl -N -X POST http://localhost:3001/
curl -N -X POST http://localhost:3001/stream-data
```

### 3. AI 对话流式接口 (UI Message Stream / SSE)
- **URL**: `POST /api/chat`
- **请求体 (JSON)**（由 `ChatRequestDto` + 全局 ValidationPipe 校验，非法请求返回 400）:

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `message` | string | 是 | 用户输入文本（空白字符串会被拒绝） |
| `sessionId` | string | 否 | 会话 ID，缺省为 `default`，支持多会话隔离 |
| `reset` | boolean | 否 | 传 `true` 清空该会话历史 |
| `operatorName` | string | 否 | 操作员姓名，动态注入系统提示词 |

- **响应格式**: `text/event-stream`（AI SDK **UI Message Stream** 协议），每行一个 `data: {...}` chunk，以 `data: [DONE]` 结束。

标准 chunk 类型：

| type | 说明 | 关键字段 |
| --- | --- | --- |
| `start` / `finish` | 消息开始 / 结束 | `messageId` |
| `start-step` / `finish-step` | Agent 步骤边界 | - |
| `text-start` / `text-delta` / `text-end` | 文本块生命周期 | `id`, `delta` |
| `tool-input-available` | 工具调用入参就绪 | `toolCallId`, `toolName`, `input` |
| `tool-output-available` | 工具执行结果 | `toolCallId`, `output` |
| `error` | 异常终止 | `errorText` |

本项目自定义的 `data-*` chunk（均为 `transient: true`，不进入消息历史，对应 AI SDK `DataUIPart`）：

| type | 说明 | data 字段 |
| --- | --- | --- |
| `data-step` | Agent 第 N 步开始 | `{ step: number }` |
| `data-loop-detected` | 循环/振荡/卡死检测提醒 | `DetectionResult` |
| `data-retry` | API 异常重试事件 (429/5xx/断流) | `{ attempt, delayMs, message }` |
| `data-continue` | 模型判定需继续下一步思考 | `{}` |
| `data-max-steps` | 达到最大步数限制 (50 步) | `{ maxSteps: 50 }` |

#### 前端调用示例（AI SDK `useChat`）:

```tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: 'http://localhost:3001/api/chat' }),
});
```

#### 手动解析示例 (Fetch + readUIMessageStream):

```ts
import { readUIMessageStream } from 'ai';

const res = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'user-001',
    message: '帮我针对即将到来的中秋节，策划一份私域用户激活与裂变活动方案',
    operatorName: '运营负责人',
  }),
});

for await (const message of readUIMessageStream({ stream: res.body! })) {
  console.log(message.parts); // 逐步累积的 UI 消息
}
```

> ⚠️ **安全提示**：服务内置了 shell、文件读写等工具，暴露到网络环境前请增加鉴权（如 Nest Guard），不要直接对公网无保护开放。

---

## 环境变量配置

参考 `.env.example`:

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `API_KEY` | 模型服务 API Key (留空则自动启用 mock-model) | `sk-xxxx` |
| `BASE_URL` | OpenAI 兼容接口地址 (中转/私有网关地址) | `https://api.openai.com/v1` |
| `NAME` | 模型名称 | `gpt-4o` / `qwen-plus` |
| `PORT` | HTTP 服务监听端口 (默认: 3001) | `3001` |

---

## 提示词管道体系 (PromptBuilder Pipeline)

系统采用 **动静分界线** 设计模式组装系统提示词（位于 `src/core/context/`），实现 **前缀稳定（最大化 LLM KV Cache 命中）+ 动态环境实时注入**：

```
PromptBuilder Pipeline
┌────────────────────────────────────────────────────────┐
│ [静态管道 - Static Pipes] (固定顺序，最大化 KV 缓存)        │
│ 1. identityPipe     -> 营销运营专家身份定位             │
│ 2. capabilitiesPipe -> 目标拆解/活动策划/文案创作/数据分析  │
│ 3. principlesPipe   -> 真实数据/发布确认/合规性/口径严谨     │
│ 4. stylePipe        -> 结论先行/表格排版/启发式收敛        │
│ 5. boundaryPipe     -> 营销领域聚焦与偏航引导             │
├────────────────────────────────────────────────────────┤
│ ══════════════════ 动静分界线 ════════════════════════ │
├────────────────────────────────────────────────────────┤
│ [动态管道 - Dynamic Pipes] (每次请求最新上下文)          │
│ 6. environmentPipe  -> 当前日期、当前操作员身份信息       │
└────────────────────────────────────────────────────────┘
```

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

## 已知限制

- **循环检测状态为进程级共享**：`loop-detection.ts` 的调用指纹历史是模块级全局状态，多会话并发时会互相影响（单会话/低并发场景无感）。如需多实例水平扩展，应改造为按 sessionId 隔离的 provider。
- **会话历史为进程内存**：重启即丢，无 TTL；多实例部署需换 Redis 等外部存储。
- **内置工具为同步阻塞实现**（`execSync`/`readFileSync`），大文件/长命令会短暂阻塞事件循环。

---

## 常见问题

### 1. 端口冲突报错 `EADDRINUSE: address already in use :::3001`
若之前进程未正常退出导致 3001 端口被占：
```bash
# 方案 A: 查找并关闭残留进程
lsof -i :3001
kill -9 <PID>

# 方案 B: 指定其他端口启动
PORT=3002 pnpm start:dev
```

### 2. `pnpm install` 报 `ERR_PNPM_IGNORED_BUILDS`
本项目已在 `pnpm-workspace.yaml` 的 `allowBuilds` 字段中配置了依赖构建授权，请确保 `pnpm-workspace.yaml` 与 `pnpm-lock.yaml` 文件完整提交。

### 3. `pnpm build` 后 `dist/` 没有产物（增量构建缓存陈旧）
`nest build` 的 `deleteOutDir` 会清空 `dist/`，但 tsc 增量缓存文件若留在项目根部，tsc 会误判"无变更"而跳过产物生成。本项目已将缓存文件固定在 `dist/.tsbuildinfo`（见 `tsconfig.json` 的 `tsBuildInfoFile`），随 `dist/` 一起被清理，每次构建都会完整产出。若从旧版本升级遇到此问题，手动删除根部的 `*.tsbuildinfo` 一次即可。

---

## 参与贡献

1. Fork 本仓库
2. 新建 `feat/xxx` 分支
3. 提交修改并保证 `pnpm build` 通过
4. 创建 Pull Request
