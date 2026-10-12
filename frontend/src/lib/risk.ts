import type { RiskLevel, RouteMetrics } from '../api/types'
import { formatNumber } from './format'

export interface RiskStyle {
  label: string
  /** Solid colour for map markers, heatmap cells and strip segments. */
  color: string
  /** Tag background. */
  tint: string
  /** Readable text colour on the tint (≥ 4.5:1). */
  text: string
  /** Corridor risk code (−1 = unknown). */
  code: number
}

// Severity reads as ink density: from Moderate upwards each level is darker than the last, ending in
// a near-black plum for No Travel, so the order survives colour-vision deficiency. Risk colour is
// always shown together with its text label, and No Travel / Unknown also carry a pattern.
export const RISK: Record<RiskLevel, RiskStyle> = {
  LOW: { label: 'Low', color: '#3f9f62', tint: '#e6f2e9', text: '#1e6b3b', code: 0 },
  MODERATE: { label: 'Moderate', color: '#e2b024', tint: '#faf1d3', text: '#735400', code: 1 },
  HIGH: { label: 'High', color: '#ea7a2e', tint: '#fce9db', text: '#953d08', code: 2 },
  SEVERE: { label: 'Severe', color: '#cd3529', tint: '#f9e0dd', text: '#9b231a', code: 3 },
  NO_TRAVEL: { label: 'No Travel', color: '#4e1a55', tint: '#eee3ef', text: '#4e1a55', code: 4 },
  UNKNOWN: { label: 'Unknown', color: '#8b9099', tint: '#efefec', text: '#4b4f57', code: -1 },
}

/** Known levels in severity order, then Unknown. */
export const RISK_ORDER: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL', 'UNKNOWN']

const BY_CODE = new Map<number, RiskLevel>(RISK_ORDER.map((level) => [RISK[level].code, level]))

export function riskFromCode(code: number): RiskLevel {
  return BY_CODE.get(code) ?? 'UNKNOWN'
}

/** Marker outline that sets No Travel apart from Severe by weight as well as hue. */
export const NO_TRAVEL_OUTLINE = '#ffffff'

/** CSS pattern class for levels that must not rely on hue alone. */
export function riskPatternClass(level: RiskLevel): string {
  return level === 'UNKNOWN' ? 'hatch-unknown' : level === 'NO_TRAVEL' ? 'hatch-closed' : ''
}

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

/** "Low 898.2 mi, Moderate 125.0 mi, …" for every level with miles, from the backend metrics. */
export function milesSummary(metrics: RouteMetrics): string {
  return (
    RISK_ORDER.filter((level) => milesAt(metrics, level) > 0)
      .map((level) => `${RISK[level].label} ${formatNumber(milesAt(metrics, level))} mi`)
      .join(', ') || 'none'
  )
}
