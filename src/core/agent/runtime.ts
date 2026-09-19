import { createOpenAI } from "@ai-sdk/openai";
import { createMockModel } from "../mock/mock-model";
import { ToolRegistry } from "../tools/tool-registry";
import { allTools } from "../tools";
import { encodeReasoningDelta } from "./reasoning";
import { relayCompatFetch } from "../../utils";

function normalizeReasoningStream(response: Response): Response {
  if (
    response.body == null ||
    !response.headers.get("content-type")?.includes("text/event-stream")
  ) {
    return response;
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = "";

  const stream = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";

        for (const line of lines) {
          controller.enqueue(encoder.encode(normalizeReasoningLine(line)));
          controller.enqueue(encoder.encode("\n"));
        }
      },
      flush(controller) {
        pending += decoder.decode();
        if (pending.length > 0) {
          controller.enqueue(encoder.encode(normalizeReasoningLine(pending)));
        }
      },
    }),
  );

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function normalizeReasoningLine(line: string): string {
  if (!line.startsWith("data:")) return line;

  const payload = line.slice("data:".length).trimStart();
  if (payload === "[DONE]") return line;

  try {
    const chunk = JSON.parse(payload);
    let changed = false;

    for (const choice of chunk.choices ?? []) {
      const delta = choice?.delta;
      if (delta == null) continue;

      const reasoning =
        typeof delta.reasoning_content === "string"
          ? delta.reasoning_content
          : typeof delta.reasoningContent === "string"
            ? delta.reasoningContent
            : "";

      if (reasoning.length === 0) continue;

      delta.content = encodeReasoningDelta(reasoning, delta.content ?? "");
      delete delta.reasoning_content;
      delete delta.reasoningContent;
      changed = true;
    }

    return changed ? `data: ${JSON.stringify(chunk)}` : line;
  } catch {
    return line;
  }
}

export function createAgentRuntime() {
  const apiKey = process.env.API_KEY;

  const customFetch: typeof fetch = async (url, init) => {
    const response = await relayCompatFetch(url, init);
    return normalizeReasoningStream(response);
  };

  const gemini = createOpenAI({
    baseURL: process.env.BASE_URL,
    apiKey: process.env.API_KEY,
    name: process.env.NAME,
    fetch: customFetch,
  });

  const model: any = apiKey ? gemini.chat(`${process.env.NAME}`) : createMockModel();

  const registry = new ToolRegistry();
  registry.register(...allTools);

  return { model, registry };
}
