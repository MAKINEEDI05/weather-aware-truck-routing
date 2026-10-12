import type { RiskLevel, RouteMetrics } from '../api/types'

export interface RiskStyle {
  label: string
  /** Solid colour for map markers, heatmap cells and bar segments. */
  color: string
  /** Badge background. */
  tint: string
  /** Readable text colour on the tint. */
  text: string
  /** Corridor risk code (−1 = unknown). */
  code: number
}

// docs/DESIGN_SYSTEM.md §2. Risk colour is always shown together with its text label.
export const RISK: Record<RiskLevel, RiskStyle> = {
  LOW: { label: 'Low', color: '#16a34a', tint: '#ecfdf3', text: '#15803d', code: 0 },
  MODERATE: { label: 'Moderate', color: '#eab308', tint: '#fefce8', text: '#a16207', code: 1 },
  HIGH: { label: 'High', color: '#f97316', tint: '#fff7ed', text: '#c2410c', code: 2 },
  SEVERE: { label: 'Severe', color: '#dc2626', tint: '#fef2f2', text: '#b91c1c', code: 3 },
  NO_TRAVEL: { label: 'No Travel', color: '#c026d3', tint: '#fdf4ff', text: '#a21caf', code: 4 },
  UNKNOWN: { label: 'Unknown', color: '#94a3b8', tint: '#f8fafc', text: '#475569', code: -1 },
}

/** Known levels in severity order, then Unknown. */
export const RISK_ORDER: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL', 'UNKNOWN']

const BY_CODE = new Map<number, RiskLevel>(RISK_ORDER.map((level) => [RISK[level].code, level]))

export function riskFromCode(code: number): RiskLevel {
  return BY_CODE.get(code) ?? 'UNKNOWN'
}

/** Dark outline that makes No Travel markers distinct from Severe without relying on hue. */
export const NO_TRAVEL_OUTLINE = '#3b0764'

const MILES_FIELD: Record<RiskLevel, keyof RouteMetrics> = {
  LOW: 'low_mi',
  MODERATE: 'moderate_mi',
  HIGH: 'high_mi',
  SEVERE: 'severe_mi',
  NO_TRAVEL: 'no_travel_mi',
  UNKNOWN: 'unknown_mi',
}

/** Road miles of a route at a given overall risk level. */
export function milesAt(metrics: RouteMetrics, level: RiskLevel): number {
  return (metrics[MILES_FIELD[level]] as number | null) ?? 0
}
