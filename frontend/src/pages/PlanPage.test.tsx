import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GeocodeResult } from '../api/types'
import { emptyDraft } from '../features/trip-form/validation'
import { makePlanResponse } from '../test/fixtures'
import { apiCalls, json, mockApi, renderApp } from '../test/utils'
import type { Handler } from '../test/utils'

const PLACES: Record<string, GeocodeResult[]> = {
  chicago: [{ label: 'Chicago, IL', detail: 'Cook, Illinois', lat: 41.8842, lon: -87.6324 }],
  denver: [{ label: 'Denver, CO', detail: 'Denver, Colorado', lat: 39.7392, lon: -104.9903 }],
  springfield: [
    { label: 'Springfield, IL', detail: 'Sangamon, Illinois', lat: 39.799, lon: -89.644 },
    { label: 'Springfield, MO', detail: 'Greene, Missouri', lat: 37.209, lon: -93.292 },
    { label: 'Springfield, OH', detail: 'Clark, Ohio', lat: 39.924, lon: -83.809 },
    { label: 'Springfield, MA', detail: 'Hampden, Massachusetts', lat: 42.101, lon: -72.59 },
  ],
}

function geocodeHandler(plan: Handler = () => json(makePlanResponse())): Handler {
  return (url, init) => {
    if (url.includes('/geocode/')) {
      const q = decodeURIComponent(url.split('q=')[1] ?? '').toLowerCase()
      const key = Object.keys(PLACES).find((name) => q.includes(name))
      return key
        ? json({ results: PLACES[key] })
        : json(
            { error: { code: 'LOCATION_NOT_FOUND', message: 'No US location.', details: {} } },
            404,
          )
    }
    return plan(url, init)
  }
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  field: 'Origin' | 'Destination',
  query: string,
  choice: string,
) {
  await user.type(screen.getByLabelText(field), `${query}{Enter}`)
  const list = await screen.findByRole('list', {
    name: `Matching places for ${field.toLowerCase()}`,
  })
  await user.click(within(list).getByRole('button', { name: new RegExp(choice) }))
}

