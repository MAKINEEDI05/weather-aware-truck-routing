import '@testing-library/jest-dom/vitest'
import { createElement as h } from 'react'
import type { ReactNode } from 'react'
import type { Corridor, Route } from '../api/types'

// jsdom has no layout engine, so Leaflet cannot render. The map module is replaced by light
// stand-ins that expose the same callbacks as buttons, so page behaviour stays testable.
// Real map rendering is verified in a browser (docs/TEST_PLAN.md §8).
vi.mock('../features/map', () => ({
  TripMap: ({ children, label }: { children?: ReactNode; label?: string }) =>
    h('div', { 'data-testid': 'map', 'aria-label': label }, children),
  RouteLayer: ({
    routes,
    selectedId,
    onSelect,
  }: {
    routes: Route[]
    selectedId?: string | null
    onSelect?: (id: string) => void
  }) =>
    h(
      'div',
      { 'data-testid': 'route-layer', 'data-selected': selectedId ?? '' },
      routes.map((route) =>
        h(
          'button',
          { key: route.id, type: 'button', onClick: () => onSelect?.(route.id) },
          `Map line ${route.id}`,
        ),
      ),
    ),
  CheckpointLayer: ({
    route,
    selectedIndex,
    onSelect,
  }: {
    route: Route
    selectedIndex?: number | null
    onSelect?: (index: number) => void
  }) =>
    h(
      'div',
      { 'data-testid': `checkpoints-${route.id}`, 'data-selected': selectedIndex ?? '' },
      route.checkpoints.map((c) =>
        h(
          'button',
          { key: c.index, type: 'button', onClick: () => onSelect?.(c.index) },
          `Map checkpoint ${route.id}-${c.index}`,
        ),
      ),
    ),
  CorridorLayer: ({
    corridor,
    hour,
    visible,
    onSelectCell,
  }: {
    corridor: Corridor
    hour: number
    visible: boolean
    onSelectCell?: (index: number) => void
  }) =>
    h(
      'div',
      { 'data-testid': 'corridor', 'data-hour': hour, 'data-visible': String(visible) },
      corridor.cells.map((_, index) =>
        h(
          'button',
          { key: index, type: 'button', onClick: () => onSelectCell?.(index) },
          `Map cell ${index}`,
        ),
      ),
    ),
  EndpointMarkers: () => null,
}))

// The trip is saved to browser storage; each test starts from an empty browser.
afterEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
})

// jsdom does not implement these browser APIs.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
Element.prototype.scrollIntoView = vi.fn()
