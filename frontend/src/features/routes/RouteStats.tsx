import type { ReactNode } from 'react'
import type { Route } from '../../api/types'
import { RiskDot } from '../../components/RiskBadge'
import { RiskMilesBar } from '../../components/RiskMilesBar'
import {
  formatAverage,
  formatDateTime,
  formatDayTimeZone,
  formatDuration,
  formatMiles,
  formatNumber,
} from '../../lib/format'
import { RISK, milesAt } from '../../lib/risk'
import type { RiskLevel } from '../../api/types'

const KNOWN: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL']

export function RouteStats({ route }: { route: Route }) {
  const m = route.metrics
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]">
      <Stat
        label="Distance"
        value={formatMiles(route.distance_mi)}
        caption="From the routing provider"
      />
      <Stat
        label="Travel time"
        value={formatDuration(route.travel_time_s)}
        caption="Continuous driving, no rest stops"
      />
      <Stat
        label="Arrival"
        value={formatDayTimeZone(route.arrival_time)}
        caption={`Departs ${formatDateTime(route.departure_time)}`}
      />
      <Stat
        label="Average risk"
        value={formatAverage(m.average_risk)}
        caption="0 = Low · 4 = No Travel"
      />
      <section
        className="card col-span-2 p-4 md:col-span-4 xl:col-span-1"
        aria-label="Miles by risk level"
      >
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-ink-muted">Miles by risk level</p>
          <p className="text-xs text-ink-subtle">Unknown {formatNumber(m.unknown_mi)} mi</p>
        </div>
        <RiskMilesBar metrics={m} distance={route.distance_mi} className="mt-2 h-2.5" />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {KNOWN.map((level) => (
            <li key={level} className="flex items-center gap-1.5 whitespace-nowrap">
              <RiskDot level={level} className="size-2.5 rounded-sm" />
              <span className="text-ink-muted">{RISK[level].label}</span>
              <span className="font-semibold text-ink tabular-nums">
                {formatNumber(milesAt(m, level))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Stat({ label, value, caption }: { label: string; value: ReactNode; caption: string }) {
  return (
    <section className="card p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-ink tabular-nums lg:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-ink-subtle">{caption}</p>
    </section>
  )
}