describe('Trip form', () => {
  it('finds candidates, requires a pick and allows changing it', async () => {
    mockApi(geocodeHandler())
    const user = userEvent.setup()
    renderApp('/plan')

    await user.type(screen.getByLabelText('Destination'), 'Springfield')
    await user.click(screen.getByRole('button', { name: 'Find destination' }))

    expect(await screen.findByText('4 places match. Select one to continue.')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Matching places for destination' })
    expect(within(list).getAllByRole('button')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Show 1 more' }))
    expect(within(list).getAllByRole('button')).toHaveLength(4)

    await user.click(within(list).getByRole('button', { name: /Springfield, MO/ }))
    expect(screen.getByText('Springfield, MO')).toBeInTheDocument()
    expect(screen.getByText(/Greene, Missouri · 37.209, -93.292/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change destination' }))
    expect(screen.getByLabelText('Destination')).toHaveValue('Springfield, MO')
    expect(screen.getByLabelText('Destination')).toHaveFocus()
  })

  it('explains when no US location matches', async () => {
    mockApi(geocodeHandler())
    const user = userEvent.setup()
    renderApp('/plan')

    await user.type(screen.getByLabelText('Destination'), 'Denvr, CA{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No US location found for "Denvr, CA". Check the spelling or try a nearby city.',
    )
  })

  it('keeps Plan routes disabled until both places are picked', async () => {
    mockApi(geocodeHandler())
    const user = userEvent.setup()
    renderApp('/plan')
    const submit = screen.getByRole('button', { name: /plan routes/i })

    expect(submit).toBeDisabled()
    expect(screen.getByText('Select both locations to continue.')).toBeInTheDocument()
    await pick(user, 'Origin', 'Chicago', 'Chicago, IL')
    expect(submit).toBeDisabled()
    await pick(user, 'Destination', 'Denver', 'Denver, CO')
    expect(submit).toBeEnabled()
  })

  it('shows field errors, a summary and focuses the first invalid field', async () => {
    mockApi(geocodeHandler())
    const user = userEvent.setup()
    renderApp('/plan')
    await pick(user, 'Origin', 'Chicago', 'Chicago, IL')
    await pick(user, 'Destination', 'Denver', 'Denver, CO')
    await user.type(screen.getByLabelText('Load weight'), '120000')

    await user.click(screen.getByRole('button', { name: /plan routes/i }))

    expect(screen.getByText('Enter a load weight between 0 and 100,000 lb.')).toBeInTheDocument()
    expect(screen.getByText('1 field needs attention before planning.')).toBeInTheDocument()
    expect(screen.getByLabelText('Load weight')).toHaveFocus()
    expect(screen.getByLabelText('Load weight')).toHaveAttribute('aria-invalid', 'true')
  })

  it('swaps origin and destination and switches the interval', async () => {
    mockApi(geocodeHandler())
    const user = userEvent.setup()
    renderApp('/plan')
    await pick(user, 'Origin', 'Chicago', 'Chicago, IL')
    await pick(user, 'Destination', 'Denver', 'Denver, CO')

    await user.click(screen.getByRole('button', { name: 'Swap origin and destination' }))
    expect(
      within(screen.getByRole('group', { name: 'Origin' })).getByText('Denver, CO'),
    ).toBeInTheDocument()

    expect(screen.getByRole('radio', { name: '25 mi' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: '10 mi' }))
    expect(screen.getByRole('radio', { name: '10 mi' })).toBeChecked()
  })
})

describe('Planning', () => {
  async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    await pick(user, 'Origin', 'Chicago', 'Chicago, IL')
    await pick(user, 'Destination', 'Denver', 'Denver, CO')
    await user.type(screen.getByLabelText('Load weight'), '38,000')
    await user.click(screen.getByRole('button', { name: /plan routes/i }))
  }

  it('sends the request, shows progress and opens the route comparison', async () => {
    let release: (value: Response) => void = () => {}
    const fetchMock = mockApi(
      geocodeHandler(() => new Promise<Response>((resolve) => (release = resolve))),
    )
    const user = userEvent.setup()
    renderApp('/plan')

    await fillAndSubmit(user)

    expect(await screen.findByText('Finding routes…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /planning/i })).toBeDisabled()
    const planCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/trips/plan/'))
    const body = JSON.parse(String(planCall?.[1]?.body))
    expect(body).toMatchObject({
      origin: { label: 'Chicago, IL' },
      destination: { label: 'Denver, CO' },
      load_weight_lb: 38000,
      checkpoint_interval_mi: 25,
    })
    expect(body.departure_time).toMatch(/^\d{4}-\d\d-\d\dT\d\d:00:00[+-]\d\d:\d\d$/)

    release(json(makePlanResponse()))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Route comparison' }),
    ).toBeInTheDocument()
  })

  it('shows "No truck route found" with Edit trip and Retry', async () => {
    let attempts = 0
    mockApi(
      geocodeHandler(() => {
        attempts += 1
        return attempts === 1
          ? json({ error: { code: 'NO_ROUTE_FOUND', message: 'No route.', details: {} } }, 422)
          : json(makePlanResponse())
      }),
    )
    const user = userEvent.setup()
    renderApp('/plan')

    await fillAndSubmit(user)

    expect(await screen.findByRole('heading', { name: 'No truck route found' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit trip' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Route comparison' }),
    ).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('shows the busy state with the retry hint', async () => {
    mockApi(
      geocodeHandler(() =>
        json(
          { error: { code: 'RATE_LIMITED', message: 'Busy.', details: { retry_after_s: 30 } } },
          503,
          {
            'Retry-After': '30',
          },
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp('/plan')

    await fillAndSubmit(user)

    expect(
      await screen.findByRole('heading', { name: 'Routing service is busy' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/try again in about 30 seconds/)).toBeInTheDocument()
    // Inputs are preserved for the retry.
    expect(screen.getByLabelText('Load weight')).toHaveValue('38,000')
  })

  it('explains a missing TomTom key', async () => {
    mockApi(
      geocodeHandler(() =>
        json({ error: { code: 'ROUTING_NOT_CONFIGURED', message: 'x', details: {} } }, 503),
      ),
    )
    const user = userEvent.setup()
    renderApp('/plan')

    await fillAndSubmit(user)

    expect(
      await screen.findByRole('heading', { name: 'Routing is not configured' }),
    ).toBeInTheDocument()
  })

  it('shows backend validation errors next to the fields', async () => {
    mockApi(
      geocodeHandler(() =>
        json(
          {
            error: {
              code: 'DEPARTURE_OUT_OF_RANGE',
              message: 'Outside window.',
              details: { departure_time: ['Choose a departure between now and 7 days from now.'] },
            },
          },
          400,
        ),
      ),
    )
    const user = userEvent.setup()
    renderApp('/plan')

    await fillAndSubmit(user)

    expect(
      await screen.findByText('Choose a departure between now and 7 days from now.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Planning failed' })).not.toBeInTheDocument()
  })

  it('reports an unreachable backend', async () => {
    const fetchMock = mockApi(
      geocodeHandler(() => Promise.reject(new TypeError('Failed to fetch'))),
    )
    const user = userEvent.setup()
    renderApp('/plan')

    await fillAndSubmit(user)

    await waitFor(() =>
      expect(apiCalls(fetchMock).some((u) => u.endsWith('/trips/plan/'))).toBe(true),
    )
    expect(await screen.findByRole('heading', { name: 'Backend unavailable' })).toBeInTheDocument()
  })

  it('notes when inputs differ from the current results', () => {
    mockApi()
    const result = makePlanResponse()
    renderApp('/plan', {
      result,
      draft: { ...emptyDraft(), loadText: '38000' },
    })

    expect(
      screen.getByText('Inputs changed — plan again to update the results.'),
    ).toBeInTheDocument()
  })
})
