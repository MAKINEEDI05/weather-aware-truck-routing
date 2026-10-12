import type { HealthResponse } from './types'

const DEV_API_BASE_URL = 'http://127.0.0.1:8000/api/v1'

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Backend base URL without a trailing slash. Falls back to the local server only in dev. */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, '')
  }
  if (import.meta.env.DEV) {
    return DEV_API_BASE_URL
  }
  throw new ApiError('VITE_API_BASE_URL is not configured.')
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return record.status === 'ok' && typeof record.version === 'string'
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/health/`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) {
    throw new ApiError(`Health check failed with HTTP ${response.status}.`, response.status)
  }
  const body: unknown = await response.json().catch(() => null)
  if (!isHealthResponse(body)) {
    throw new ApiError('Health check returned an unexpected response.', response.status)
  }
  return body
}
