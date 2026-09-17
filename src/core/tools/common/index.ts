//common:常用工具


import { ToolDefinition } from "../tool-registry";
import { editFileTool, listDirectoryTool, readFileTool } from "./file-tools";
import { globTool, grepTool } from "./search-tools";
import { bashTool } from "./shell-tools";

export const CommonTool: ToolDefinition[] = [
    globTool,
    grepTool,
    readFileTool,
    editFileTool,
    listDirectoryTool,
    bashTool,
];
