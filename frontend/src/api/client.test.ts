import { ApiError, fetchHealth, geocode, getApiBaseUrl, planTrip } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getApiBaseUrl', () => {
  it('uses VITE_API_BASE_URL without a trailing slash', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api/v1/')

    expect(getApiBaseUrl()).toBe('https://api.example.test/api/v1')
  })

  it('falls back to the local backend in development', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('DEV', true)

    expect(getApiBaseUrl()).toBe('http://127.0.0.1:8000/api/v1')
  })

  it('throws in a production build when the URL is not configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('DEV', false)

    expect(() => getApiBaseUrl()).toThrow(ApiError)
  })
})

describe('fetchHealth', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api/v1')
  })

  it('requests the health endpoint and returns the parsed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok', version: '0.1.0' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchHealth()).resolves.toEqual({ status: 'ok', version: '0.1.0' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/health/',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('throws an ApiError carrying the HTTP status on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)))

    const error = await fetchHealth().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(503)
  })

  it('throws when the body does not match the health contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'down' })))

    await expect(fetchHealth()).rejects.toThrow('unexpected response')
  })

  it('throws when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })))

    await expect(fetchHealth()).rejects.toThrow(ApiError)
  })
})

describe('geocode and planTrip', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api/v1')
  })

  it('encodes the geocode query and returns results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ results: [{ label: 'St. Louis, MO', detail: '', lat: 38.6, lon: -90.2 }] }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const results = await geocode('St. Louis, MO')

    expect(results[0]?.label).toBe('St. Louis, MO')
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/api/v1/geocode/?q=St.%20Louis%2C%20MO',
    )
  })

  it('turns the contract error body into an ApiError with code, details and retry hint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'RATE_LIMITED', message: 'Busy.', details: { retry_after_s: 30 } },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } },
        ),
      ),
    )

    const error = (await planTrip({} as never).catch((caught: unknown) => caught)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(503)
    expect(error.code).toBe('RATE_LIMITED')
    expect(error.message).toBe('Busy.')
    expect(error.details).toEqual({ retry_after_s: 30 })
    expect(error.retryAfterS).toBe(30)
  })

  it('posts the plan request as JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ routes: [], recommendation: {}, corridor: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await planTrip({ load_weight_lb: 1 } as never)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/trips/plan/')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"load_weight_lb":1}')
  })

  it('reports a network failure as NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(geocode('Chicago')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('rejects a response that does not match the contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })))

    await expect(planTrip({} as never)).rejects.toMatchObject({ code: 'BAD_RESPONSE' })
  })

  it('passes aborts through unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))

    await expect(geocode('Chicago')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
