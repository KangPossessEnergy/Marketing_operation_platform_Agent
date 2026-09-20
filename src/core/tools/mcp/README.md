# MCP (Model Context Protocol) 工具接入与开发指南

本文档介绍如何在本项目中基于官方 `@modelcontextprotocol/sdk` 和 `Zod` 开发、接入及管理新的 MCP 工具。

---

## 目录结构

```text
src/core/tools/mcp/
├── README.md               # 本指南文档
├── app-tools-server.ts     # MCP Server 端实现（独立子进程/微服务）
├── index.ts                # MCP 工具接入层与导出入口（注入到 Agent 工具池）
```

---

## 核心开发步骤

在本项目中接入一个新的 MCP 工具非常简单，仅需两步：

### 第一步：在 MCP Server 中声明工具 (`app-tools-server.ts`)

在 `src/core/tools/mcp/app-tools-server.ts` 中，使用官方 `McpServer.tool()` 方法注册工具，入参通过 `zod` 声明类型与校验规则：

```typescript
import { z } from 'zod';

// 示例：新增一个发送营销短信/通知的 MCP 工具
server.tool(
  'send_marketing_message',
  '向指定分群或客户发送营销触达通知（短信/站内信/邮件）',
  {
    channel: z.enum(['sms', 'email', 'site_notice']).describe('触达渠道类型'),
    targetCustomerId: z.string().min(1).describe('目标客户ID，如 CUST_1001'),
    content: z.string().min(1).describe('通知正文内容'),
    sendTime: z.string().optional().describe('定时发送时间，不填则立即发送'),
  },
  async (args) => {
    // 1. 处理业务逻辑或调用远程系统接口
    try {
      // 业务逻辑...
      return {
        content: [
          {
            type: 'text',
            text: `已成功向客户 ${args.targetCustomerId} 发送【${args.channel}】通知`,
          },
        ],
      };
    } catch (error) {
      // 2. 异常捕获与规范返回
      return {
        content: [{ type: 'text', text: `发送失败: ${(error as Error).message}` }],
        isError: true,
      };
    }
  },
);
```

> 💡 **规范要求**：
> - MCP Server 端工具处理函数的返回值格式必须遵循 `{ content: [{ type: 'text', text: string }], isError?: boolean }` 规范。

---

### 第二步：在 Agent 工具池中暴露与接入 (`index.ts`)

在 `src/core/tools/mcp/index.ts` 中，使用 `defineTool` 将其封装并追加到 `McpTool` 数组中：

```typescript
import { z } from 'zod';
import { defineTool, ToolDefinition } from '../tool-registry';

// 1. 定义工具
export const sendMarketingMessageTool = defineTool({
  name: 'send_marketing_message',
  description: '向指定分群或客户发送营销触达通知（短信/站内信/邮件）',
  parameters: z.object({
    channel: z.enum(['sms', 'email', 'site_notice']).describe('触达渠道类型'),
    targetCustomerId: z.string().min(1).describe('目标客户ID，如 CUST_1001'),
    content: z.string().min(1).describe('通知正文内容'),
    sendTime: z.string().optional().describe('定时发送时间，不填则立即发送'),
  }),
  isConcurrencySafe: true,
  execute: async (input) => {
    // input 会被 TypeScript + Zod 自动精准推导类型
    // 可在此通过 fetch 调用对应业务接口或与 MCP Server 交互
    return {
      状态: '发送指令已提交',
      渠道: input.channel,
      客户: input.targetCustomerId,
    };
  },
});

// 2. 加入导出列表
export const McpTool: ToolDefinition[] = [
  scheduleManageTool,
  sendMarketingMessageTool, // 👈 追加新增的工具
];
```

---

## 全局生效与运行机制

无需额外配置，系统已打通全自动装配链路：

1. **自动聚合**：`src/core/tools/index.ts` 会将 `BizTool` 与 `McpTool` 聚合为 `allTools`；
2. **自动注册与校验**：`src/core/agent/runtime.ts` 会将所有工具注册至 `ToolRegistry`；
3. **自愈纠错拦截**：大模型调用工具时，如果生成参数缺失或格式不合法，`ToolRegistry` 内建的 `safeParse` 会拦截并向大模型反馈结构化错误，促使模型自动纠偏。

---

## 对话体验与测试

启动项目或 CLI 终端：
```bash
pnpm dev
```

在对话中输入自然语言提示词即可触发新工具：
- *“帮我给客户 CUST_1001 发送一条短信，内容是：感谢您对我们平台的支持，已为您发放优惠券”*
- 大模型会自动提取参数并调用 `send_marketing_message` 工具。
