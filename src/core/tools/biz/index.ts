//biz:biz” 是 “business” 的常见口语缩写，通常翻译为“业务”或“生意”，具体取决于上下文。
//此处指的是业务工具

import { ToolDefinition } from "../tool-registry";
import { queryProductDataTool, queryProductListTool } from "./product-tools";
import { queryOrdersTool, queryOrderDetailTool } from "./order-tools";
import {
  queryCustomerTool,
  queryCustomerRfmTool,
  queryFollowRecordsTool,
} from "./customer-tools";
import { queryInventoryTool, queryStockWarningTool } from "./inventory-tools";

export const BizTool: ToolDefinition[] = [
  queryProductDataTool,
  queryProductListTool,
  queryOrdersTool,
  queryOrderDetailTool,
  queryCustomerTool,
  queryCustomerRfmTool,
  queryFollowRecordsTool,
  queryInventoryTool,
  queryStockWarningTool,
];
