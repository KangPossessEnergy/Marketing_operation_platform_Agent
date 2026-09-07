import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { type ModelMessage } from "ai";
import { agentLoop } from "../agent/loop";
import { createAgentRuntime } from "../agent/runtime";
import { buildSystemPrompt } from "../context";

const { model, registry } = createAgentRuntime();
console.log(`已注册 ${registry.getAll().length} 个工具`);

const PORT = Number(process.env.PORT || 3001);

// 会话历史按 sessionId 隔离，进程重启即丢失
const sessions = new Map<string, ModelMessage[]>();

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sseWrite(res: ServerResponse, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const path = req.url?.split("?")[0];

  if (req.method === "GET" && path === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST" && path === "/api/chat") {
    let payload: {
      sessionId?: string;
      message?: string;
      reset?: boolean;
      operatorName?: string;
    };
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "请求体不是合法 JSON" }));
      return;
    }

    const message = payload.message?.trim();
    if (!message) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "message 不能为空" }));
      return;
    }

    const sessionId = payload.sessionId || "default";
    if (payload.reset || !sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
    const messages = sessions.get(sessionId)!;
    messages.push({ role: "user", content: message });

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // 动静分界线:动态部分按请求组装,日期/操作员每次取最新值
    const system = buildSystemPrompt({ operatorName: payload.operatorName });

    try {
      await agentLoop(model, registry, messages, system, {
        onStep: (step) => sseWrite(res, { type: "step", step }),
        onText: (delta) => sseWrite(res, { type: "text", delta }),
        onToolCall: (toolName, input) =>
          sseWrite(res, { type: "tool-call", toolName, input }),
        onToolResult: (toolName, output) =>
          sseWrite(res, { type: "tool-result", toolName, output }),
        onLoopDetected: (detection) =>
          sseWrite(res, { type: "loop-detected", detection }),
        onRetry: (attempt, error, delayMs) =>
          sseWrite(res, {
            type: "retry",
            attempt,
            delayMs,
            message: error instanceof Error ? error.message : String(error),
          }),
        onContinue: () => sseWrite(res, { type: "continue" }),
        onMaxSteps: () => sseWrite(res, { type: "max-steps" }),
      });
      sseWrite(res, { type: "done" });
    } catch (err) {
      sseWrite(res, {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    res.end();
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, () => {
  console.log(`Agent HTTP 服务已启动: http://localhost:${PORT}/api/chat`);
});
