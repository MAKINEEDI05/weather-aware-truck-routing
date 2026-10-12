import type { RouteMetrics } from '../api/types'
import { RISK, RISK_ORDER, milesAt, milesSummary, riskPatternClass } from '../lib/risk'

interface RiskMilesBarProps {
  metrics: RouteMetrics
  distance: number
  className?: string
}

/** Stacked bar of road miles per risk level (backend totals). The accessible name lists them. */
export function RiskMilesBar({ metrics, distance, className = 'h-2' }: RiskMilesBarProps) {
  const segments = RISK_ORDER.map((level) => ({ level, miles: milesAt(metrics, level) })).filter(
    (segment) => segment.miles > 0,
  )

  return (
    <div
      role="img"
      aria-label={`Miles by risk level: ${milesSummary(metrics)}`}
      className={`flex w-full gap-px overflow-hidden rounded-[3px] bg-paper-2 ${className}`}
    >
      {segments.map(({ level, miles }) => (
        <span
          key={level}
          className={`h-full ${riskPatternClass(level)}`}
          style={{
            width: `${(miles / Math.max(distance, 1e-9)) * 100}%`,
            backgroundColor: RISK[level].color,
          }}
        />
      ))}
    </div>
  )
}
