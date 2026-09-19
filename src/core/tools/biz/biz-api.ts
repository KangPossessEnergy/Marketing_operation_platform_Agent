/**
 * 业务系统(ERP/CRM)真实接口客户端 —— 预留,当前未被使用。
 *
 * 接入步骤:
 * 1. 在 .env 中配置 BIZ_API_BASE_URL(如 https://erp.example.com/api)和 BIZ_API_TOKEN
 * 2. 打开各 biz 工具 execute 中标记了 "TODO 真实接口" 的注释,
 *    用 bizApi.get/post 替换对应的模拟数据逻辑
 * 3. 全部替换完成后删除同目录下的 mock-utils.ts
 */

const buildQuery = (params?: Record<string, unknown>): string => {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

const request = async (
  method: 'GET' | 'POST',
  path: string,
  payload?: Record<string, unknown>,
): Promise<unknown> => {
  const baseUrl = process.env.BIZ_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('真实业务接口未接入:请先配置 BIZ_API_BASE_URL');
  }

  const url =
    method === 'GET' ? `${baseUrl}${path}${buildQuery(payload)}` : `${baseUrl}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.BIZ_API_TOKEN ?? ''}`,
    },
    body: method === 'POST' ? JSON.stringify(payload ?? {}) : undefined,
  });

  if (!res.ok) {
    throw new Error(`业务接口请求失败: ${method} ${path} -> HTTP ${res.status}`);
  }
  return res.json();
};

export const bizApi = {
  get: (path: string, params?: Record<string, unknown>) => request('GET', path, params),
  post: (path: string, body?: Record<string, unknown>) => request('POST', path, body),
};
