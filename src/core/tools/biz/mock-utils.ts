/**
 * 伪数据共享基建:所有 biz 工具的模拟数据都基于这里的基础池和确定性伪随机,
 * 保证同一个实体(商品/订单/客户)在不同工具间查到的数据互相一致。
 * 接入真实接口后,本文件可整体删除。
 */

// 以文本为种子的确定性伪随机:同一输入每次生成一致的数据
export const hashSeed = (text: string): number => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash;
};

export const createRng = (seed: number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = <T>(rng: () => number, list: readonly T[]): T =>
  list[Math.floor(rng() * list.length)];

export const formatDate = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const formatDateTime = (date: Date): string => {
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${formatDate(date)} ${hour}:${minute}`;
};

export const daysAgo = (n: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
};

export interface CatalogProduct {
  name: string;
  category: string;
}

export const PRODUCT_CATALOG: CatalogProduct[] = [
  { name: '气泡水', category: '饮料冲调' },
  { name: '冷萃咖啡豆', category: '饮料冲调' },
  { name: '每日坚果礼盒', category: '休闲零食' },
  { name: '魔芋爽', category: '休闲零食' },
  { name: '玻尿酸面膜', category: '美妆个护' },
  { name: '护手霜', category: '美妆个护' },
  { name: '氨基酸洗发水', category: '美妆个护' },
  { name: '香薰蜡烛', category: '家居日用' },
  { name: '洗衣液', category: '家居日用' },
  { name: '收纳箱', category: '家居日用' },
  { name: '蓝牙耳机', category: '数码配件' },
  { name: '充电宝', category: '数码配件' },
  { name: '手机支架', category: '数码配件' },
  { name: '纸尿裤', category: '母婴用品' },
  { name: '婴儿湿巾', category: '母婴用品' },
];

export const CUSTOMER_NAMES = [
  '杭州云创科技有限公司',
  '上海晨曦贸易有限公司',
  '北京恒信连锁超市',
  '深圳优品汇电商',
  '成都蜀香食品商行',
  '张三',
  '李四',
  '王五',
  '赵六',
  '刘七',
];

export const WAREHOUSES = ['华东一仓', '华南仓', '华北仓', '西南仓'];

export const SALES_STAFF = ['王芳', '李强', '陈静', '赵磊'];

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 商品编码:同一商品名恒定 */
export const productCodeOf = (name: string): string =>
  `SPU${(Math.abs(hashSeed(name)) % 900000) + 100000}`;

/** 在商品目录里做模糊匹配,让 list/detail/库存等工具对同一商品返回一致的类目 */
export const matchCatalog = (keyword: string): CatalogProduct | undefined =>
  PRODUCT_CATALOG.find(
    (p) => p.name === keyword || p.name.includes(keyword) || keyword.includes(p.name),
  );
