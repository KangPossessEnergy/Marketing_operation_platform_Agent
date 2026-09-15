/**
 * domain —— 业务领域模块（聚合层）
 *
 * 按业务领域划分子模块，每个子模块内聚自己的
 * Controller（接口）、Service（业务逻辑）、Entity（数据模型）、Module（模块定义），
 * 并由 domain.module.ts 统一聚合后挂载到根模块。
 * 当前规划的子模块：ai-chat（账户）、health（健康检查）
 */
export {};
