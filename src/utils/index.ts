/**
 * utils —— 工具函数
 *
 * 存放纯函数式的工具方法（无副作用、不依赖 Nest 容器），
 * 例如日期格式化、字符串处理、加解密、id 生成等辅助函数。
 */


/**
 * 当前中转网关在 system 角色内容超过约 200 token 时会直接返回 502（空响应体），
 * 而 user 角色无此限制。这里在请求出口统一把 system 消息改写为 user 消息绕过该限制。
 * @param url 
 * @param init 
 */
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
  return globalThis.fetch(url, init);
};

export { relayCompatFetch };
