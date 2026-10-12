import type { PlanResponse, Route } from '../api/types'

// Route identity: deep, cool and desaturated so route lines recede behind the risk colours. None of
// them is close to a risk hue. Identity is always carried by the route letter as well.
const ROUTE_COLORS: Record<string, string> = {
  A: '#1c74d4',
  B: '#0f7685',
  C: '#23262b',
  D: '#5f7fa8',
  E: '#4b5563',
  F: '#2c5f8a',
}

export function routeColor(routeId: string): string {
  return ROUTE_COLORS[routeId] ?? '#4b5563'
}

export function routesByRank(result: PlanResponse): Route[] {
  return [...result.routes].sort((a, b) => a.rank - b.rank)
}

export function findRoute(
  result: PlanResponse,
  routeId: string | null | undefined,
): Route | undefined {
  return result.routes.find((route) => route.id === routeId)
}

/** The route to show by default: the recommended one, otherwise the best-ranked. */
export function defaultRouteId(result: PlanResponse): string | undefined {
  return result.recommendation.route_id ?? routesByRank(result)[0]?.id
}
