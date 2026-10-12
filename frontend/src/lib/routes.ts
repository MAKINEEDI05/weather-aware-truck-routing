import type { PlanResponse, Route } from '../api/types'

// DEC-30: route identity colours never reuse a risk colour.
const ROUTE_COLORS: Record<string, string> = {
  A: '#2563eb',
  B: '#334155',
  C: '#0891b2',
  D: '#7c3aed',
  E: '#0f766e',
  F: '#be185d',
}

export function routeColor(routeId: string): string {
  return ROUTE_COLORS[routeId] ?? '#475569'
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
