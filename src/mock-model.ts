/* 让 createMockModel 返回的对象"长得像"真实模型 */


const RESPONSES: Record<string, string> = {
  default: '你好！我是模拟模型。填了 API_KEY 后会自动切换到真实的 Qwen。',
  greeting: '你好！虽然是模拟的，但流式输出的效果和真实 API 一致 :)',
  name: '你刚才告诉我了呀！我能"记住"是因为代码把对话历史传给了我。',
  intro: '我是通义千问（模拟版），在本地模拟回复，机制和真实 API 完全一致。',
};

function pickResponse(prompt: any[]): string {
  const userMsgs = (prompt || []).filter((m: any) => m.role === 'user');
  const last = userMsgs[userMsgs.length - 1];
  const text = (last?.content || []).map((c: any) => c.text || '').join('').toLowerCase();
  if (text.includes('介绍你自己') || text.includes('你是谁')) return RESPONSES.intro;
  if (text.includes('你好') || text.includes('hello')) return RESPONSES.greeting;
  if (text.includes('叫什么') || text.includes('记住')) return RESPONSES.name;
  return RESPONSES.default;
}

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function createDelayedStream(chunks: any[], delayMs = 30): ReadableStream {
  return new ReadableStream({
    start(controller) {
      let i = 0;
      function next() {
        if (i < chunks.length) {
          controller.enqueue(chunks[i++]);
          setTimeout(next, delayMs);
        } else {
          controller.close();
        }
      }
      next();
    },
  });
}

export function createMockModel() {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-model',
    get supportedUrls() { return Promise.resolve({}); },

    async doGenerate({ prompt }: any) {
      return {
        content: [{ type: 'text', text: pickResponse(prompt) }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: USAGE,
        warnings: [],
      };
    },

    async doStream({ prompt }: any) {
      const text = pickResponse(prompt);
      const id = 'text-1';

      const chunks = [
        { type: 'text-start', id },
        ...text.split('').map((char: string) => ({ type: 'text-delta', id, delta: char })),
        { type: 'text-end', id },
        { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage: USAGE },
      ];
      return { stream: createDelayedStream(chunks, 30) };
    },
  };
}
