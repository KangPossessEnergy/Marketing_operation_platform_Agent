import type { ToolDefinition } from '../tool-registry';
import { bizApi } from './biz-api';
import {
  PRODUCT_CATALOG,
  createRng,
  hashSeed,
  productCodeOf,
  round2,
} from './mock-utils';

// 真实接口 GET /erp/products/metrics 的返回结构（按实际 ERP 字段调整）
interface ProductMetricsResp {
  productName: string;
  productCode: string;
  category: string;
  price: number;
  sales: number;
  salesAmount: number;
  stock: number;
  warehouse: string;
  marginRate: number; // 毛利率，如 32.5 表示 32.5%
  growthRate: number; // 环比上周期，正负百分比
  dailySales: Array<{ date: string; sales: number }>; // 近7天
}

export const queryProductDataTool: ToolDefinition = {
  name: 'query_product_data',
  description:
    '查询指定商品的经营数据（单价、销量、销售额、库存、毛利率、近7天销量趋势）',
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

    try {
      const data = (await bizApi.get('/erp/products/metrics', {
        keyword: name,
        days: period,
      })) as ProductMetricsResp;

      return {
        商品名称: data.productName,
        商品编码: data.productCode,
        类目: data.category,
        统计周期: `近${period}天`,
        单价: `${data.price.toFixed(2)} 元`,
        销量: `${data.sales} 件`,
        销售额: `${data.salesAmount.toFixed(2)} 元`,
        当前库存: `${data.stock} 件（${data.warehouse}）`,
        毛利率: `${data.marginRate}%`,
        环比上周期: `${data.growthRate >= 0 ? '+' : ''}${data.growthRate}%`,
        近7天销量: data.dailySales,
      };
    } catch (err) {
      return `查询商品经营数据失败：${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const queryProductListTool: ToolDefinition = {
  name: 'query_product_list',
  description:
    '检索商品档案列表，可按关键词、类目、状态筛选，返回分页结果（编码、名称、类目、单价、库存、状态）。当前为内置模拟数据，供演示使用',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '商品名称或编码关键词，可为空' },
      category: { type: 'string', description: '类目筛选，如 "美妆个护"，可为空' },
      status: { type: 'string', description: '状态筛选：在售 / 停售，可为空' },
      page: { type: 'number', description: '页码，默认 1' },
      pageSize: { type: 'number', description: '每页条数，默认 5' },
    },
    required: [],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  // TODO 真实接口: GET /erp/products?keyword=&category=&status=&page=&pageSize=
  // return bizApi.get('/erp/products', { keyword, category, status, page, pageSize });
  execute: async ({
    keyword,
    category,
    status,
    page = 1,
    pageSize = 5,
  }: {
    keyword?: string;
    category?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const kw = (keyword ?? '').trim();
    const cat = (category ?? '').trim();
    const st = (status ?? '').trim();

    let items = PRODUCT_CATALOG.map((product) => {
      const rng = createRng(hashSeed(product.name));
      return {
        商品编码: productCodeOf(product.name),
        商品名称: product.name,
        类目: product.category,
        单价: `${round2(9.9 + rng() * 390).toFixed(2)} 元`,
        库存: `${Math.floor(rng() * 2000)} 件`,
        状态: rng() > 0.15 ? '在售' : '停售',
      };
    });

    if (kw) {
      items = items.filter((i) => i.商品名称.includes(kw) || i.商品编码.includes(kw));
    }
    if (cat) items = items.filter((i) => i.类目 === cat);
    if (st) items = items.filter((i) => i.状态 === st);

    const total = items.length;
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * pageSize;
    const list = items.slice(start, start + pageSize);

    if (total === 0) {
      return `未查询到符合条件的商品（关键词: ${kw || '无'}，类目: ${cat || '无'}，状态: ${st || '无'}）`;
    }

    return { 总数: total, 页码: `${safePage}/${Math.ceil(total / pageSize)}`, 商品列表: list };
  },
};
