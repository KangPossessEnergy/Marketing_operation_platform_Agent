# Marketing_operation_platform_Agent

营销运营平台的 AI 智能助手——一个基于 Vercel AI SDK 的命令行 Agent,面向 ERP + CRM 业务场景,支持流式输出和多步工具调用。

## 技术栈

- **AI 框架**:Vercel AI SDK(`ai` + `@ai-sdk/openai`)
- **语言**:TypeScript(ESM)
- **运行时**:Node.js + tsx
- **包管理器**:pnpm(锁定版本,请勿使用 npm/yarn 安装依赖)

## 环境要求

- Node.js >= 18
- pnpm >= 8

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env   # 填入你的 API_KEY / BASE_URL / NAME

# 启动开发模式(文件变更自动重启)
pnpm dev

# 或直接运行
pnpm start

# 类型检查 / 编译
pnpm build
```

启动后进入交互式对话,输入 `exit` 退出。

> 未配置 `API_KEY` 时会自动切换到内置的 mock 模型,方便本地调试 Agent 流程,无需真实 API。

## 作为 HTTP 服务运行(供前端调用)

```bash
# 启动服务(默认端口 3001,可用 PORT 环境变量覆盖)
pnpm server

# 文件变更自动重启
pnpm server:dev
```

接口:`POST /api/chat`,请求体:

```json
{ "sessionId": "会话ID(缺省为 default,传 reset:true 清空该会话历史)", "message": "用户输入" }
```

响应为 SSE 流(`text/event-stream`),每行一个 `data: {...}` 事件:

| type | 含义 |
| --- | --- |
| `step` | Agent 第 N 步开始 |
| `text` | 模型输出的文本片段(`delta` 字段) |
| `tool-call` / `tool-result` | 工具调用及其结果 |
| `continue` | 模型还要继续下一步 |
| `done` / `error` | 本轮结束 / 出错 |

前端调用示例:

```ts
const res = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: 'user-001', message: '查一下本月销售额' }),
});
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buf = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  // 按 \n\n 切分出完整事件,去掉 'data: ' 前缀后 JSON.parse
}
```

⚠️ 服务内置了 shell/文件写入等工具,暴露到网络前请先加鉴权,不要直接对公网开放。

## 环境变量

参考 `.env.example`:

| 变量 | 说明 |
| --- | --- |
| `API_KEY` | 模型服务 API Key(留空则使用 mock 模型) |
| `BASE_URL` | OpenAI 兼容接口地址(中转地址) |
| `NAME` | 模型名称 |

## 工作原理

`src/index.ts` 进入 readline 交互循环,用户输入追加到消息历史后交给 `agentLoop`:

1. 模型流式生成回复,可能发起工具调用
2. 工具由 `ToolRegistry` 统一注册、执行,结果超长时自动截断(保留首尾)
3. 只要本轮发生了工具调用,就把工具结果带回消息历史继续下一轮,直到模型不再调用工具或达到最大步数(50 步)

内置工具:文件读写/编辑、目录列举、glob/grep 搜索、shell 命令执行(见 `src/tools/`)。系统提示词定义了 ERP + CRM 助手的能力范围与工作原则(见 `src/context/index.ts`)。

## 目录结构

```
├── src/
│   ├── index.ts               # CLI 入口:readline 交互循环
│   ├── server.ts              # HTTP 服务入口:POST /api/chat(SSE 流式)
│   ├── mock-model.ts          # 无 API_KEY 时使用的模拟模型
│   ├── agent/
│   │   ├── loop.ts            # Agent 主循环(流式输出 + 工具调用,事件回调)
│   │   └── runtime.ts         # 模型 + 工具注册的公共装配(CLI/服务共用)
│   ├── context/
│   │   └── index.ts           # 系统提示词(ERP + CRM 助手人设)
│   └── tools/
│       ├── indes.ts           # 工具汇总导出
│       ├── tool-registry.ts   # 工具注册表(注册/执行/结果截断)
│       └── CommonTool/        # 内置工具
│           ├── file-tools.ts  #   文件读写/编辑/目录列举
│           ├── search-tools.ts#   glob / grep 搜索
│           └── shell-tools.ts #   shell 命令执行
├── .env.example       # 环境变量模板
├── pnpm-workspace.yaml
└── pnpm-lock.yaml     # 锁文件(必须提交)
```

## 常见问题

### pnpm install / pnpm dev 报 ERR_PNPM_IGNORED_BUILDS

新版 pnpm 默认禁止依赖的安装脚本(postinstall),本项目已批准相关依赖的构建脚本,配置写在 **`pnpm-workspace.yaml`** 的 `allowBuilds` 字段中。该文件和 `pnpm-lock.yaml` 都必须提交到 git,不要加入 .gitignore,否则换机器/换人会复现此报错。

## 参与贡献

1. Fork 本仓库
2. 新建 Feat_xxx 分支
3. 提交代码
4. 新建 Pull Request
