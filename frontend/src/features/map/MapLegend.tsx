import { RiskDot } from '../../components/RiskBadge'
import { RISK, RISK_ORDER } from '../../lib/risk'
import { routeColor } from '../../lib/routes'

interface MapLegendProps {
  routeIds?: string[]
  showEndpoints?: boolean
  title?: string
  className?: string
}

export function MapLegend({
  routeIds = [],
  showEndpoints = true,
  title = 'Checkpoint risk',
  className = '',
}: MapLegendProps) {
  return (
    <div className={`overlay w-44 p-3 text-sm ${className}`} aria-label="Map legend">
      <p className="eyebrow mb-2">{title}</p>
      <ul className="space-y-1.5">
        {RISK_ORDER.map((level) => (
          <li key={level} className="flex items-center gap-2 text-ink">
            <RiskDot level={level} className="size-3" />
            {RISK[level].label}
          </li>
        ))}
      </ul>
      {showEndpoints && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          <li className="flex items-center gap-2 text-ink">
            <span
              aria-hidden="true"
              className="size-3 rounded-full border-[3px] border-ink bg-white"
            />
            Origin
          </li>
          <li className="flex items-center gap-2 text-ink">
            <span aria-hidden="true" className="size-3 rounded-full rounded-bl-none bg-brand" />
            Destination
          </li>
        </ul>
      )}
      {routeIds.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {routeIds.map((id) => (
            <li key={id} className="flex items-center gap-2 text-ink">
              <span
                aria-hidden="true"
                className="h-1 w-5 rounded-full"
                style={{ backgroundColor: routeColor(id) }}
              />
              Route {id}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One-line legend for small screens (design 09b). */
export function InlineRiskLegend() {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink"
      aria-label="Risk legend"
    >
      {RISK_ORDER.map((level) => (
        <li key={level} className="flex items-center gap-1.5">
          <RiskDot level={level} />
          {RISK[level].label}
        </li>
      ))}
    </ul>
  )
}
