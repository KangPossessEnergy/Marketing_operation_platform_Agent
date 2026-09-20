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
│   │   ├── ai-chat.services.ts          # 业务逻辑：通过 AgentSession 驱动核心流，映射为 UI Stream
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
