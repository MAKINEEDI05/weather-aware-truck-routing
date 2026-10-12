import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import App from './App'
import { HEALTH_TIMEOUT_MS } from './api/useApiHealth'
import { makePlanResponse } from './test/fixtures'
import { mockApi, renderApp } from './test/utils'

function healthResponse(): Response {
  return new Response(JSON.stringify({ status: 'ok', version: '0.1.0' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test/api/v1')
})

function renderAt(path = '/plan') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App backend connection status', () => {
  it('shows checking, then ok with the backend version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(healthResponse()))

    renderAt()

    expect(screen.getByRole('status')).toHaveTextContent('API: checking…')
    expect(await screen.findByText('API: ok')).toBeInTheDocument()
    expect(screen.getByText('v0.1.0')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows unreachable with an explanation when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    renderAt()

    expect(await screen.findByText('API: unreachable')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('The backend could not be reached.')
  })

  it('shows the HTTP status when the backend returns an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))

    renderAt()

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

    renderAt()
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

      renderAt()
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
  it('renders the planner with the trip form and the map preview', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(healthResponse()))

    renderAt()

    expect(screen.getByRole('heading', { level: 1, name: 'Plan a trip' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Trip details' })).toBeInTheDocument()
    expect(screen.getByTestId('map')).toHaveAccessibleName('Map preview of the selected places')
    await screen.findByText('API: ok')
  })
})

describe('Navigation', () => {
  it('goes from the landing page to the trip planner', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/')

    expect(
      screen.getByRole('heading', { level: 1, name: /choose the safest route/i }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('hero-fallback')).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: /plan your trip/i })[0]!)

    expect(screen.getByRole('heading', { level: 1, name: 'Plan a trip' })).toBeInTheDocument()
  })

  it('moves between workspace pages with the sidebar', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/plan', { result: makePlanResponse() })
    const sidebar = screen.getByRole('navigation', { name: 'Primary' })

    await user.click(within(sidebar).getByRole('link', { name: 'Routes' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Route comparison' })).toBeInTheDocument()

    await user.click(within(sidebar).getByRole('link', { name: 'Recommendation' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Recommendation' })).toBeInTheDocument()

    await user.click(within(sidebar).getByRole('link', { name: 'Weather heatmap' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Weather heatmap' })).toBeInTheDocument()

    await user.click(within(sidebar).getByRole('link', { name: 'About' }))
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('has a four-tab mobile navigation', () => {
    mockApi()
    renderApp('/plan')

    const tabs = within(screen.getByRole('navigation', { name: 'Primary mobile' })).getAllByRole(
      'link',
    )
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Plan', 'Routes', 'Heatmap', 'About'])
  })

  it('shows the empty state on result pages before a trip is planned', () => {
    mockApi()
    renderApp('/heatmap')

    expect(screen.getByRole('heading', { name: 'No trip planned yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Plan a trip' })).toHaveAttribute('href', '/plan')
  })

  it('shows a not-found page for unknown paths', () => {
    mockApi()
    renderApp('/nowhere')

    expect(screen.getByRole('heading', { name: 'This page does not exist' })).toBeInTheDocument()
  })

  it('shows the About page with the assessment rules', () => {
    mockApi()
    renderApp('/about#risk-rules')

    expect(
      screen.getByRole('table', { name: 'Risk thresholds per checkpoint' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/React 19/)).toBeInTheDocument()
  })
})
