import type {
  ApiErrorBody,
  GeocodeResponse,
  GeocodeResult,
  HealthResponse,
  PlanRequest,
  PlanResponse,
} from './types'

const DEV_API_BASE_URL = 'http://127.0.0.1:8000/api/v1'
export const PLAN_TIMEOUT_MS = 120_000

export class ApiError extends Error {
  readonly status: number | null
  readonly code: string | null
  readonly details: Record<string, unknown>
  readonly retryAfterS: number | null

  constructor(
    message: string,
    status: number | null = null,
    code: string | null = null,
    details: Record<string, unknown> = {},
    retryAfterS: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfterS = retryAfterS
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

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false
  }
  const error = (value as { error: unknown }).error
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as Record<string, unknown>).code === 'string' &&
    typeof (error as Record<string, unknown>).message === 'string'
  )
}

/** Turns a non-2xx response into an ApiError with the contract's code, details and retry hint. */
async function errorFromResponse(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null)
  const header = Number.parseInt(response.headers.get('Retry-After') ?? '', 10)
  const retryAfterS = Number.isFinite(header) ? header : null
  if (isErrorBody(body)) {
    const details =
      typeof body.error.details === 'object' && body.error.details !== null
        ? body.error.details
        : {}
    return new ApiError(body.error.message, response.status, body.error.code, details, retryAfterS)
  }
  return new ApiError(
    `The server returned HTTP ${response.status}.`,
    response.status,
    null,
    {},
    retryAfterS,
  )
}

async function send(path: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError('The backend could not be reached.', null, 'NETWORK_ERROR')
  }
  if (!response.ok) {
    throw await errorFromResponse(response)
  }
  return response
}

async function readJson<T>(response: Response, check: (value: unknown) => boolean): Promise<T> {
  const body: unknown = await response.json().catch(() => null)
  if (!check(body)) {
    throw new ApiError(
      'The server returned an unexpected response.',
      response.status,
      'BAD_RESPONSE',
    )
  }
  return body as T
}

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const response = await send(`/geocode/?q=${encodeURIComponent(query)}`, { signal })
  const body = await readJson<GeocodeResponse>(
    response,
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      Array.isArray((value as GeocodeResponse).results),
  )
  return body.results
}

export async function planTrip(request: PlanRequest, signal?: AbortSignal): Promise<PlanResponse> {
  const response = await send('/trips/plan/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  return readJson<PlanResponse>(
    response,
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      Array.isArray((value as PlanResponse).routes) &&
      typeof (value as PlanResponse).recommendation === 'object' &&
      typeof (value as PlanResponse).corridor === 'object',
  )
}
