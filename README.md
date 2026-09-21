# Marketing_operation_platform_Agent

营销运营平台的 AI 智能助手——一个基于 **NestJS + Vercel AI SDK** 的企业级全栈 Agent 系统（架构对齐 [vercel/ai examples/nest](https://github.com/vercel/ai/tree/main/examples/nest)），面向全域营销与电商运营业务场景，支持标准 UI Message Stream 流式输出、深度思考过程流式分发、双层 While + 双缓冲队列驱动引擎、多步工具调用、死循环熔断检测与 API 容错重试。

---

## 技术栈

- **Web 框架**: NestJS 11（装饰器 + 依赖注入 + nest-cli 构建）
- **AI 框架**: Vercel AI SDK（`ai` + `@ai-sdk/openai`），流式协议为 **UI Message Stream**（`createUIMessageStream` + `pipeUIMessageStreamToResponse`）
- **执行引擎**: **双层 While 循环 + 双队列缓冲 (Steering & FollowUp) + 发布订阅 (Pub/Sub) 响应式 Agent 架构**
- **参数校验**:
  - HTTP 接口层：`class-validator` + `class-transformer`（全局 NestJS `ValidationPipe`）
  - Tool 工具层：**`Zod` 强类型 Schema + 运行时自愈拦截**（`defineTool` 自动推导入参，入参错误自动反馈给 LLM 纠正）
- **工具生态体系**:
  - **自定义业务工具 (Biz Tools)**: 商品/订单/库存预警/客户RFM分析等
  - **自定义 MCP 工具 (Custom MCP Tools)**: 基于 `@modelcontextprotocol/sdk` 实现的营销定时巡检与提醒调度 (`mcp__custom__schedule_manage`)
  - **GitHub MCP 工具 (GitHub MCP Tools)**: 远程仓库 Issues / 文件内容查询等 (`mcp__github__*`)
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

## 接口文档与 Swagger UI

启动 HTTP 服务 (`pnpm start:dev`) 后，内置的 Swagger UI 会自动挂载在 `/docs` 路径下：

- **Swagger UI 访问地址**: [http://localhost:3001/docs](http://localhost:3001/docs)
- **支持的接口列表**:

| 模块 / Tag | 请求方法 | 接口路径 | 说明 | 输入 / 输出类型 |
| :--- | :--- | :--- | :--- | :--- |
| **AI 对话** | `POST` | `/api/chat` | 驱动 ReAct Agent 多步推理与工具调用，以 **UI Message Stream**（SSE）实时下发思考过程、文本流与工具事件 | `application/json` (ChatRequestDto) → `text/event-stream` |
| **健康检查** | `GET` | `/api/health` | 查询系统运行状态、启动运行时长 (Uptime) 及当前已注册的 Agent 工具总数 | 响应 `HealthResponseDto` (JSON) |

---

## 架构定位与职责边界 (Architecture Philosophy)

在营销运营平台的**微服务架构体系**下，本项目作为独立的 **AI Agent 微服务 (AI Intelligent Agent Microservice)** 运行，与**业务后端微服务 (Business Backend Service)**、**前端客户端 (Frontend Web/H5)** 协同组成完整的营销运营中台，坚持**关注点分离、轻量无状态、业务解耦**的设计哲学：

```text
                           ┌────────────────────────┐
                           │   前端客户端 (Web/H5)   │
                           └───────────┬────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │ (HTTP / SSE 流式对话)               │ (业务 CRUD / 页面操作)
                    ▼                                     ▼
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│  AI Agent 微服务 (本项目)            │     │  业务后端微服务 (NestJS/Java/Go 等)  │
│  Marketing_operation_platform_Agent  │     │  Marketing Business Backend Service  │
│                                      │     │                                      │
│ ┌──────────────────────────────────┐ │     │ ┌──────────────────────────────────┐ │
│ │ Agent 决策与执行引擎              │ │     │ │ 营销业务中心 (Campaign Core)     │ │
│ │ - 双层 While 循环 & 双队列缓冲   │ │     │ │ - 活动配置、权益发放、用户鉴权   │ │
│ │ - 深度思考流分发 & 循环熔断      │ │     │ ├──────────────────────────────────┤ │
│ ├──────────────────────────────────┤ │     │ │ 客户与画像中心 (CRM & RFM)       │ │
│ │ 工具调用与协议适配层             │ │     │ │ - 客户标签、RFM 分群、跟进记录   │ │
│ │ - 自定义业务工具 (BizTool)       │ │     │ ├──────────────────────────────────┤ │
│ │ - 本地/通用 MCP (Custom MCP)     │ │     │ │ 交易与履约中心 (Order & Product) │ │
│ │ - 外部生态 MCP (GitHub MCP 等)   │ │     │ │ - 订单明细、库存告警、商品大盘   │ │
│ └─────────────────┬────────────────┘ │     │ └──────────────────┬───────────────┘ │
└───────────────────┼──────────────────┘     └────────────────────┼─────────────────┘
                    │                                             │
                    │         微服务间 RPC / HTTP API 交互        │ (ORM / SQL)
                    └────────────────────────────────────────────►│
                                                                  ▼
                                                     ┌────────────────────────┐
                                                     │ 业务数据库 (MySQL/PG)  │
                                                     └────────────────────────┘
```

### 微服务分工与职责划分

| 服务角色 | 核心职责 | 数据与状态管理 | 典型技术栈 |
| :--- | :--- | :--- | :--- |
| **AI Agent 微服务**<br>*(本项目)* | 1. 大模型 Prompt 动态组装与上下文治理<br>2. ReAct 双层循环自主决策与工具调度<br>3. 流式分发 Reasoning 深度思考与 UI Message Stream<br>4. 循环调用拦截、API 错误容错重试 | **弱状态 / 内存会话队列**<br>不直连业务主库，不引入重型 ORM，保障高并发下的调度轻量与弹性伸缩 | NestJS 11 + Vercel AI SDK + Zod + MCP SDK |
| **业务后端微服务**<br>*(下游微服务)* | 1. 营销实体（商品、订单、客户、活动）的增删改查<br>2. 核心业务规则校验、分布式事务与权限认证<br>3. 数据库持久化与数据大盘统计<br>4. 对外暴露高内聚的 RESTful / RPC 业务接口 | **强状态 / 领域数据库**<br>负责数据的持久化治理、事务一致性与缓存管理 | 微服务框架 + ORM (Prisma / TypeORM / MyBatis) + MySQL / Redis |

- **无缝集成原则**：Agent 服务仅通过封装好的 **Tool（HTTP/RPC 客户端）** 或 **MCP 协议** 与业务微服务交互，业务微服务无需感知 Agent 内部复杂的提示词工程与推理机制，实现双方独立演进与灰度部署。

---

## 目录与模块架构

```text
src/
├── main.ts                              # 【Nest 引导入口】NestFactory / CORS / ValidationPipe / Swagger 挂载 / 优雅停机
├── app.module.ts                        # 【根模块】聚合 DomainModule、AppController、AppService
├── app.controller.ts                    # 【基础控制器】健康心跳与基础路由
├── app.service.ts                       # 【基础服务】基础业务逻辑
├── cli.ts                               # 【CLI 终端交互单机调试入口】工具数量统计、通过 AgentSession 订阅流式事件
├── utils/                               # 【通用工具】流式适配转发 (relayCompatFetch) 等
├── shared/                              # 【共享模块】公共常量与共享类型定义
├── lib/                                 # 【公共库扩展】
├── database/                            # 【数据库/持久化相关定义】
│
├── core/                                # 【核心底层底座 - AI Agent Engine & Infrastructure】
│   ├── agent/                           # Agent 核心执行引擎
│   │   ├── types.ts                     # AgentEvent 事件流规范与监听器定义
│   │   ├── constant.ts                  # 核心常量定义 (最大步数、超时时间等)
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
│   │   └── modules/                     # 提示词子模块 (identity, capabilities, principles, style, boundary, environment)
│   ├── tools/                           # 工具注册中心与工具生态体系
│   │   ├── index.ts                     # 工具统一导出入口 (allTools = BizTool + McpTool)
│   │   ├── tool-registry.ts             # 工具注册表 (Zod Schema 校验拦截、自动转换 AI SDK 工具格式、长输出截断)
│   │   ├── biz/                         # 【自定义业务工具集】
│   │   │   ├── index.ts                 # 业务工具聚合导出 (BizTool)
│   │   │   ├── biz-api.ts               # 下游业务 API 封装
│   │   │   ├── customer-tools.ts        # 客户画像与 RFM 分析工具
│   │   │   ├── order-tools.ts           # 订单列表与明细查询工具
│   │   │   ├── product-tools.ts         # 商品数据与列表查询工具
│   │   │   ├── inventory-tools.ts       # 库存管理与缺货预警工具
│   │   │   └── mock-utils.ts            # 业务数据 Mock 工具
│   │   └── mcp/                         # 【Model Context Protocol (MCP) 扩展目录】
│   │       ├── index.ts                 # MCP 聚合导出 (customMcpTools + githubMcpTools)
│   │       ├── define_mcp_tools/        # 自定义 MCP 工具 (schedule_manage 营销定时巡检与提醒)
│   │       │   └── define-mcp-tools.ts
│   │       └── github_mcp_tools/        # GitHub MCP 工具 (list_issues / get_file_contents)
│   │           └── github-mcp-tools.ts
│   └── mock/
│       └── mock-model.ts                # 本地模拟大模型 Provider
│
├── swagger/                             # 【API 文档与 Swagger UI】
│   ├── swagger.ts                       # Swagger 实例构建与挂载 (/docs)
│   ├── swagger.config.ts                # 文档元信息与 Tag 配置
│   └── swagger.interface.ts             # Swagger 配置接口类型定义
│
└── domain/                              # 【对外接口与领域分发】
    ├── index.ts                         # 领域说明文档
    ├── domain.module.ts                 # 领域聚合模块
    │
    ├── ai-chat/                         # 【AI 交互服务领域】
    │   ├── ai-chat.controller.ts        # 路由入口：POST /api/chat（标准 UI Message Stream / SSE）
    │   ├── ai-chat.services.ts          # 业务逻辑：通过 AgentSession 驱动核心流，映射为 UI Stream
    │   ├── ai-chat.dao.service.ts       # 运行时状态暂存（内存 Map / 滑动窗口历史上下文截断）
    │   ├── ai-chat.entity.ts            # 实体定义：ChatRequestDto / ChatDataParts / ChatUIMessage
    │   └── ai-chat.module.ts            # 模块组装（exports: AiChatService / AGENT_RUNTIME）
    │
    └── health/                          # 【系统监控领域】
        ├── health.controller.ts         # 路由入口：GET /api/health
        ├── health.services.ts           # 逻辑实现：汇总服务状态/运行耗时/已注册工具数
        ├── health.entity.ts             # 实体定义：HealthResponseDto
        └── health.module.ts             # 模块组装
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
