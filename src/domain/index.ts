/**
 * domain —— 业务领域模块（聚合层）
 *
 * 按业务领域划分子模块，每个子模块内聚自己的
 * Controller（接口）、Service（业务逻辑）、DAO（数据访问）、Entity（数据模型）、Module（模块定义），
 * 并由 domain.module.ts 统一聚合后挂载到根模块。
 * 当前规划的子模块：ai-chat（AI 对话）、health（健康检查）
 */

/**
 * ai-chat —— AI 对话业务模块
 *
 * 负责营销运营平台的 AI 对话功能：SSE 流式对话、多步工具调用、多会话历史管理。
 * 目录结构：
 * - ai-chat.controller.ts    路由入口，接收 HTTP 请求（POST /api/chat，UI Message Stream / SSE）
 * - ai-chat.services.ts      业务逻辑（驱动 Agent 循环，领域事件 → UI chunk 映射）
 * - ai-chat.dao.service.ts   数据访问层（DAO），会话历史存储（内存 Map + 滑动窗口截断）
 * - ai-chat.entity.ts        数据实体定义（ChatRequestDto / ChatDataParts / ChatUIMessage）
 * - ai-chat.module.ts        模块定义，组装以上各部分（exports: AiChatService / AGENT_RUNTIME）
 */

/**
 * health —— 健康检查业务模块
 *
 * 目录结构（无持久化需求，不含 DAO）：
 * - health.controller.ts     路由入口（GET /api/health）
 * - health.services.ts       业务逻辑（汇总状态/运行时长/工具数）
 * - health.entity.ts         数据实体定义（HealthResponseDto）
 * - health.module.ts         模块定义
 */

export {};
