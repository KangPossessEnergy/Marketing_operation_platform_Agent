import type { ToolDefinition } from "./tool-registry";
import { BizTool } from "./biz";
import { McpTool } from "./mcp";

export const allTools: ToolDefinition[] = [...BizTool, ...McpTool];

export * from "./tool-registry";
