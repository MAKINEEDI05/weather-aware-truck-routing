import type { RouteMetrics } from '../api/types'
import { formatNumber } from '../lib/format'
import { RISK, RISK_ORDER, milesAt } from '../lib/risk'

interface RiskMilesBarProps {
  metrics: RouteMetrics
  distance: number
  className?: string
}

/** Stacked bar of road miles per risk level. The accessible name lists every value. */
export function RiskMilesBar({ metrics, distance, className = 'h-2' }: RiskMilesBarProps) {
  const segments = RISK_ORDER.map((level) => ({ level, miles: milesAt(metrics, level) })).filter(
    (segment) => segment.miles > 0,
  )
  const label = segments
    .map(({ level, miles }) => `${RISK[level].label} ${formatNumber(miles)} mi`)
    .join(', ')

  return (
    <div
      role="img"
      aria-label={`Miles by risk level: ${label || 'none'}`}
      className={`flex w-full overflow-hidden rounded-full bg-slate-100 ${className}`}
    >
      {segments.map(({ level, miles }) => (
        <span
          key={level}
          className="h-full"
          style={{
            width: `${(miles / Math.max(distance, 1e-9)) * 100}%`,
            backgroundColor: RISK[level].color,
            backgroundImage:
              level === 'UNKNOWN'
                ? 'repeating-linear-gradient(135deg, rgba(255,255,255,.6) 0 3px, transparent 3px 6px)'
                : undefined,
          }}
        />
      ))}
    </div>
  )
}
