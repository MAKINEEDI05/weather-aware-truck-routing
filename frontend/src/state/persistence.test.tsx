import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GeocodeResult, PlanResponse } from '../api/types'
import { makePlanResponse } from '../test/fixtures'
import { apiCalls, json, mockApi, renderApp } from '../test/utils'
import type { Handler } from '../test/utils'
import { RESULT_KEY, UI_KEY, draftFromRequest, saveTripResult, saveTripUi } from './tripStorage'

// A reload is simulated by unmounting the whole app and rendering it again: in-memory state is
// gone, browser storage and the fetch mock (which counts requests) remain.

const PLACES: Record<string, GeocodeResult> = {
  chicago: { label: 'Chicago, IL', detail: 'Cook, Illinois', lat: 41.8842, lon: -87.6324 },
  denver: { label: 'Denver, CO', detail: 'Denver, Colorado', lat: 39.7392, lon: -104.9903 },
}

// Like the real backend (api/presenters.py), the response echoes the submitted inputs.
function backend(plan: () => PlanResponse = makePlanResponse): Handler {
  return (url, init) => {
    if (url.includes('/geocode/')) {
      const q = decodeURIComponent(url.split('q=')[1] ?? '').toLowerCase()
      const place = Object.entries(PLACES).find(([name]) => q.includes(name))?.[1]
      return json({ results: place ? [place] : [] })
    }
    if (url.endsWith('/trips/plan/')) {
      return json({ ...plan(), request: JSON.parse(String(init?.body)) })
    }
    return json({}, 404)
  }
}

const planCalls = (fetchMock: ReturnType<typeof mockApi>) =>
  apiCalls(fetchMock).filter((url) => url.endsWith('/trips/plan/'))

async function planChicagoDenver(user: ReturnType<typeof userEvent.setup>) {
  for (const [field, query] of [
    ['Origin', 'Chicago'],
    ['Destination', 'Denver'],
  ] as const) {
    await user.type(screen.getByLabelText(field), `${query}{Enter}`)
    const list = await screen.findByRole('list', {
      name: `Matching places for ${field.toLowerCase()}`,
    })
    await user.click(within(list).getAllByRole('button')[0]!)
  }
  await user.type(screen.getByLabelText('Load weight'), '38000')
  await user.click(screen.getByRole('button', { name: /plan routes/i }))
  await screen.findByRole('heading', { level: 1, name: 'Route comparison' })
}

/** Puts a trip in storage as a previous session would have left it. */
function seedSavedTrip(
  changes: { hour?: number; selectedRouteId?: string; loadText?: string } = {},
) {
  const result = makePlanResponse()
  const calculatedAt = Date.now() - 20 * 60_000
  saveTripResult(result, calculatedAt)
  saveTripUi(calculatedAt, {
    draft: { ...draftFromRequest(result), loadText: changes.loadText ?? '38000' },
    selectedRouteId: changes.selectedRouteId ?? 'C',
    selectedCheckpoint: null,
    hour: changes.hour ?? 0,
  })
  return result
}

