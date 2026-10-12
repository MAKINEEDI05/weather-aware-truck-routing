import { Link } from 'react-router'
import { ChevronRight, CloudOff, TriangleAlert } from 'lucide-react'
import type { Route } from '../../api/types'
import { RiskMilesBar } from '../../components/RiskMilesBar'
import {
  formatAverage,
  formatDayTimeZone,
  formatDuration,
  formatMiles,
  formatNumber,
} from '../../lib/format'
import { routeColor } from '../../lib/routes'

interface RouteCardProps {
  route: Route
  selected: boolean
  onSelect: () => void
  className?: string
}

export function RouteStatusBadge({ route }: { route: Route }) {
  if (route.is_recommended) {
    return (
      <span className="rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-green-700 uppercase">
        Recommended
      </span>
    )
  }
  if (!route.eligible) {
    return (
      <span className="rounded-md bg-fuchsia-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-fuchsia-700 uppercase">
        Not recommended
      </span>
    )
  }
  return null
}

export function RouteSwatch({
  routeId,
  className = 'h-1 w-6',
}: {
  routeId: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: routeColor(routeId) }}
    />
  )
}

export function RouteCard({ route, selected, onSelect, className = '' }: RouteCardProps) {
  const m = route.metrics
  return (
    <article
      aria-label={`${route.label}, rank ${route.rank}`}
      className={`card relative overflow-hidden ${
        selected ? 'border-brand ring-2 ring-brand' : 'hover:border-slate-300'
      } ${className}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="block w-full p-4 text-left focus-visible:outline-offset-[-2px]"
      >
        <span className="flex items-center gap-2.5">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-ink-muted tabular-nums">
            #{route.rank}
          </span>
          <RouteSwatch routeId={route.id} />
          <span className="text-base font-semibold text-ink">{route.label}</span>
          <span className="ml-auto">
            <RouteStatusBadge route={route} />
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-ink tabular-nums">
            {formatMiles(route.distance_mi)}
          </span>
          <span className="font-semibold text-ink tabular-nums">
            {formatDuration(route.travel_time_s)}
          </span>
          <span className="text-ink-muted">Arrive {formatDayTimeZone(route.arrival_time)}</span>
        </span>
        <RiskMilesBar metrics={m} distance={route.distance_mi} className="mt-3 h-2" />
        <span className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <Figure label="Severe" value={formatMiles(m.severe_mi)} />
          <Figure label="High" value={formatMiles(m.high_mi)} />
          <Figure label="Avg risk" value={formatAverage(m.average_risk)} />
        </span>
        {m.no_travel_mi > 0 && (
          <span className="mt-3 flex items-center gap-1.5 text-sm font-medium text-fuchsia-700">
            <TriangleAlert className="size-4" aria-hidden="true" />
            {formatNumber(m.no_travel_mi)} mi of No Travel conditions
          </span>
        )}
        {m.unknown_mi > 0 && (
          <span className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
            <CloudOff className="size-4" aria-hidden="true" />
            {formatNumber(m.unknown_mi)} mi without a forecast (Unknown)
          </span>
        )}
      </button>
      <Link
        to={`/routes/${route.id}`}
        className="flex items-center justify-end gap-1 border-t border-line px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
      >
        Route details
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="block text-xs text-ink-subtle">{label}</span>
      <span className="block font-semibold text-ink tabular-nums">{value}</span>
    </span>
  )
}
