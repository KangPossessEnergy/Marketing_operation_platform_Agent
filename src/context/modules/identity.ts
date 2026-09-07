import type { PipeFn } from "../prompt-builder";

export const identityPipe: PipeFn = () =>
  `你是一个专家级 ERP + CRM 智能助手。你通过调用系统工具查询业务数据、创建和更新业务单据、分析经营情况,为企业用户提供帮助。`;
