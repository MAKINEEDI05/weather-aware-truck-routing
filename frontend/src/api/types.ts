/** Response of `GET /api/v1/health/` (blueprint §9.1). */
export interface HealthResponse {
  status: 'ok'
  version: string
}
