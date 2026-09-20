# Marketing_operation_platform_Agent

营销运营平台的 AI 智能助手——一个基于 **NestJS + Vercel AI SDK** 的企业级全栈 Agent 系统（架构对齐 [vercel/ai examples/nest](https://github.com/vercel/ai/tree/main/examples/nest)），面向全域营销与电商运营业务场景，支持标准 UI Message Stream 流式输出、深度思考过程流式分发、双层 While + 双缓冲队列驱动引擎、多步工具调用、死循环熔断检测与 API 容错重试。

---

## 技术栈

- **Web 框架**: NestJS 11（装饰器 + 依赖注入 + nest-cli 构建）
- **AI 框架**: Vercel AI SDK（`ai` + `@ai-sdk/openai`），流式协议为 **UI Message Stream**（`createUIMessageStream` + `pipeUIMessageStreamToResponse`）
- **执行引擎**: **双层 While 循环 + 双队列缓冲 (Steering & FollowUp) + 发布订阅 (Pub/Sub) 响应式 Agent 架构**
- **参数校验**: class-validator / class-transformer（全局 ValidationPipe）
- **架构设计**: Nest 特性模块 + 领域分层（core 引擎与业务模块解耦）
- **运行时**: Node.js + nest-cli / tsx（CLI）
- **包管理器**: pnpm (锁定版本，请勿使用 npm/yarn 安装依赖)

---

## 核心架构特性 (Agent Engine)

### 1. 双层 While 循环与双队列缓冲机制
参考先进的响应式 Agent 设计理念（如 Pi Agent / OpenCode），将传统的单向递归执行重构为**双层 While 循环 + 双端异步安全消息队列**：
- **`steeringQueue`（内层决策控制队列 / 转向队列）**：
  - 管理单轮决策执行（Turn）中的控制流与干涉；
  - 自动承载**工具执行结果**、**死循环检测自愈提示**以及**用户实时打断指令（Human-in-the-loop / Steer）**；
  - 内层循环在每一步决策（Step）前通过同步 `drain()` 取出全部积压的控制指令，动态纠偏模型。
- **`followUpQueue`（外层任务队列 / 延续队列）**：
  - 管理宏观轮次生命周期（Turn-level）；
  - 自动承载多轮对话输入与自动化工作流后续任务；
  - 外层循环在空闲（Idle）时异步挂起，新输入到达即刻唤醒开启下一轮交互。

### 2. 发布订阅设计模式 (Pub/Sub)
- 统一定义细粒度的 **`AgentEvent`**（`turn:start/end`, `step:start/end`, `reasoning:start/delta/end`, `text:delta`, `tool:call/result`, `loop:detected`, `retry` 等）；
- 通过门面类 **`AgentSession`** 暴露 `subscribe()`、`prompt()`、`steer()`，实现执行引擎与外层渲染层（CLI 终端高亮、Web 端 SSE 流）的完全解耦。

### 3. 深度思考过程（Reasoning）流式支持
- **底层拦截归一化**：在 HTTP 出口处通过流式拦截器拦截中转网关的 `reasoning_content`，转换为标准化标记；
- **增量流式解析**：在循环层借助有限状态机 `ReasoningMarkerParser` 分流思考过程与正文输出，避免标记泄露；
- **历史清洗与防污染**：在对话持久化前自动清洗历史记录中的思考标记，防止污染后续 Prompt 上下文；
- **多端呈现**：CLI 端实时渲染终端灰色高亮思考片段，Web 端无缝映射为标准 `reasoning-start` / `reasoning-delta` / `reasoning-end` UI Stream 事件。

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

## 架构定位与职责边界 (Architecture Philosophy)

在微服务体系下，本项目定位于 **AI 智能中枢与 ReAct 运行时引擎 (Intelligent Runtime & Gateway)**，坚持**轻量、弱状态、高内聚**的设计哲学：

```text
       [前端 / Web Client]
               │
               ▼  (HTTP / SSE 流式交互)
┌─────────────────────────────────────────────────────────────┐
│       Agent 服务 (本项目：Marketing_operation_platform_Agent)  │
│                                                             │
│  ┌───────────────────────┐        ┌──────────────────────┐  │
│  │ 核心引擎 core/agent/  │        │ 工具集成 core/tools/ │  │
│  │ - 双层 While 循环      │ ─────► │ - 内置文件/Shell     │  │
│  │ - 双队列 (Steer/Follow)│        │ - 业务接口工具 (Tool) │  │
│  │ - 思考流解析 & 熔断    │        │ - MCP 协议扩展       │  │
│  └───────────────────────┘        └──────────┬───────────┘  │
└──────────────────────────────────────────────┼──────────────┘
                                               │
                         Tool 工具调用 (HTTP / │ RPC)
                                               ▼
                              ┌─────────────────────────────────┐
                              │          业务后端服务           │
                              │ - 用户鉴权、营销实体 CRUD、任务调度  │
                              │ - 数据库治理 (Prisma / MySQL)   │
                              └─────────────────────────────────┘
```

- **Agent 服务职责**：聚焦大模型交互、Prompt 动态装配、ReAct 双层循环调度、工具调用决策与事件流的分发（不直接耦合主业务数据库，无需引入重型 ORM 如 Prisma）。
- **业务后端服务职责**：负责领域业务数据持久化、复杂事务、实体管理与常规 CRUD。Agent 仅通过封装为 Tool 的 HTTP/RPC/MCP 接口与后端交互，保持数据自治与关注点分离。

---

## 目录与模块架构

```text
src/
├── main.ts                              # 【Nest 引导入口】NestFactory / CORS / ValidationPipe / 优雅停机
├── app.module.ts                        # 【根模块】聚合各特性模块
├── app.controller.ts                    # 【演示控制器】对齐 vercel/ai examples/nest：POST / 与 POST /stream-data
├── cli.ts                               # 【CLI 终端交互单机调试入口】通过 AgentSession 订阅流式事件
│
├── core/                                # 【核心底层底座 - AI Agent Engine & Infrastructure】
│   ├── agent/                           # Agent 核心执行引擎
│   │   ├── types.ts                     # AgentEvent 事件流规范与监听器定义
│   │   ├── queue.ts                     # 异步双端安全消息队列 MessageQueue (drain / popAsync)
│   │   ├── loop.ts                      # runLoop 核心执行引擎 (双层 While: Turn 外层 + Step 内层)
│   │   ├── session.ts                   # AgentSession 对外门面 (双队列交互、生命周期、Pub/Sub)
│   │   ├── reasoning.ts                 # 思考过程流式分发解析器与转码清洗
│   │   ├── loop-detection.ts            # 循环/振荡/卡死检测 (SHA-256 参数及结果指纹)
│   │   ├── retry.ts                     # API 容错与重试机制 (指数退避 + 随机 Jitter)
│   │   └── runtime.ts                   # 运行时装配工厂 (模型加载、思考流拦截器与工具挂载)
│   ├── context/                         # 系统提示词管道 (动静分界优化 KV Cache)
│   │   ├── prompt-builder.ts            # 管道构建器 (PromptBuilder Pipe 模式)
│   │   ├── index.ts                     # 提示词拼装主入口
│   │   └── modules/                     # 提示词子模块 (identity, capabilities, principles 等)
│   ├── tools/                           # 工具注册中心与工具集
│   │   ├── index.ts                     # 工具统一导出入口
│   │   ├── tool-registry.ts             # 工具注册表 (自动转换 AI SDK Schema，长输出截断)
│   │   ├── common/                      # 基础内置工具（文件、搜索、Shell 等）
│   │   └── mcp/                         # Model Context Protocol (MCP) 扩展目录
│   └── mock/
│       └── mock-model.ts                # 本地模拟大模型 Provider
│
├── swagger/                             # 【API 文档】swagger.ts / swagger.config.ts（UI 挂载在 /docs）
├── domain/                              # 【对外接口与领域分发】
│   ├── index.ts                         # 领域说明文档
│   ├── domain.module.ts                 # 领域聚合模块
│   │
│   ├── ai-chat/                         # 【AI 交互服务领域】
│   │   ├── ai-chat.controller.ts        # 路由入口：POST /api/chat（标准 UI Message Stream / SSE）
│   │   ├── ai-chat.services.ts          # 业务逻辑：通过 AgentSession 驱动核心流，映射为 UI Stream
│   │   ├── ai-chat.dao.service.ts       # 运行时状态暂存（内存 Map / 滑动窗口历史上下文截断）
│   │   ├── ai-chat.entity.ts            # 实体定义：ChatRequestDto / ChatDataParts / ChatUIMessage
│   │   └── ai-chat.module.ts            # 模块组装（exports: AiChatService / AGENT_RUNTIME）
│   │
│   └── health/                          # 【系统监控领域】
│       ├── health.controller.ts         # 路由入口：GET /api/health
│       ├── health.services.ts           # 逻辑实现：汇总服务状态/运行耗时/已注册工具数
│       ├── health.entity.ts             # 实体定义：HealthResponseDto
│       └── health.module.ts             # 模块组装
```

---

## 业务能力接入指南 (如何扩展 Agent 工具)

在当前架构中，Agent 拓展营销业务能力（如营销文案生成、CRM 用户群画像查询、库存校验等）应**遵循 Tool 工具化接入模式**，而非在 Agent 端重复构建复杂的业务持久化实体：

1. **在 `src/core/tools/` 声明新业务工具**：
   - 编写工具定义并声明输入参数校验（基于 `zod`）；
   - 在 `execute` 回调中通过 HTTP/RPC 协议调用业务后端系统的相应 API；
   - 示例：
     ```typescript
     // src/core/tools/marketing/campaign-tools.ts
     export const fetchCampaignSegmentsTool = {
       name: 'fetch_campaign_segments',
       description: '从业务后端获取指定营销活动的目标受众分群数据',
       parameters: z.object({ campaignId: z.string() }),
       execute: async ({ campaignId }) => {
         // 调用业务后端微服务接口
         const res = await backendApiClient.get(`/api/campaigns/${campaignId}/segments`);
         return res.data;
       },
     };
     ```
2. **注册到工具中心**：
   在 `src/core/tools/index.ts` 中将工具注入 `ToolRegistry`，Agent 在 ReAct 循环推理时便会自动感知并调用该能力。
3. **（可选）通过 MCP 协议挂载外部能力**：
   若外部系统支持 Model Context Protocol (MCP)，可通过 `src/core/tools/mcp/` 直接无缝挂载。

---

## 参与贡献

1. Fork 本仓库
2. 新建 `feat/xxx` 分支
3. 提交修改并保证 `pnpm build` 通过
4. 创建 Pull Request
