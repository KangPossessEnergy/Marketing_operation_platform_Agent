import type { ToolDefinition } from '../tool-registry';
import {
  CUSTOMER_NAMES,
  PRODUCT_CATALOG,
  createRng,
  daysAgo,
  formatDateTime,
  hashSeed,
  pick,
  round2,
} from './mock-utils';

const ORDER_STATUSES = ['待付款', '已付款', '已发货', '已完成', '已取消', '退款中'];
const CHANNELS = ['天猫旗舰店', '京东自营', '抖音小店', '微信小程序', '线下门店'];
const LOGISTICS = ['顺丰速运', '中通快递', '圆通速递', '京东物流'];
const PAY_METHODS = ['微信支付', '支付宝', '银行卡', '货到付款'];
const CITIES = ['杭州市西湖区', '上海市浦东新区', '北京市朝阳区', '深圳市南山区', '成都市武侯区'];

const TOTAL_MOCK_ORDERS = 120;

const orderNoAt = (index: number): string => {
  const seed = Math.abs(hashSeed(`order-${index}`));
  const ymd = formatDateTime(daysAgo(seed % 30)).slice(0, 10).replace(/-/g, '');
  return `SO${ymd}${1000 + (seed % 9000)}`;
};

// 订单的全部业务字段都由订单号派生,保证 query_orders 与 query_order_detail 数据一致
const buildOrder = (orderNo: string) => {
  const rng = createRng(hashSeed(orderNo));

  const customer = pick(rng, CUSTOMER_NAMES);
  const mainProduct = pick(rng, PRODUCT_CATALOG);
  const quantity = 1 + Math.floor(rng() * 50);
  const unitPrice = round2(9.9 + rng() * 390);

  const items = [{ 商品名称: mainProduct.name, 数量: quantity, 单价: unitPrice }];
  const extraCount = Math.floor(rng() * 3);
  for (let i = 0; i < extraCount; i++) {
    items.push({
      商品名称: pick(rng, PRODUCT_CATALOG).name,
      数量: 1 + Math.floor(rng() * 10),
      单价: round2(9.9 + rng() * 200),
    });
  }
  const totalAmount = round2(
    items.reduce((sum, item) => sum + item.数量 * item.单价, 0),
  );

  const status = pick(rng, ORDER_STATUSES);
  const ymd = orderNo.slice(2, 10); // SO20260901xxxx -> 20260901
  const createdAt = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)} ${`${Math.floor(rng() * 14) + 8}`.padStart(2, '0')}:${`${Math.floor(rng() * 60)}`.padStart(2, '0')}`;

  return { customer, items, totalAmount, status, channel: pick(rng, CHANNELS), createdAt };
};

export const queryOrdersTool: ToolDefinition = {
  name: 'query_orders',
  description:
    '查询订单列表，可按状态、关键词（订单号/客户/商品）筛选，返回分页结果。当前为内置模拟数据，供演示使用',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '订单号、客户名或商品名关键词，可为空' },
      status: {
        type: 'string',
        description: '订单状态筛选：待付款 / 已付款 / 已发货 / 已完成 / 已取消 / 退款中，可为空',
      },
      page: { type: 'number', description: '页码，默认 1' },
      pageSize: { type: 'number', description: '每页条数，默认 5' },
    },
    required: [],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  // TODO 真实接口: GET /erp/orders?keyword=&status=&page=&pageSize=
  // return bizApi.get('/erp/orders', { keyword, status, page, pageSize });
  execute: async ({
    keyword,
    status,
    page = 1,
    pageSize = 5,
  }: {
    keyword?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const kw = (keyword ?? '').trim();
    const st = (status ?? '').trim();

    let orders = Array.from({ length: TOTAL_MOCK_ORDERS }, (_, i) => {
      const orderNo = orderNoAt(i);
      const order = buildOrder(orderNo);
      return {
        订单号: orderNo,
        客户: order.customer,
        商品摘要: `${order.items[0].商品名称} 等${order.items.length}件`,
        金额: `${order.totalAmount.toFixed(2)} 元`,
        状态: order.status,
        渠道: order.channel,
        下单时间: order.createdAt,
      };
    }).sort((a, b) => (a.下单时间 < b.下单时间 ? 1 : -1));

    if (st) orders = orders.filter((o) => o.状态 === st);
    if (kw) {
      orders = orders.filter(
        (o) => o.订单号.includes(kw) || o.客户.includes(kw) || o.商品摘要.includes(kw),
      );
    }

    const total = orders.length;
    if (total === 0) {
      return `未查询到符合条件的订单（关键词: ${kw || '无'}，状态: ${st || '无'}）`;
    }

    const safePage = Math.max(1, page);
    const list = orders.slice((safePage - 1) * pageSize, safePage * pageSize);
    const totalAmount = round2(
      orders.reduce((sum, o) => sum + parseFloat(o.金额), 0),
    );

    return {
      总数: total,
      页码: `${safePage}/${Math.ceil(total / pageSize)}`,
      筛选结果合计金额: `${totalAmount.toFixed(2)} 元`,
      订单列表: list,
    };
  },
};

export const queryOrderDetailTool: ToolDefinition = {
  name: 'query_order_detail',
  description:
    '根据订单号查询订单详情：商品明细、金额、收货信息、物流与支付状态。当前为内置模拟数据，供演示使用',
  parameters: {
    type: 'object',
    properties: {
      orderNo: { type: 'string', description: '订单号，如 "SO202609105731"' },
    },
    required: ['orderNo'],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  // TODO 真实接口: GET /erp/orders/{orderNo}
  // return bizApi.get(`/erp/orders/${encodeURIComponent(orderNo)}`);
  execute: async ({ orderNo }: { orderNo: string }) => {
    const no = (orderNo ?? '').trim().toUpperCase();
    if (!/^SO\d{12}$/.test(no)) {
      return `订单号格式不正确: ${orderNo}。订单号格式为 SO + 8位日期 + 4位序号，可先用 query_orders 查询`;
    }

    const rng = createRng(hashSeed(`${no}-delivery`));
    const order = buildOrder(no);
    const paid = !['待付款', '已取消'].includes(order.status);

    return {
      订单号: no,
      状态: order.status,
      渠道: order.channel,
      下单时间: order.createdAt,
      客户: order.customer,
      商品明细: order.items.map((i) => ({
        商品名称: i.商品名称,
        数量: i.数量,
        单价: `${i.单价.toFixed(2)} 元`,
        小计: `${round2(i.数量 * i.单价).toFixed(2)} 元`,
      })),
      订单金额: `${order.totalAmount.toFixed(2)} 元`,
      收货信息: {
        收货人: order.customer.slice(0, 3),
        联系电话: `1${pick(rng, ['3', '5', '7', '8', '9'])}${Math.floor(rng() * 10)}****${1000 + Math.floor(rng() * 9000)}`,
        地址: pick(rng, CITIES) + '（详细地址已脱敏）',
      },
      支付信息: paid
        ? `${pick(rng, PAY_METHODS)}，已于 ${order.createdAt} 完成支付`
        : '未支付',
      物流信息: ['已发货', '已完成', '退款中'].includes(order.status)
        ? `${pick(rng, LOGISTICS)}，运单号 ${'L' + (100000000 + Math.floor(rng() * 900000000))}`
        : '未发货',
    };
  },
};
