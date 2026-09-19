import type { ToolDefinition } from '../tool-registry';
import {
  PRODUCT_CATALOG,
  WAREHOUSES,
  createRng,
  hashSeed,
  matchCatalog,
  productCodeOf,
} from './mock-utils';

const buildWarehouseStock = (productName: string, warehouse: string) => {
  const rng = createRng(hashSeed(`${productName}@${warehouse}`));
  return {
    仓库: warehouse,
    可用库存: Math.floor(rng() * 2000),
    锁定库存: Math.floor(rng() * 100),
    在途库存: Math.floor(rng() * 500),
    安全库存: 100 + Math.floor(rng() * 200),
  };
};

export const queryInventoryTool: ToolDefinition = {
  name: 'query_inventory',
  description:
    '查询指定商品的分仓库存明细（可用/锁定/在途/安全库存），并给出补货建议。当前为内置模拟数据，供演示使用',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '商品名称或关键词，如 "气泡水"' },
    },
    required: ['keyword'],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  // TODO 真实接口: GET /erp/inventory?keyword=
  // return bizApi.get('/erp/inventory', { keyword });
  execute: async ({ keyword }: { keyword: string }) => {
    const kw = (keyword ?? '').trim();
    if (!kw) return '请提供要查询的商品名称或关键词';

    const productName = matchCatalog(kw)?.name ?? kw;
    const stocks = WAREHOUSES.map((w) => buildWarehouseStock(productName, w));
    const totalAvailable = stocks.reduce((s, x) => s + x.可用库存, 0);
    const totalInTransit = stocks.reduce((s, x) => s + x.在途库存, 0);
    const totalSafety = stocks.reduce((s, x) => s + x.安全库存, 0);

    return {
      商品名称: productName,
      商品编码: productCodeOf(productName),
      分仓库存: stocks.map((s) => ({
        ...s,
        状态: s.可用库存 < s.安全库存 ? '低于安全库存' : '正常',
      })),
      合计: {
        可用库存: totalAvailable,
        在途库存: totalInTransit,
        安全库存线: totalSafety,
      },
      补货建议:
        totalAvailable < totalSafety
          ? `当前可用库存低于安全线，建议补货 ${totalSafety * 2 - totalAvailable - totalInTransit} 件`
          : '库存充足，暂无补货需求',
    };
  },
};

export const queryStockWarningTool: ToolDefinition = {
  name: 'query_stock_warning',
  description:
    '查询库存预警名单：缺货（可用库存低于安全库存）或滞销（库存远超销量）商品。当前为内置模拟数据，供演示使用',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: '预警类型：缺货 / 滞销，为空返回全部',
      },
      limit: { type: 'number', description: '返回条数，默认 10' },
    },
    required: [],
    additionalProperties: false,
  },
  isConcurrencySafe: true,
  isReadOnly: true,
  // TODO 真实接口: GET /erp/inventory/warnings?type=&limit=
  // return bizApi.get('/erp/inventory/warnings', { type, limit });
  execute: async ({ type, limit = 10 }: { type?: string; limit?: number }) => {
    const warningType = (type ?? '').trim();

    const rows = PRODUCT_CATALOG.map((product) => {
      const rng = createRng(hashSeed(`${product.name}-warning`));
      const available = Math.floor(rng() * 400);
      const safety = 100 + Math.floor(rng() * 200);
      const sales30 = Math.floor(rng() * 800);
      const stockTotal = available + Math.floor(rng() * 3000);

      const shortage = available < safety;
      const slowMoving = !shortage && sales30 > 0 && stockTotal / Math.max(1, sales30) > 5;

      return {
        商品名称: product.name,
        商品编码: productCodeOf(product.name),
        预警类型: shortage ? '缺货' : slowMoving ? '滞销' : null,
        可用库存: available,
        安全库存: safety,
        近30天销量: sales30,
        库存总量: stockTotal,
        建议: shortage
          ? `尽快补货，建议补货 ${safety * 2 - available} 件`
          : slowMoving
            ? '库存周转超 5 个月，建议促销清仓或暂停采购'
            : null,
      };
    }).filter((r) => r.预警类型 !== null);

    const filtered = warningType
      ? rows.filter((r) => r.预警类型 === warningType)
      : rows;

    if (filtered.length === 0) {
      return `当前没有${warningType || ''}预警商品，库存状况良好`;
    }

    return {
      预警商品数: filtered.length,
      预警列表: filtered.slice(0, Math.max(1, limit)),
    };
  },
};
