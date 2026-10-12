import { ApiError, fetchHealth, getApiBaseUrl } from './client'

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
