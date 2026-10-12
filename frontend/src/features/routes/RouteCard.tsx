import { Link } from 'react-router'
import { ArrowRight, CloudOff, OctagonX } from 'lucide-react'
import type { DecidedBy, Route } from '../../api/types'
import { RouteProfile } from '../../components/RouteProfile'
import { RouteShield } from '../../components/RouteShield'
import {
  formatAverage,
  formatDayTimeZone,
  formatDuration,
  formatMiles,
  formatNumber,
} from '../../lib/format'
import { routeColor } from '../../lib/routes'
import { CRITERIA } from '../recommendation/criteria'

interface RouteCardProps {
  route: Route
  selected: boolean
  onSelect: () => void
  /** The criterion on which this route lost to the recommended route, if any. */
  lostOn?: DecidedBy | null
  className?: string
}

/** "Recommended" or "Not recommended" as a small sign; nothing for other routes. */
export function RouteStatusBadge({ route }: { route: Route }) {
  if (route.is_recommended) {
    return (
      <span className="rounded-[4px] bg-go-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-go uppercase">
        Recommended
      </span>
    )
  }
  if (!route.eligible) {
    return (
      <span className="rounded-[4px] bg-closed-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-closed uppercase">
        Not recommended
      </span>
    )
  }
  return null
}

/**
 * One route as a ticket: identity, the four ranking criteria in priority order (with the one it lost
 * on marked), and the risk along the route.
 */
export function RouteCard({
  route,
  selected,
  onSelect,
  lostOn = null,
  className = '',
}: RouteCardProps) {
  const m = route.metrics
  const figures: { key: string; label: string; value: string }[] = [
    { key: 'severe_miles', label: 'Severe', value: formatMiles(m.severe_mi) },
    { key: 'high_miles', label: 'High', value: formatMiles(m.high_mi) },
    { key: 'average_risk', label: 'Avg risk', value: formatAverage(m.average_risk) },
    { key: 'travel_time', label: 'Time', value: formatDuration(route.travel_time_s) },
  ]

  return (
    <article
      aria-label={`${route.label}, rank ${route.rank}`}
      className={`relative overflow-hidden rounded-lg border bg-surface transition-shadow ${
        selected ? '' : 'border-line hover:border-line-strong'
      } ${className}`}
      style={
        selected
          ? { borderColor: routeColor(route.id), boxShadow: `0 0 0 1px ${routeColor(route.id)}` }
          : undefined
      }
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: routeColor(route.id) }}
      />
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="block w-full py-3.5 pr-4 pl-5 text-left focus-visible:outline-offset-[-3px]"
      >
        <span className="flex items-center gap-2.5">
          <RouteShield routeId={route.id} />
          <span className="text-base font-bold text-ink">{route.label}</span>
          <span className="num text-xs text-ink-3">#{route.rank}</span>
          <span className="ml-auto">
            <RouteStatusBadge route={route} />
          </span>
        </span>

        <span className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]">
          <span className="num font-semibold text-ink">{formatMiles(route.distance_mi)}</span>
          <span className="num text-ink-2">Arrive {formatDayTimeZone(route.arrival_time)}</span>
        </span>

        <span className="mt-3 block">
          <RouteProfile route={route} className="h-2.5" />
        </span>

        <span className="mt-3 grid grid-cols-4 overflow-hidden rounded-md border border-line">
          {figures.map((figure, index) => {
            const lost = lostOn === figure.key
            return (
              <span
                key={figure.key}
                className={`block border-line px-2 py-1.5 [&:not(:first-child)]:border-l ${
                  lost ? 'bg-accent text-white' : ''
                }`}
              >
                <span
                  className={`block font-mono text-[10px] tracking-wider uppercase ${
                    lost ? 'text-white/75' : 'text-ink-3'
                  }`}
                >
                  <span aria-hidden="true">{index + 1} </span>
                  {figure.label}
                </span>
                <span
                  className={`num block text-xs font-semibold whitespace-nowrap ${lost ? '' : 'text-ink'}`}
                >
                  {figure.value}
                </span>
                {lost && (
                  <span className="sr-only">
                    {' '}
                    — lost to the recommended route on{' '}
                    {CRITERIA.find((c) => c.key === lostOn)?.label.toLowerCase()}
                  </span>
                )}
              </span>
            )
          })}
        </span>

        {m.no_travel_mi > 0 && (
          <span className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-closed">
            <OctagonX className="size-4 shrink-0" aria-hidden="true" />
            {formatNumber(m.no_travel_mi)} mi of No Travel conditions
          </span>
        )}
        {m.unknown_mi > 0 && (
          <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-2">
            <CloudOff className="size-4 shrink-0" aria-hidden="true" />
            {formatNumber(m.unknown_mi)} mi without a forecast (Unknown)
          </span>
        )}
      </button>
      <Link
        to={`/routes/${route.id}`}
        className="flex items-center justify-between border-t border-line py-2 pr-4 pl-5 text-[13px] font-semibold text-ink hover:bg-paper"
      >
        Route details
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  )
}
