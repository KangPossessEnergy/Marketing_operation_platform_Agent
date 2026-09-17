import type { ToolDefinition } from "./tool-registry";
import {
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirectoryTool,
} from "./common/file-tools";
import { globTool, grepTool } from "./common/search-tools";
import { bashTool } from "./common/shell-tools";
import { queryProductDataTool } from "./biz/product-tools";
import { BizTool } from "./biz";
import { CommonTool } from "./common";
import { McpTool } from "./mcp";

export const allTools: ToolDefinition[] = [
  ...BizTool,
  ...CommonTool,
  ...McpTool,
];

export {
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirectoryTool,
  globTool,
  grepTool,
  bashTool,
  queryProductDataTool,
};
export * from "./tool-registry";
