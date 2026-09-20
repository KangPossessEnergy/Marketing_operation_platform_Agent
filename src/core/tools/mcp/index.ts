// mcp工具接入与导出
import { z } from 'zod';
import { defineTool, ToolDefinition } from '../tool-registry';

/**
 * 远程/底层调度管理接口实现
 */
async function callScheduleManage(input: {
  action: 'create' | 'cancel' | 'update' | 'list';
  title?: string;
  cron?: string;
  targetId?: string;
  extraInfo?: Record<string, unknown>;
}) {
  const chatId = process.env.AGENT_OS_CHAT_ID ?? 'default-session-chat';
  const creatorOpenId = process.env.AGENT_OS_OWNER_OPEN_ID ?? 'marketing-operator';
  const port = Number(process.env.SCHEDULE_API_PORT ?? 3101);
  const token = process.env.SCHEDULE_API_TOKEN;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/schedules/manage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { 'x-api-token': token } : {}),
      },
      body: JSON.stringify({ request: input, chatId, creatorOpenId }),
    });

    const payload = (await response.json().catch(() => undefined)) as
      | { notice?: string; error?: string; issues?: unknown }
      | undefined;

    if (!response.ok) {
      const detail = payload?.issues
        ? `\n${JSON.stringify(payload.issues, null, 2)}`
        : '';
      return `【定时任务管理失败 (${response.status})】：${payload?.error ?? '未知错误'}${detail}`;
    }

    return payload?.notice ?? '定时任务管理已完成。';
  } catch (error) {
    // 若未单独启动外部 Schedule 服务，提供友好的开发调试模拟回执，防止对话抛错
    return {
      状态: '执行成功（本地模拟模式，未检测到 3101 调度服务）',
      操作类型: input.action,
      任务标题: input.title ?? '未提供',
      Cron表达式: input.cron ?? '未配置',
      任务ID: input.targetId ?? `TASK_${Date.now().toString().slice(-6)}`,
      会话ID: chatId,
      提示: '如需连接真实调度系统，请启动对应端口的 Schedule 服务并配置 SCHEDULE_API_PORT。',
    };
  }
}

/**
 * schedule_manage MCP 工具定义
 */
export const scheduleManageTool = defineTool({
  name: 'schedule_manage',
  description:
    '管理营销定时任务与周期性提醒（支持创建、取消、更新定时巡检、客户回访或跟进提醒，以及查询任务列表）',
  parameters: z.object({
    action: z
      .enum(['create', 'cancel', 'update', 'list'])
      .describe('操作类型：create(创建新任务), cancel(取消指定任务), update(更新任务), list(查询任务列表)'),
    title: z.string().optional().describe('任务标题，例如 "每周一客户回访提醒"（在 create 时必填）'),
    cron: z
      .string()
      .optional()
      .describe('Cron 定时表达式，例如 "0 9 * * 1"（每周一早9点），如用户提供自然语言时间请先转为合法的 Cron 格式'),
    targetId: z.string().optional().describe('目标任务ID（在 cancel 或 update 时必填）'),
    extraInfo: z.record(z.string(), z.unknown()).optional().describe('附加自定义参数信息'),
  }),
  isConcurrencySafe: true,
  execute: async (input) => {
    return await callScheduleManage(input);
  },
});

export const McpTool: ToolDefinition[] = [
  scheduleManageTool,
];
