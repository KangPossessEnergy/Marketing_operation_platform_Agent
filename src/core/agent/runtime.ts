import { createOpenAI } from "@ai-sdk/openai";
import { createMockModel } from "../mock/mock-model";
import { ToolRegistry } from "../tools/tool-registry";
import { allTools } from "../tools";

// 当前中转网关在 system 角色内容超过约 200 token 时会直接返回 502（空响应体），
// 而 user 角色无此限制。这里在请求出口统一把 system 消息改写为 user 消息绕过该限制。
const relayCompatFetch: typeof fetch = async (url, init) => {
  if (init?.body && typeof init.body === "string") {
    try {
      const payload = JSON.parse(init.body);
      if (Array.isArray(payload?.messages)) {
        for (const message of payload.messages) {
          if (message?.role !== "system") continue;
          message.role = "user";
          if (
            typeof message.content === "string" &&
            !message.content.startsWith("[系统")
          ) {
            message.content = `[系统设定]\n${message.content}\n\n以上是你的工作设定，请在后续对话中严格遵守。`;
          }
        }
        init.body = JSON.stringify(payload);
      }
    } catch {
      // 非 JSON 请求体原样放行
    }
  }
  return fetch(url, init);
};

export function createAgentRuntime() {
  const apiKey = process.env.API_KEY;

  const gemini = createOpenAI({
    baseURL: process.env.BASE_URL,
    apiKey: process.env.API_KEY,
    name: process.env.NAME,
    fetch: relayCompatFetch,
  });

  const model: any = apiKey ? gemini.chat(`${process.env.NAME}`) : createMockModel();

  const registry = new ToolRegistry();
  registry.register(...allTools);

  return { model, registry };
}
