# Marketing_operation_platform_Agent

营销运营平台的 AI 智能助手——一个基于 Vercel AI SDK 的企业级全栈 Agent 系统，面向全域营销与电商运营业务场景，支持流式输出、多步工具调用、循环检测与 API 容错重试。

---

## 技术栈

- **AI 框架**: Vercel AI SDK (`ai` + `@ai-sdk/openai`)
- **架构设计**: DDD (领域驱动设计) / 模块化分层架构
- **提示词工程**: PromptBuilder Pipe (动静分界管道模式，优化 LLM KV Cache)
- **语言**: TypeScript (ESM)
- **运行时**: Node.js + tsx
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

# 3. 启动 CLI 交互式终端 (开发模式，文件变更自动重启)
pnpm dev

# 或直接运行 CLI
pnpm start

# 4. 类型检查 / 编译
pnpm build
```

启动后进入交互式对话，输入 `exit` 退出。

> 💡 未配置 `API_KEY` 时会自动切换到内置的 mock 模型，方便本地无鉴权调试 Agent 流程。

---

## 作为 HTTP 服务运行 (供前端/第三方调用)

```bash
# 启动 HTTP 服务 (默认端口 3001，可用 PORT 环境变量覆盖)
pnpm server

# 开发模式 (支持热重载)
pnpm server:dev
```

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

### 2. AI 对话流式接口 (SSE)
- **URL**: `POST /api/chat`
- **请求体 (JSON)**:
```json
{
  "sessionId": "会话ID(缺省为 default，支持多会话隔离)",
  "message": "用户输入文本",
  "reset": false,       // 传 true 可清空该会话历史
  "operatorName": "操作员姓名(可选，动态注入系统提示词)"
}
```

- **响应格式**: `text/event-stream; charset=utf-8`，每行一个 `data: {...}` 事件：

| type | 说明 | 负载字段 |
| --- | --- | --- |
| `step` | Agent 第 N 步开始 | `step: number` |
| `text` | 模型增量流式文本片段 | `delta: string` |
| `tool-call` | 发起工具调用 | `toolName: string, input: unknown` |
| `tool-result` | 工具执行返回结果 | `toolName: string, output: unknown` |
| `loop-detected` | 循环/振荡/卡死检测提醒 | `detection: DetectionResult` |
| `retry` | API 异常重试事件 (429/5xx/断流) | `attempt: number, delayMs: number, message: string` |
| `continue` | 模型判定需继续下一步思考 | - |
| `max-steps` | 达到最大步数限制 (50 步) | - |
| `done` | 对话完成 | - |
| `error` | 异常错误终止 | `message: string` |

#### 前端调用示例 (Fetch + SSE 流解析):
```ts
const res = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'user-001',
    message: '帮我针对即将到来的中秋节，策划一份私域用户激活与裂变活动方案',
    operatorName: '运营负责人',
  }),
});

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buf = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  
  const lines = buf.split('\n\n');
  buf = lines.pop() || '';
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      console.log('SSE Event:', event);
    }
  }
}
```

> ⚠️ **安全提示**：服务内置了 shell、文件读写等工具，暴露到网络环境前请增加鉴权中间件，不要直接对公网无保护开放。

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

## 企业级架构设计 (DDD / 模块化分层)

本项目采用 **领域驱动设计 (DDD)** 与 **核心引擎与业务模块解耦** 架构模式：

```text
src/
├── core/                                # 【核心底层底座 - AI Agent Engine & Infrastructure】
│   ├── agent/                           # Agent 执行引擎
│   │   ├── loop.ts                      # ReAct 核心执行循环 (单步迭代驱动)
│   │   ├── loop-detection.ts            # 循环/振荡/卡死检测 (SHA-256 参数及结果指纹)
│   │   ├── retry.ts                     # API 容错与重试机制 (指数退避 + 随机 Jitter)
│   │   └── runtime.ts                   # 运行时装配 (模型加载与工具挂载)
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
├── modules/                             # 【业务领域模块 - Domain Modules】
│   ├── ai-chat/                         # 【AI 对话领域】
│   │   ├── controllers/                 # 控制器：chat.controller.ts (参数校验、SSE 驱动)
│   │   ├── services/                    # 领域服务：chat.service.ts, session.service.ts (滑动窗口防爆炸)
│   │   ├── sse/                         # SSE 协议传输层：sse-stream.ts (断连监听、保活)
│   │   ├── types/                       # 契约定义：chat.types.ts
│   │   └── index.ts                     # 模块导出入口
│   │
│   ├── health/                          # 【系统健康监控领域】
│   │   ├── controllers/                 # health.controller.ts
│   │   └── types/                       # health.types.ts
│   │
│   ├── marketing/                       # 【可扩展业务：智能营销活动/文案批量生成】
│   │   └── ...
│   ├── crm/                             # 【可扩展业务：CRM 客户线索跟进与画像】
│   │   └── ...
│   ├── erp/                             # 【可扩展业务：ERP 进销存/采购单据流】
│   │   └── ...
│   └── auth/                            # 【可扩展业务：统一鉴权/权限模块】
│       └── ...
│
├── server/                              # 【HTTP 服务宿主】
│   ├── index.ts                         # 服务启动入口 (端口监听、优雅停机 SIGINT/SIGTERM)
│   └── app.ts                           # 路由分发器、CORS 中间件与全局 500 异常兜底
│
└── index.ts                             # CLI 终端交互单机调试入口
```

---

## 业务模块拓展指南 (如何添加新 Domain)

得益于 `src/modules/` 架构的高内聚设计，添加新业务模块极为简便：

1. **创建新模块目录**（例如创建智能营销文案模块 `src/modules/marketing/`）：
   ```text
   src/modules/marketing/
   ├── controllers/
   │   └── marketing.controller.ts      # 接收营销生成请求
   ├── services/
   │   └── marketing.service.ts         # 编排营销 Agent 与特定 Prompt
   ├── types/
   │   └── marketing.types.ts           # DTO 定义
   └── index.ts
   ```
2. **挂载路由至 [src/server/app.ts](src/server/app.ts)**：
   在 `app.ts` 中引入对应模块的 Controller，即可无缝支持新业务端点，无需侵入 `core/` Agent 核心引擎。

---

## 常见问题

### 1. 端口冲突报错 `EADDRINUSE: address already in use :::3001`
若之前进程未正常退出导致 3001 端口被占：
```bash
# 方案 A: 查找并关闭残留进程
lsof -i :3001
kill -9 <PID>

# 方案 B: 指定其他端口启动
PORT=3002 pnpm run server:dev
```

### 2. `pnpm install` 报 `ERR_PNPM_IGNORED_BUILDS`
本项目已在 `pnpm-workspace.yaml` 的 `allowBuilds` 字段中配置了依赖构建授权，请确保 `pnpm-workspace.yaml` 与 `pnpm-lock.yaml` 文件完整提交。

---

## 参与贡献

1. Fork 本仓库
2. 新建 `feat/xxx` 分支
3. 提交修改并保证 `pnpm build` 通过
4. 创建 Pull Request
