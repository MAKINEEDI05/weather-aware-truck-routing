import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from '../App'
import type { PlanResponse } from '../api/types'
import type { TripDraft } from '../features/trip-form/validation'
import { HEALTH_OK } from './fixtures'

export const API = 'http://api.test/api/v1'

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>

/**
 * Installs a fetch mock that answers the health check and delegates every other request to
 * `handler`. Returns the mock so tests can count calls.
 */
export function mockApi(handler: Handler = () => json({}, 404)) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/health/')) {
      return json(HEALTH_OK)
    }
    return handler(url, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Non-health fetch calls made so far. */
export function apiCalls(fetchMock: ReturnType<typeof mockApi>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => !url.endsWith('/health/'))
}

export function renderApp(
  path: string,
  options: { result?: PlanResponse; draft?: TripDraft } = {},
) {
  vi.stubEnv('VITE_API_BASE_URL', API)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App initialResult={options.result} initialDraft={options.draft} />
    </MemoryRouter>,
  )
}
