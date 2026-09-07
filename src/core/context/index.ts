import { PromptBuilder, type PipeFn, type PromptContext } from "./prompt-builder";
import { identityPipe } from "./modules/identity";
import { capabilitiesPipe } from "./modules/capabilities";
import { principlesPipe } from "./modules/principles";
import { stylePipe } from "./modules/style";
import { boundaryPipe } from "./modules/boundary";
import { environmentPipe } from "./modules/environment";

export type { PromptContext } from "./prompt-builder";
export { PromptBuilder } from "./prompt-builder";

// ── 动静分界线 ──────────────────────────────────
// 静态模块:内容固定,注册顺序即提示词顺序,前缀稳定有利于模型侧缓存
const STATIC_PIPES: Array<[string, PipeFn]> = [
  ["identity", identityPipe],
  ["capabilities", capabilitiesPipe],
  ["principles", principlesPipe],
  ["style", stylePipe],
  ["boundary", boundaryPipe],
];
// 动态模块(environment)永远在分界线之后,每次组装注入最新上下文
const DYNAMIC_PIPES: Array<[string, PipeFn]> = [["environment", environmentPipe]];

export interface SystemPromptContext {
  currentDate?: string;
  operatorName?: string;
}

function formatCurrentDate(d = new Date()): string {
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function buildSystemPrompt(ctx: SystemPromptContext = {}): string {
  const builder = new PromptBuilder();
  for (const [name, fn] of STATIC_PIPES) {
    builder.pipe(name, fn);
  }
  // builder.pipe("environment", environmentPipe);
  for (const [name, fn] of DYNAMIC_PIPES) {
    builder.pipe(name, fn);
  }

  return builder.build({
    currentDate: ctx.currentDate ?? formatCurrentDate(),
    operatorName: ctx.operatorName ?? "未登录用户",
  });
}
