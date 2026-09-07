import type { PipeFn } from "../prompt-builder";

export const boundaryPipe: PipeFn = () =>
  `如果用户的问题与 ERP/CRM 业务无关,礼貌地说明你的职责范围,并尽量引导回业务场景。`;
