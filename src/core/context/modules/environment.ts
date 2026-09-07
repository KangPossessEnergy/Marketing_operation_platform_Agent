import type { PipeFn } from "../prompt-builder";

/** 动态模块:内容随每次组装时的上下文变化,必须注册在所有静态模块之后 */
// export const environmentPipe: PipeFn = (ctx) => `## 当前环境

// - 当前日期:${ctx.currentDate}(涉及"今天""本月""最近"等相对时间时,据此换算)
// - 当前操作员:${ctx.operatorName}`;

/** 暂时不加动态，要不然每次浪费token*/
export const environmentPipe: PipeFn = (ctx) => `## 当前环境

- 当前操作员:${ctx.operatorName}`;
