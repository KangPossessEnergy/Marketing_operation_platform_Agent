import { type ModelMessage } from "ai";
import { createInterface } from "node:readline";
import { agentLoop } from "./agent/loop";
import { createAgentRuntime } from "./agent/runtime";
import { buildSystemPrompt } from "./context";

const { model, registry } = createAgentRuntime();
const system = buildSystemPrompt();
console.log(`已注册 ${registry.getAll().length} 个工具：`);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const messages: ModelMessage[] = [];

async function ask() {
  rl.question("\nYou: ", async (input) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed === "exit") {
      console.log("Bye!");
      rl.close();
      return;
    }

    messages.push({ role: "user", content: trimmed });

    let printed = false;
    await agentLoop(model, registry, messages, system, {
      onStep: (step) => console.log(`\n--- Step ${step} ---`),
      onText: (delta) => {
        printed = true;
        process.stdout.write(delta);
      },
      onToolCall: (name, input) =>
        console.log(`  [调用: ${name}(${JSON.stringify(input)})]`),
      onToolResult: (name, output) =>
        console.log(`  [结果: ${JSON.stringify(output)}]`),
      onLoopDetected: (detection) => {
        if ('message' in detection) {
          console.warn(`  \x1b[33m${detection.message}\x1b[0m`);
        }
      },
      onRetry: (attempt, error, delayMs) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`  \x1b[31m[API 异常重试] 第 ${attempt} 次重试，等待 ${delayMs}ms，错误: ${msg}\x1b[0m`);
      },
      onContinue: () => console.log("  → 模型还在工作，继续下一步..."),
      onMaxSteps: () => console.log("\n[达到最大步数限制，强制停止]"),
    });
    if (printed) console.log();

    ask();
  });
}

console.log('智能助手 Agent v0.3 (type "exit" to quit)\n');
ask();
