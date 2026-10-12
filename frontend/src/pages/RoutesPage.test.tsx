import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeNoEligibleResponse, makePlanResponse } from '../test/fixtures'
import { mockApi, renderApp } from '../test/utils'

describe('Route comparison', () => {
  it('lists every route in rank order with its status and key figures', () => {
    mockApi()
    renderApp('/routes', { result: makePlanResponse() })

    const cards = screen.getAllByRole('article')
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'Route C, rank 1',
      'Route A, rank 2',
      'Route B, rank 3',
    ])
    expect(within(cards[0]!).getByText('Recommended')).toBeInTheDocument()
    expect(within(cards[2]!).getByText('Not recommended')).toBeInTheDocument()
    expect(within(cards[2]!).getByText('25.0 mi of No Travel conditions')).toBeInTheDocument()
    expect(within(cards[1]!).getByText('30.0 mi without a forecast (Unknown)')).toBeInTheDocument()
    expect(within(cards[0]!).getByText('1,048.2 mi')).toBeInTheDocument()
    expect(within(cards[0]!).getByText('15 h 35 m')).toBeInTheDocument()
    expect(within(cards[0]!).getByText('Arrive Wed 23:35 CDT')).toBeInTheDocument()
    expect(
      within(cards[0]!).getByRole('img', { name: /Low 898.2 mi, Moderate 125.0 mi, High 25.0 mi/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('3 routes')).toBeInTheDocument()
  })

  it('states the recommendation and the deciding criterion', () => {
    mockApi()
    renderApp('/routes', { result: makePlanResponse() })

    expect(
      screen.getByRole('link', { name: /Route C recommended — fewest High miles/ }),
    ).toHaveAttribute('href', '/recommendation')
  })

  it('shows warnings but keeps the corridor note for the heatmap', () => {
    mockApi()
    renderApp('/routes', { result: makePlanResponse() })

    const warnings = screen.getByRole('list', { name: 'Warnings' })
    expect(warnings).toHaveTextContent('Incomplete weather data.')
    expect(warnings).not.toHaveTextContent('0.5° cells')
  })

  it('selects a route from its card or from the map', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/routes', { result: makePlanResponse() })
    const layer = screen.getByTestId('route-layer')
    expect(layer).toHaveAttribute('data-selected', 'C')

    await user.click(
      within(screen.getByRole('article', { name: 'Route A, rank 2' })).getByRole('button'),
    )
    expect(layer).toHaveAttribute('data-selected', 'A')
    expect(
      within(screen.getByRole('article', { name: 'Route A, rank 2' })).getByRole('button'),
    ).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Map line B' }))
    expect(layer).toHaveAttribute('data-selected', 'B')
  })

  it('shows every route even when none can be recommended', () => {
    mockApi()
    renderApp('/routes', { result: makeNoEligibleResponse() })

    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByText('No route can be recommended.')).toBeInTheDocument()
  })

  it('reports fewer than three routes honestly', () => {
    mockApi()
    const result = makePlanResponse()
    result.routes = result.routes.filter((route) => route.id !== 'B')
    result.warnings = [
      {
        code: 'FEWER_THAN_THREE_ROUTES',
        message: 'The routing provider returned 2 routes for this trip.',
      },
    ]
    renderApp('/routes', { result })

    expect(screen.getByText('2 routes')).toBeInTheDocument()
    expect(screen.getByText('Fewer than three routes.')).toBeInTheDocument()
  })
})
