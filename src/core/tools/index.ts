import type { ToolDefinition } from "./tool-registry";
import {
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirectoryTool,
} from "./common/file-tools";
import { globTool, grepTool } from "./common/search-tools";
import { bashTool } from "./common/shell-tools";

export const allTools: ToolDefinition[] = [
  globTool,
  grepTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirectoryTool,
  bashTool,
];

export {
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirectoryTool,
  globTool,
  grepTool,
  bashTool,
};
export * from "./tool-registry";
