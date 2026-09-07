export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: number;
  uptime: number;
  toolsCount: number;
}
