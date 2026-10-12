import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makePlanResponse } from '../test/fixtures'
import { mockApi, renderApp } from '../test/utils'

describe('Route details', () => {
  it('shows the route summary figures', () => {
    mockApi()
    renderApp('/routes/C', { result: makePlanResponse() })

    expect(screen.getByText('Rank #1 of 3')).toBeInTheDocument()
    expect(screen.getByText('1,048.2 mi')).toBeInTheDocument()
    expect(screen.getByText('15 h 35 m')).toBeInTheDocument()
    expect(screen.getByText('Wed 23:35 CDT')).toBeInTheDocument()
    expect(screen.getByText('Departs Wed 14 Oct, 08:00 CDT')).toBeInTheDocument()
    expect(screen.getByText('0.17')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Route C · Recommended/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('lists checkpoints with ETA, values and a text risk label', () => {
    mockApi()
    renderApp('/routes/C', { result: makePlanResponse() })

    const table = screen.getByRole('table', { name: /Checkpoints on Route C/ })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(4)
    expect(rows[3]).toHaveTextContent('725')
    expect(rows[3]).toHaveTextContent('Wed 18:46')
    expect(rows[3]).toHaveTextContent('38.4')
    expect(rows[3]).toHaveTextContent('High')
    expect(screen.getByText('4 total · ETA in CDT')).toBeInTheDocument()
  })

  it('filters checkpoints by risk level, including Unknown', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/routes/A', { result: makePlanResponse() })

    await user.selectOptions(screen.getByLabelText('Filter by risk level'), 'UNKNOWN')

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Unknown')
    expect(rows[0]).toHaveTextContent('—')
  })

  it('links table selection and map selection', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/routes/C', { result: makePlanResponse() })
    const markers = screen.getByTestId('checkpoints-C')

    await user.click(screen.getByRole('button', { name: 'Mile 725' }))
    expect(markers).toHaveAttribute('data-selected', '3')
    expect(screen.getByRole('button', { name: 'Mile 725' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Map checkpoint C-1' }))
    expect(screen.getByRole('button', { name: 'Mile 25' })).toHaveAttribute('aria-pressed', 'true')
    expect(markers).toHaveAttribute('data-selected', '1')
  })

  it('switches routes with the tabs', async () => {
    mockApi()
    const user = userEvent.setup()
    renderApp('/routes/C', { result: makePlanResponse() })

    await user.click(screen.getByRole('link', { name: 'Route B' }))

    expect(screen.getByText('Rank #3 of 3')).toBeInTheDocument()
    expect(screen.getByText('Not recommended')).toBeInTheDocument()
    expect(screen.getByTestId('checkpoints-B')).toBeInTheDocument()
  })

  it('handles an unknown route id', () => {
    mockApi()
    renderApp('/routes/Z', { result: makePlanResponse() })

    expect(screen.getByRole('heading', { name: 'There is no Route Z' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to routes' })).toHaveAttribute('href', '/routes')
  })
})
