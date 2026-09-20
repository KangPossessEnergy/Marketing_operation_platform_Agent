import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { defineTool, ToolDefinition } from '../../tool-registry';

const server = new McpServer({
  name: 'agent-os',
  version: '1.0.0',
});

const scheduleManageSchema = z.object({
  action: z
    .enum(['create', 'cancel', 'update', 'list'])
    .describe('操作类型：create(创建), cancel(取消), update(更新), list(查看列表)'),
  title: z.string().min(1).describe('任务标题，例如 "每周一客户回访提醒"'),
  cron: z.string().optional().describe('Cron 定时表达式，例如 "0 9 * * 1"（每周一早9点）'),
  targetId: z.string().optional().describe('目标任务ID（在 cancel 或 update 时必填）'),
  extraInfo: z.record(z.string(), z.unknown()).optional().describe('附加参数信息'),
});

async function callScheduleManage(input: unknown): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  const chatId = process.env.AGENT_OS_CHAT_ID;
  const creatorOpenId = process.env.AGENT_OS_OWNER_OPEN_ID;
  if (!chatId || !creatorOpenId) {
    return {
      content: [
        {
          type: 'text',
          text: '缺少 AGENT_OS_CHAT_ID / AGENT_OS_OWNER_OPEN_ID，MCP 子进程没有拿到当前会话上下文。',
        },
      ],
      isError: true,
    };
  }
  const port = Number(process.env.SCHEDULE_API_PORT ?? 3101);
  const token = process.env.SCHEDULE_API_TOKEN;
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:${port}/api/schedules/manage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { 'x-api-token': token } : {}),
      },
      body: JSON.stringify({ request: input, chatId, creatorOpenId }),
    });
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `无法连接 Agent OS 定时任务管理接口：${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
  const payload = (await response.json().catch(() => undefined)) as
    | { notice?: string; error?: string; issues?: unknown }
    | undefined;
  if (!response.ok) {
    const detail = payload?.issues
      ? `\n${JSON.stringify(payload.issues, null, 2)}`
      : '';
    return {
      content: [
        {
          type: 'text',
          text: `定时任务管理失败（${response.status}）：${payload?.error ?? '未知错误'}${detail}`,
        },
      ],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: 'text',
        text: payload?.notice ?? '定时任务管理完成。',
      },
    ],
  };
}

/**
 * 供 Agent 运行时调用的 schedule_manage MCP 工具定义
 */
export const scheduleManageTool = defineTool({
  name: 'mcp__custom__schedule_manage',
  description: '[MCP:custom] 管理营销定时任务与提醒（创建、取消、更新定时巡检或跟进任务）',
  parameters: scheduleManageSchema,
  execute: async (args) => {
    const result = await callScheduleManage(args);
    return result.content.map((c) => c.text).join('\n');
  },
});

// 注册 MCP Server 端工具
server.tool(
  'schedule_manage',
  '管理营销定时任务与提醒（创建、取消、更新定时巡检或跟进任务）',
  scheduleManageSchema.shape,
  async (args) => {
    return await callScheduleManage(args);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// 仅在直接作为独立脚本执行时启动 stdio server
if (process.argv[1]?.endsWith('define-mcp-tools.ts') || process.argv[1]?.endsWith('define-mcp-tools.js')) {
  main().catch((err) => {
    console.error('MCP Server 运行异常:', err);
    process.exit(1);
  });
}




/**
 * 自定义的本地 MCP 工具集（如通过 McpServer 独立定义并接入的工具）
 */
export const customMcpTools: ToolDefinition[] = [
  scheduleManageTool,
];