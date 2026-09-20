// src/core/tools/mcp/index.ts
// MCP 工具模块聚合导出入口
import { ToolDefinition } from '../tool-registry';
import { customMcpTools } from './define_mcp_tools/define-mcp-tools';
import { githubMcpTools } from './github_mcp_tools/github-mcp-tools';

export * from './define_mcp_tools/define-mcp-tools';
export * from './github_mcp_tools/github-mcp-tools';



/**
 * 聚合所有经过命名空间隔离的 MCP 工具集
 */
export const McpTool: ToolDefinition[] = [
  ...customMcpTools,
  ...githubMcpTools,
];
