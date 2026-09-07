import "dotenv/config";
import { createOpenAI } from "@ai-sdk/openai";
import { createMockModel } from "../mock-model";
import { ToolRegistry } from "../tools/tool-registry";
import { allTools } from "../tools/indes";

export function createAgentRuntime() {
  const apiKey = process.env.API_KEY;

  const gemini = createOpenAI({
    baseURL: process.env.BASE_URL,
    apiKey: process.env.API_KEY,
    name: process.env.NAME,
  });

  const model: any = apiKey ? gemini.chat(`${process.env.NAME}`) : createMockModel();

  const registry = new ToolRegistry();
  registry.register(...allTools);

  return { model, registry };
}
