import { RiskDot } from '../../components/RiskBadge'
import { RouteShield } from '../../components/RouteShield'
import { RISK, RISK_ORDER } from '../../lib/risk'

interface MapLegendProps {
  routeIds?: string[]
  showEndpoints?: boolean
  title?: string
  className?: string
}

/**
 * Map key as one slim bar along the bottom edge, so it never sits over the middle of the map:
 * risk chips, then the endpoint shapes, then the route shields.
 */
export function MapLegend({
  routeIds = [],
  showEndpoints = true,
  title = 'Checkpoint risk',
  className = '',
}: MapLegendProps) {
  return (
    <div
      className={`float flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 text-xs text-ink ${className}`}
      role="group"
      aria-label="Map legend"
    >
      <span className="kicker" title={title}>
        Key
      </span>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label={title}>
        {RISK_ORDER.map((level) => (
          <li key={level} className="flex items-center gap-1.5 whitespace-nowrap">
            <RiskDot level={level} className="size-2.5" />
            {RISK[level].label}
          </li>
        ))}
      </ul>
      {showEndpoints && (
        <ul className="flex items-center gap-x-3 border-l border-line pl-4">
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full border-[2.5px] border-ink bg-white"
            />
            Origin
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-ink" />
            Destination
          </li>
        </ul>
      )}
      {routeIds.length > 0 && (
        <ul className="flex items-center gap-x-2.5 border-l border-line pl-4" aria-label="Routes">
          {routeIds.map((id) => (
            <li key={id} className="flex items-center gap-1">
              <RouteShield routeId={id} size="sm" />
              <span className="sr-only">Route {id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One-line legend for small screens. */
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
