import type { ToolDefinition } from '../tool-registry';

// 以商品名为种子的确定性伪随机:同一商品多次查询返回一致的数据
const hashSeed = (text: string): number => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash;
};

const createRng = (seed: number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const CATEGORIES = ['饮料冲调', '休闲零食', '美妆个护', '家居日用', '数码配件', '母婴用品'];
const WAREHOUSES = ['华东一仓', '华南仓', '华北仓', '西南仓'];

const pick = <T>(rng: () => number, list: T[]): T =>
  list[Math.floor(rng() * list.length)];

const formatDate = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const queryProductDataTool: ToolDefinition = {
  name: 'query_product_data',
  description:
    '查询指定商品的经营数据（单价、销量、销售额、库存、毛利率、近7天销量趋势）。当前为内置模拟数据，供演示使用',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '商品名称或关键词，如 "气泡水"' },
      days: { type: 'number', description: '统计最近多少天的销量，默认 30 天' },
    },
    required: ['keyword'],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  execute: async ({ keyword, days }: { keyword: string; days?: number }) => {
    const name = (keyword ?? '').trim();
    if (!name) return '请提供要查询的商品名称或关键词';

    const period = Math.max(1, Math.floor(days ?? 30) || 30);
    const rng = createRng(hashSeed(name));

    const price = Math.round((9.9 + rng() * 390) * 100) / 100;
    const sales = Math.floor(200 + rng() * 8000);
    const stock = Math.floor(rng() * 2000);
    const margin = Math.round(15 + rng() * 45);
    const growth = Math.round((rng() * 60 - 30) * 10) / 10;

    const dailyBase = sales / period;
    const trend: Array<{ date: string; sales: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      trend.push({
        date: formatDate(date),
        sales: Math.max(0, Math.round(dailyBase * (0.6 + rng() * 0.8))),
      });
    }

    return {
      商品名称: name,
      商品编码: `SPU${(Math.abs(hashSeed(name)) % 900000) + 100000}`,
      类目: pick(rng, CATEGORIES),
      统计周期: `近${period}天`,
      单价: `${price.toFixed(2)} 元`,
      销量: `${sales} 件`,
      销售额: `${(price * sales).toFixed(2)} 元`,
      当前库存: `${stock} 件（${pick(rng, WAREHOUSES)}）`,
      毛利率: `${margin}%`,
      环比上周期: `${growth >= 0 ? '+' : ''}${growth}%`,
      近7天销量: trend,
    };
  },
};
