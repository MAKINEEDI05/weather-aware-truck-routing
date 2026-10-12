import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { HEALTH_TIMEOUT_MS } from './api/useApiHealth'

// Leaflet needs a real layout engine; the map is covered by manual checks, not jsdom.
vi.mock('./features/map/TripMap', () => ({
  TripMap: () => <div data-testid="trip-map" />,
}))

function healthResponse(): Response {
  return new Response(JSON.stringify({ status: 'ok', version: '0.1.0' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test/api/v1')
})

describe('App backend connection status', () => {
  it('shows checking, then ok with the backend version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(healthResponse()))

    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('API: checking…')
    expect(await screen.findByText('API: ok')).toBeInTheDocument()
    expect(screen.getByText('v0.1.0')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows unreachable with an explanation when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    render(<App />)

    expect(await screen.findByText('API: unreachable')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('The backend could not be reached.')
  })

  it('shows the HTTP status when the backend returns an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500')
    expect(screen.getByRole('status')).toHaveTextContent('API: unreachable')
  })

  it('recovers when Retry succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(healthResponse())
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('API: ok')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports a timeout when the backend does not answer', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () =>
                reject(new DOMException('Aborted', 'AbortError')),
              )
            }),
        ),
      )

      render(<App />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS)
      })

      expect(screen.getByRole('status')).toHaveTextContent('API: unreachable')
      expect(screen.getByRole('alert')).toHaveTextContent('did not respond in time')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('App shell', () => {
  it('renders the planner panel and the map region', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(healthResponse()))

    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Weather-Aware Truck Routing' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Enter a trip to compare routes.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Map' })).toContainElement(
      screen.getByTestId('trip-map'),
    )
    await screen.findByText('API: ok')
  })
})
