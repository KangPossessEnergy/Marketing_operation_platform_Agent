import 'dotenv/config';
import { createInterface } from "node:readline";
import { AgentSession } from "./core/agent/session";
import { createAgentRuntime } from "./core/agent/runtime";
import { buildSystemPrompt } from "./core/context";

const { model, registry } = createAgentRuntime();
const system = buildSystemPrompt();
console.log(`已注册 ${registry.getAll().length} 个工具：`);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const session = new AgentSession({
  model,
  registry,
  systemPrompt: system,
});

let printed = false;
let reasoningPrinted = false;

const closeReasoning = () => {
  if (reasoningPrinted) {
    process.stdout.write("\x1b[0m\n\n");
    reasoningPrinted = false;
  }
};

// 采用发布订阅模式 (Pub/Sub) 统一监听 Agent 事件流
session.subscribe((event) => {
  switch (event.type) {
    case 'step:start':
      console.log(`\n--- Step ${event.step} ---`);
      break;

    case 'reasoning:delta':
      printed = true;
      if (!reasoningPrinted) {
        process.stdout.write("\n\x1b[90m[推理] ");
        reasoningPrinted = true;
      }
      process.stdout.write(event.delta);
      break;

    case 'text:delta':
      closeReasoning();
      printed = true;
      process.stdout.write(event.delta);
      break;

    case 'tool:call':
      closeReasoning();
      console.log(`  [调用: ${event.toolName}(${JSON.stringify(event.input)})]`);
      break;

    case 'tool:result':
      closeReasoning();
      console.log(`  [结果: ${JSON.stringify(event.output)}]`);
      break;

    case 'loop:detected':
      if ('message' in event.detection) {
        console.warn(`  \x1b[33m${event.detection.message}\x1b[0m`);
      }
      break;

    case 'retry': {
      const msg = event.error instanceof Error ? event.error.message : String(event.error);
      console.warn(`  \x1b[31m[API 异常重试] 第 ${event.attempt} 次重试，等待 ${event.delayMs}ms，错误: ${msg}\x1b[0m`);
      break;
    }

    case 'continue':
      console.log("  → 模型还在工作，继续下一步...");
      break;

    case 'max-steps':
      console.log("\n[达到最大步数限制，强制停止]");
      break;

    case 'error':
      closeReasoning();
      console.error(`\n[Agent 异常]:`, event.error);
      break;
  }
});

async function ask() {
  try {
    process.stdout.write("\nYou: ");
    for await (const input of rl) {
      const trimmed = input.trim();
      if (!trimmed || trimmed === "exit") {
        console.log("Bye!");
        return;
      }

      printed = false;
      // 发送消息入队并等待本轮 Turn 执行完成
      await session.prompt(trimmed);

      closeReasoning();
      if (printed) console.log();
      process.stdout.write("\nYou: ");
    }
  } finally {
    rl.close();
  }
}

console.log('智能助手 Agent v0.3 (type "exit" to quit)\n');
void ask();

