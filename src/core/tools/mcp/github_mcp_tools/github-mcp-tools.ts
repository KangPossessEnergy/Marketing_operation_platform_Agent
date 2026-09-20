// src/core/tools/mcp/github-mcp-tools.ts
import { z } from 'zod';
import { defineTool, ToolDefinition } from '../../tool-registry';

const GITHUB_SERVER_NAME = 'github';

/**
 * 格式化带命名空间的 MCP 工具名称: mcp__<serverName>__<toolName>
 */
export function formatMcpToolName(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`;
}

/**
 * GitHub REST API 请求辅助函数
 */
async function githubApiFetch(endpoint: string, options: RequestInit = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Marketing-Agent-App',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`GitHub API 请求失败 (${res.status}): ${errorBody || res.statusText}`);
  }

  return res.json();
}

/**
 * GitHub MCP 工具：查询仓库 Issues / Pull Requests
 * 命名空间名：mcp__github__list_issues
 */
export const githubListIssuesTool = defineTool({
  name: formatMcpToolName(GITHUB_SERVER_NAME, 'list_issues'),
  description: '[MCP:github] 查询 GitHub 指定仓库的 Issues 或 Pull Requests 列表，支持状态过滤（需要配置 GITHUB_TOKEN 环境变量）',
  parameters: z.object({
    owner: z.string().min(1).describe('仓库拥有者/组织名，例如 "vercel" 或 "facebook"'),
    repo: z.string().min(1).describe('仓库名称，例如 "ai" 或 "react"'),
    state: z.enum(['open', 'closed', 'all']).default('open').optional().describe('状态筛选：open(开启), closed(已关闭), all(全部)'),
    per_page: z.number().int().positive().max(30).default(5).optional().describe('返回条数，默认 5 条'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  execute: async ({ owner, repo, state = 'open', per_page = 5 }) => {
    try {
      const data = (await githubApiFetch(
        `/repos/${owner}/${repo}/issues?state=${state}&per_page=${per_page}`,
      )) as Array<{
        number: number;
        title: string;
        state: string;
        user?: { login: string };
        created_at: string;
        pull_request?: unknown;
        html_url: string;
      }>;

      if (!Array.isArray(data) || data.length === 0) {
        return `仓库 ${owner}/${repo} 中暂无符合条件的 Issues/PR。`;
      }

      return data.map((issue) => ({
        编号: `#${issue.number}`,
        标题: issue.title,
        状态: issue.state,
        作者: issue.user?.login ?? '未知',
        类型: issue.pull_request ? 'Pull Request' : 'Issue',
        创建时间: issue.created_at,
        链接: issue.html_url,
      }));
    } catch (err: any) {
      return `【GitHub 查询失败】：${err?.message || String(err)}`;
    }
  },
});

/**
 * GitHub MCP 工具：读取仓库指定文件内容
 * 命名空间名：mcp__github__get_file_contents
 */
export const githubGetFileContentsTool = defineTool({
  name: formatMcpToolName(GITHUB_SERVER_NAME, 'get_file_contents'),
  description: '[MCP:github] 读取 GitHub 指定仓库中某个文件的具体内容（例如 README.md、package.json 等）',
  parameters: z.object({
    owner: z.string().min(1).describe('仓库拥有者，例如 "vercel"'),
    repo: z.string().min(1).describe('仓库名称，例如 "ai"'),
    path: z.string().min(1).describe('文件路径，例如 "README.md" 或 "package.json"'),
    ref: z.string().optional().describe('分支名或 Commit Hash，默认为主分支'),
  }),
  isReadOnly: true,
  isConcurrencySafe: true,
  execute: async ({ owner, repo, path, ref }) => {
    try {
      const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const data = (await githubApiFetch(
        `/repos/${owner}/${repo}/contents/${path}${query}`,
      )) as { type: string; content?: string };

      if (data.type !== 'file' || !data.content) {
        return `指定路径不是有效的文件或内容为空`;
      }

      const fileContent = Buffer.from(data.content, 'base64').toString('utf-8');
      return fileContent;
    } catch (err: any) {
      return `【获取 GitHub 文件失败】：${err?.message || String(err)}`;
    }
  },
});

export const githubMcpTools: ToolDefinition[] = [
  githubListIssuesTool,
  githubGetFileContentsTool,
];
