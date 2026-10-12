import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makePlanResponse } from '../test/fixtures'
import { apiCalls, mockApi, renderApp } from '../test/utils'

describe('Weather heatmap', () => {
  it('starts at the departure hour and moves with the slider without any request', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    renderApp('/heatmap', { result: makePlanResponse() })
    const slider = screen.getByRole('slider', { name: 'Forecast hour after departure' })
    const corridor = screen.getByTestId('corridor')
    const panel = within(screen.getByRole('region', { name: 'Corridor forecast time' }))

    expect(panel.getByText('Wed 14 Oct, 08:00 CDT', { exact: false })).toBeInTheDocument()
    expect(corridor).toHaveAttribute('data-hour', '0')

    // jsdom does not implement arrow-key stepping on range inputs; the browser does (verified
    // in Chrome, docs/TEST_PLAN.md §8). Here the slider is driven through change events.
    fireEvent.change(slider, { target: { value: '2' } })
    expect(corridor).toHaveAttribute('data-hour', '2')
    fireEvent.change(slider, { target: { value: '12' } })
    expect(corridor).toHaveAttribute('data-hour', '12')
    expect(panel.getByText('Wed 14 Oct, 20:00 CDT', { exact: false })).toBeInTheDocument()
    expect(panel.getByText('· departure + 12 h')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next hour' }))
    expect(corridor).toHaveAttribute('data-hour', '13')
    await user.click(screen.getByRole('button', { name: 'Previous hour' }))
    await user.click(screen.getByRole('button', { name: 'Previous hour' }))
    expect(corridor).toHaveAttribute('data-hour', '11')

    expect(apiCalls(fetchMock)).toEqual([])
  })

  it('stays within 0–48 hours', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/heatmap', { result: makePlanResponse() })

    expect(screen.getByRole('button', { name: 'Previous hour' })).toBeDisabled()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '48' } })
    expect(screen.getByRole('button', { name: 'Next hour' })).toBeDisabled()
    expect(
      within(screen.getByRole('region', { name: 'Corridor forecast time' })).getByText(
        'Fri 16 Oct, 08:00 CDT',
        {
          exact: false,
        },
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next hour' }))
    expect(screen.getByTestId('corridor')).toHaveAttribute('data-hour', '48')
  })

  it('shows a selected cell at the selected hour', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/heatmap', { result: makePlanResponse() })

    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } })
    await user.click(screen.getByRole('button', { name: 'Map cell 0' }))

    const info = screen.getByRole('region', { name: 'Selected corridor cell' })
    expect(info).toHaveTextContent('40.88°N, 100.38°W')
    expect(info).toHaveTextContent('52.8 mph')
    expect(info).toHaveTextContent('No Travel')
    expect(info).toHaveTextContent('for 38,000 lb')

    fireEvent.change(screen.getByRole('slider'), { target: { value: '13' } })
    expect(info).toHaveTextContent('Moderate')

    await user.click(screen.getByRole('button', { name: 'Map cell 1' }))
    expect(screen.getByRole('region', { name: 'Selected corridor cell' })).toHaveTextContent(
      'Unknown',
    )

    await user.click(screen.getByRole('button', { name: 'Close cell details' }))
    expect(screen.queryByRole('region', { name: 'Selected corridor cell' })).not.toBeInTheDocument()
  })

  it('toggles heatmap cells, routes and checkpoints', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/heatmap', { result: makePlanResponse() })

    const cells = screen.getByRole('switch', { name: 'Heatmap cells' })
    expect(cells).toHaveAttribute('aria-checked', 'true')
    await user.click(cells)
    expect(screen.getByTestId('corridor')).toHaveAttribute('data-visible', 'false')

    await user.click(screen.getByRole('switch', { name: 'Routes' }))
    expect(screen.queryByTestId('route-layer')).not.toBeInTheDocument()

    expect(screen.queryByTestId('checkpoints-A')).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Checkpoints (at ETA)' }))
    expect(screen.getByTestId('checkpoints-A')).toBeInTheDocument()
  })

  it('explains what the heatmap shows, including the cell size', () => {
    mockApi()
    renderApp('/heatmap', { result: makePlanResponse() })

    expect(
      screen.getByText(/Each cell shows the risk level for a 38,000 lb load/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Checkpoint dots = each point at the truck's ETA/)).toBeInTheDocument()
    expect(screen.getByText(/Cells are 0.25° × 0.25° \(2 cells\)/)).toBeInTheDocument()
    expect(screen.getByText(/no new requests/)).toBeInTheDocument()
  })

  it('explains missing heatmap cells in the panel', () => {
    mockApi()
    const result = makePlanResponse()
    result.warnings = [
      {
        code: 'CORRIDOR_WEATHER_PARTIAL',
        message: '120 of 154 heatmap cells have no forecast and are drawn as Unknown.',
      },
    ]
    renderApp('/heatmap', { result })

    expect(
      screen.getByText('120 of 154 heatmap cells have no forecast and are drawn as Unknown.'),
    ).toBeInTheDocument()
  })
})