describe('Trip persistence', () => {
  it('starts empty when nothing was saved, and saves nothing before a plan', async () => {
    mockApi(backend())
    const user = userEvent.setup()
    const view = renderApp('/plan')

    expect(screen.getByLabelText('Origin')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'New trip' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '10 mi' }))
    expect(window.sessionStorage.length).toBe(0)

    view.unmount()
    renderApp('/routes')
    expect(screen.getByRole('heading', { name: 'No trip planned yet' })).toBeInTheDocument()
  })

  it('saves the result, its inputs and the selected route after a successful plan', async () => {
    mockApi(backend())
    const user = userEvent.setup()
    renderApp('/plan')

    await planChicagoDenver(user)

    const saved = JSON.parse(window.sessionStorage.getItem(RESULT_KEY) ?? 'null')
    expect(saved).toMatchObject({ version: 1, result: { request: { load_weight_lb: 38000 } } })
    expect(saved.result.routes.map((r: { id: string }) => r.id)).toEqual(['A', 'B', 'C'])
    const ui = JSON.parse(window.sessionStorage.getItem(UI_KEY) ?? 'null')
    expect(ui).toMatchObject({
      version: 1,
      calculatedAt: saved.calculatedAt,
      selectedRouteId: 'C',
      draft: { origin: { label: 'Chicago, IL' }, loadText: '38000', interval: 25 },
    })
    // A fresh plan is not labelled as restored.
    expect(screen.queryByText('Restored after reload.')).not.toBeInTheDocument()
  })

  it('restores the trip after a reload without planning again, and says when it was calculated', async () => {
    const fetchMock = mockApi(backend())
    const user = userEvent.setup()
    const view = renderApp('/plan')
    await planChicagoDenver(user)
    await user.click(screen.getByRole('button', { name: 'Map line A' }))
    expect(planCalls(fetchMock)).toHaveLength(1)

    view.unmount()
    renderApp('/routes')

    expect(screen.getByRole('heading', { level: 1, name: 'Route comparison' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByTestId('route-layer')).toHaveAttribute('data-selected', 'A')
    const notice = screen.getByRole('complementary', { name: 'Results status' })
    expect(notice).toHaveTextContent('Restored after reload.')
    expect(notice).toHaveTextContent('Calculated Mon 12 Oct, 05:00 CDT (just now)')
    expect(notice).toHaveTextContent('Forecasts were not refreshed')
    expect(planCalls(fetchMock)).toHaveLength(1)
    expect(apiCalls(fetchMock).filter((url) => url.includes('/geocode/'))).toHaveLength(2)
  })

  it('keeps map selection, the heatmap slider and navigation working after a restore — with no requests', async () => {
    const fetchMock = mockApi(backend())
    const user = userEvent.setup()
    seedSavedTrip({ hour: 7, selectedRouteId: 'A' })
    renderApp('/heatmap')

    const slider = screen.getByRole('slider', { name: 'Forecast hour after departure' })
    expect(slider).toHaveValue('7')
    expect(screen.getByTestId('corridor')).toHaveAttribute('data-hour', '7')
    fireEvent.change(slider, { target: { value: '20' } })
    expect(screen.getByTestId('corridor')).toHaveAttribute('data-hour', '20')
    await user.click(screen.getByRole('button', { name: 'Map line B' }))
    expect(screen.getByTestId('route-layer')).toHaveAttribute('data-selected', 'B')

    const nav = screen.getByRole('navigation', { name: 'Primary' })
    await user.click(within(nav).getByRole('link', { name: 'Routes' }))
    await user.click(within(screen.getByRole('article', { name: /Route C/ })).getByRole('button'))
    await user.click(
      within(screen.getByRole('article', { name: /Route C/ })).getByRole('link', {
        name: 'Route details',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Mile 725' }))
    expect(screen.getByTestId('checkpoints-C')).toHaveAttribute('data-selected', '3')
    await user.click(within(nav).getByRole('link', { name: 'Recommendation' }))
    expect(screen.getByRole('heading', { name: 'Route C' })).toBeInTheDocument()

    expect(apiCalls(fetchMock)).toEqual([])
  })

  it('restores the slider position and selections saved before the reload', async () => {
    mockApi(backend())
    seedSavedTrip()
    const view = renderApp('/heatmap')
    fireEvent.change(screen.getByRole('slider'), { target: { value: '31' } })
    view.unmount()

    renderApp('/heatmap')
    expect(screen.getByRole('slider')).toHaveValue('31')
  })

  it.each([
    ['malformed JSON', () => window.sessionStorage.setItem(RESULT_KEY, '{"version":')],
    [
      'an incompatible version',
      () =>
        window.sessionStorage.setItem(
          RESULT_KEY,
          JSON.stringify({ version: 0, calculatedAt: Date.now(), result: makePlanResponse() }),
        ),
    ],
    ['an expired trip', () => saveTripResult(makePlanResponse(), Date.now() - 13 * 3_600_000)],
    [
      'a broken result',
      () => saveTripResult({ ...makePlanResponse(), corridor: null } as unknown as PlanResponse, 0),
    ],
  ])('ignores %s in storage and starts empty without crashing', (_, seed) => {
    const fetchMock = mockApi(backend())
    seed()

    renderApp('/routes')

    expect(screen.getByRole('heading', { name: 'No trip planned yet' })).toBeInTheDocument()
    expect(window.sessionStorage.getItem(RESULT_KEY)).toBeNull()
    expect(planCalls(fetchMock)).toEqual([])
  })

  it('marks results outdated when an input changes, also after a reload, until planned again', async () => {
    const fetchMock = mockApi(backend())
    const user = userEvent.setup()
    seedSavedTrip()
    const view = renderApp('/plan')
    expect(
      screen.getByText(/These inputs match results restored after a reload/),
    ).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Load weight'))
    await user.type(screen.getByLabelText('Load weight'), '45000')
    expect(
      screen.getByText('Inputs changed — plan again to update the results.'),
    ).toBeInTheDocument()
    await user.click(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
        name: 'Routes',
      }),
    )
    const notice = screen.getByRole('complementary', { name: 'Results status' })
    expect(notice).toHaveTextContent('Outdated results.')
    expect(notice).not.toHaveTextContent('Restored after reload.')
    // The trip strip still shows the inputs these results were calculated for.
    expect(screen.getByText('38,000 lb')).toBeInTheDocument()

    view.unmount()
    renderApp('/routes')
    expect(screen.getByRole('complementary', { name: 'Results status' })).toHaveTextContent(
      'Outdated results.',
    )
    expect(planCalls(fetchMock)).toEqual([])

    await user.click(screen.getByRole('link', { name: /Review and plan again/ }))
    await user.click(screen.getByRole('button', { name: /plan routes/i }))
    await screen.findByRole('heading', { level: 1, name: 'Route comparison' })
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)).load_weight_lb).toBe(45000)
    expect(screen.queryByRole('complementary', { name: 'Results status' })).not.toBeInTheDocument()
  })

  it('New trip clears the results, the form and the saved trip', async () => {
    mockApi(backend())
    const user = userEvent.setup()
    seedSavedTrip()
    const view = renderApp('/routes')

    await user.click(screen.getByRole('button', { name: 'New trip' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Plan a trip' })).toBeInTheDocument()
    expect(screen.getByLabelText('Origin')).toHaveValue('')
    expect(screen.getByLabelText('Origin')).toHaveFocus()
    expect(screen.getByLabelText('Load weight')).toHaveValue('')
    expect(window.sessionStorage.getItem(RESULT_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(UI_KEY)).toBeNull()
    await user.click(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
        name: 'Routes',
      }),
    )
    expect(screen.getByRole('heading', { name: 'No trip planned yet' })).toBeInTheDocument()

    view.unmount()
    renderApp('/routes')
    expect(screen.getByRole('heading', { name: 'No trip planned yet' })).toBeInTheDocument()
  })

  it('New trip on the planner resets an edited form too', async () => {
    mockApi(backend())
    const user = userEvent.setup()
    seedSavedTrip({ loadText: '41000' })
    renderApp('/plan')
    expect(
      screen.getByText('Inputs changed — plan again to update the results.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New trip' }))

    expect(screen.getByLabelText('Load weight')).toHaveValue('')
    expect(screen.getByLabelText('Destination')).toHaveValue('')
    expect(screen.queryByText(/Inputs changed/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New trip' })).not.toBeInTheDocument()
    expect(window.sessionStorage.length).toBe(0)
  })

  it('makes no routing or weather request after repeated reloads', async () => {
    const fetchMock = mockApi(backend())
    seedSavedTrip()
    for (const path of ['/routes', '/routes/A', '/recommendation', '/heatmap', '/plan']) {
      const view = renderApp(path)
      view.unmount()
    }
    expect(apiCalls(fetchMock)).toEqual([])
  })
})
