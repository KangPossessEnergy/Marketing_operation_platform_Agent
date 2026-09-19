import type { ToolDefinition } from '../tool-registry';
import {
  CUSTOMER_NAMES,
  SALES_STAFF,
  createRng,
  daysAgo,
  formatDate,
  formatDateTime,
  hashSeed,
  pick,
  round2,
} from './mock-utils';

const MEMBER_LEVELS = ['普通会员', '银卡会员', '金卡会员', '钻石会员'];
const TAG_POOL = ['价格敏感', '品牌忠诚', '直播冲动型', '囤货型', '母婴人群', '企业采购', '高复购', '新客'];
const FOLLOW_METHODS = ['电话', '微信', '上门拜访', '邮件'];
const FOLLOW_TOPICS = [
  '回访上月采购订单使用情况，客户反馈良好',
  '介绍新品上架计划，客户有意向试销',
  '沟通账期与回款安排，约定下周对账',
  '客户咨询批量采购折扣，已报价待回复',
  '处理售后投诉，客户对补发方案表示满意',
  '邀请参加会员日活动，客户确认参加',
];

const buildCustomerProfile = (name: string) => {
  const rng = createRng(hashSeed(name));
  const totalSpend = round2(500 + rng() * 199500);
  const orderCount = 1 + Math.floor(rng() * 120);
  const lastPurchaseDays = 1 + Math.floor(rng() * 90);

  const tagCount = 2 + Math.floor(rng() * 2);
  const tags = new Set<string>();
  while (tags.size < tagCount) tags.add(pick(rng, TAG_POOL));

  return {
    客户名称: name,
    会员等级: totalSpend > 100000 ? MEMBER_LEVELS[3] : totalSpend > 30000 ? MEMBER_LEVELS[2] : totalSpend > 5000 ? MEMBER_LEVELS[1] : MEMBER_LEVELS[0],
    标签: Array.from(tags),
    累计消费: `${totalSpend.toFixed(2)} 元`,
    累计订单数: `${orderCount} 单`,
    客单价: `${round2(totalSpend / orderCount).toFixed(2)} 元`,
    最近购买: `${formatDate(daysAgo(lastPurchaseDays))}（${lastPurchaseDays} 天前）`,
    联系电话: `1${pick(rng, ['3', '5', '7', '8', '9'])}${Math.floor(rng() * 10)}****${1000 + Math.floor(rng() * 9000)}`,
    归属销售: pick(rng, SALES_STAFF),
  };
};

export const queryCustomerTool: ToolDefinition = {
  name: 'query_customer',
  description:
    '查询客户档案：会员等级、标签、累计消费、客单价、最近购买时间、归属销售。当前为内置模拟数据，供演示使用',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '客户名称或关键词，如 "杭州云创" 或 "张三"' },
    },
    required: ['keyword'],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  // TODO 真实接口: GET /crm/customers?keyword=
  // return bizApi.get('/crm/customers', { keyword });
  execute: async ({ keyword }: { keyword: string }) => {
    const kw = (keyword ?? '').trim();
    if (!kw) return '请提供要查询的客户名称或关键词';

    const matched = CUSTOMER_NAMES.filter((n) => n.includes(kw) || kw.includes(n));
    if (matched.length > 1) {
      return {
        提示: `关键词 "${kw}" 匹配到 ${matched.length} 个客户，请提供更完整的名称`,
        候选客户: matched,
      };
    }
    return buildCustomerProfile(matched[0] ?? kw);
  },
};

export const queryCustomerRfmTool: ToolDefinition = {
  name: 'query_customer_rfm',
  description:
    '查询客户 RFM 分层名单（高价值 / 流失预警 / 沉睡 / 一般），用于精细化运营。当前为内置模拟数据，供演示使用',
  parameters: {
    type: 'object',
    properties: {
      segment: {
        type: 'string',
        description: '分层筛选：高价值 / 流失预警 / 沉睡 / 一般，为空返回全部',
      },
      limit: { type: 'number', description: '返回条数，默认 10' },
    },
    required: [],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  // TODO 真实接口: GET /crm/customers/rfm?segment=&limit=
  // return bizApi.get('/crm/customers/rfm', { segment, limit });
  execute: async ({ segment, limit = 10 }: { segment?: string; limit?: number }) => {
    const seg = (segment ?? '').trim();

    let rows = CUSTOMER_NAMES.map((name) => {
      const rng = createRng(hashSeed(name));
      const totalSpend = round2(500 + rng() * 199500);
      const orderCount = 1 + Math.floor(rng() * 120);
      const lastPurchaseDays = 1 + Math.floor(rng() * 180);

      let level = '一般';
      if (totalSpend > 50000 && lastPurchaseDays <= 30) level = '高价值';
      else if (lastPurchaseDays > 60 && totalSpend > 20000) level = '流失预警';
      else if (lastPurchaseDays > 90) level = '沉睡';

      return {
        客户: name,
        分层: level,
        累计消费: `${totalSpend.toFixed(2)} 元`,
        订单数: orderCount,
        最近购买: `${lastPurchaseDays} 天前`,
        _spend: totalSpend,
      };
    }).sort((a, b) => b._spend - a._spend);

    if (seg) rows = rows.filter((r) => r.分层 === seg);
    if (rows.length === 0) return `未查询到 "${seg}" 分层的客户`;

    return {
      分层: seg || '全部',
      客户数: rows.length,
      客户列表: rows.slice(0, Math.max(1, limit)).map(({ _spend, ...rest }) => rest),
    };
  },
};

export const queryFollowRecordsTool: ToolDefinition = {
  name: 'query_follow_records',
  description:
    '查询指定客户的跟进/沟通记录，按时间倒序返回。当前为内置模拟数据，供演示使用',
  parameters: {
    type: 'object',
    properties: {
      customer: { type: 'string', description: '客户名称，如 "杭州云创科技有限公司"' },
      limit: { type: 'number', description: '返回条数，默认 5' },
    },
    required: ['customer'],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  // TODO 真实接口: GET /crm/customers/{customer}/follow-records?limit=
  // return bizApi.get(`/crm/customers/${encodeURIComponent(customer)}/follow-records`, { limit });
  execute: async ({ customer, limit = 5 }: { customer: string; limit?: number }) => {
    const name = (customer ?? '').trim();
    if (!name) return '请提供要查询的客户名称';

    const count = 3 + Math.floor(createRng(hashSeed(`${name}-follow-count`))() * 8);
    const records = Array.from({ length: Math.min(count, Math.max(1, limit)) }, (_, i) => {
      const rng = createRng(hashSeed(`${name}-follow-${i}`));
      return {
        时间: formatDateTime(daysAgo(i * 7 + Math.floor(rng() * 5))),
        方式: pick(rng, FOLLOW_METHODS),
        跟进人: pick(rng, SALES_STAFF),
        内容: pick(rng, FOLLOW_TOPICS),
      };
    });

    return { 客户: name, 跟进记录: records };
  },
};
