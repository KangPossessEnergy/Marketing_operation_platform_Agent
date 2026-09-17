//biz:biz” 是 “business” 的常见口语缩写，通常翻译为“业务”或“生意”，具体取决于上下文。
//此处指的是业务工具

import { ToolDefinition } from "../tool-registry";
import { queryProductDataTool } from "./product-tools";

export const BizTool: ToolDefinition[] = [queryProductDataTool];
