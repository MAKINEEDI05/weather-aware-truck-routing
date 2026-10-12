import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeNoEligibleResponse, makeNoWeatherResponse, makePlanResponse } from '../test/fixtures'
import { apiCalls, json, mockApi, renderApp } from '../test/utils'

describe('Recommendation', () => {
  it('shows the recommended route, the explanation and the decision trace', () => {
    mockApi()
    renderApp('/recommendation', { result: makePlanResponse() })

    expect(screen.getByRole('heading', { name: 'Route C' })).toBeInTheDocument()
    expect(
      screen.getByText(/Route A ties on Severe miles \(0.0\) but has more High miles/),
    ).toBeInTheDocument()

    const trace = screen.getByRole('region', {
      name: /Decision trace · Route C vs runner-up Route A/,
    })
    const steps = within(trace).getAllByRole('listitem')
    expect(steps[0]).toHaveTextContent('Severe miles0.0 vs 0.0Tie — compare next')
    expect(steps[1]).toHaveTextContent('High miles25.0 vs 50.0Decides: Route C')
    expect(steps[2]).toHaveTextContent('Not needed')
    expect(steps[3]).toHaveTextContent('15 h 35 m vs 15 h 02 m')
    expect(steps[3]).toHaveTextContent('Not needed')
  })

  it('compares every route in rank order and explains why the others lost', () => {
    mockApi()
    renderApp('/recommendation', { result: makePlanResponse() })

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      'Route C',
      'Route A',
      'Route B',
    ])
    expect(rows[0]).toHaveTextContent('Recommended')
    expect(rows[2]).toHaveTextContent('Not eligible')

    expect(screen.getByText('Lost on priority 2 — High miles')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Same Severe miles as Route C, but it has 50.0 High miles against 25.0. Its shorter travel time (−33 min) is not considered because priority 2 already decided.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Lost on priority 1 — Severe miles')).toBeInTheDocument()
    expect(
      screen.getByText(/Separately, 25.0 mi of No Travel conditions make it ineligible./),
    ).toBeInTheDocument()
    expect(screen.getByText(/App policy:/)).toBeInTheDocument()
  })

  it('blocks the recommendation when every route has No Travel', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/recommendation', { result: makeNoEligibleResponse() })

    expect(screen.getByRole('heading', { name: 'No route can be recommended' })).toBeInTheDocument()
    expect(screen.getByText('75.0 mi No Travel')).toBeInTheDocument()
    expect(screen.queryByText(/Why not/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try a later departure' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Plan a trip' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Departure date/)).toHaveFocus()
  })

  it('explains missing weather and retries the same plan', async () => {
    const fetchMock = mockApi((url) =>
      url.endsWith('/trips/plan/') ? json(makePlanResponse()) : json({}, 404),
    )
    const user = userEvent.setup()
    renderApp('/recommendation', { result: makeNoWeatherResponse() })

    expect(
      screen.getByRole('heading', { name: 'No recommendation without forecasts' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Weather forecast unavailable.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry weather/i }))
    expect(await screen.findByRole('heading', { name: 'Route C' })).toBeInTheDocument()
    expect(apiCalls(fetchMock)).toEqual(['http://api.test/api/v1/trips/plan/'])
  })
})
