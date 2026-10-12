import type { ReactNode } from 'react'
import type { RiskLevel, Route } from '../../api/types'
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

const LEVELS: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL', 'UNKNOWN']

/** The route's key figures as a title block: ruled cells, labels in signage type, values in mono. */
export function RouteStats({ route }: { route: Route }) {
  const m = route.metrics
  const delay = route.traffic_delay_s >= 60 ? formatDuration(route.traffic_delay_s) : null
  return (
    <section
      aria-label="Route figures"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.7fr)]"
    >
      <Cell
        label="Distance"
        value={formatMiles(route.distance_mi)}
        caption="From the routing provider"
      />
      <Cell
        label="Travel time"
        value={formatDuration(route.travel_time_s)}
        caption={
          delay
            ? `Incl. ${delay} traffic delay · no rest stops`
            : 'Continuous driving, no rest stops'
        }
      />
      <Cell
        label="Arrival"
        value={formatDayTimeZone(route.arrival_time)}
        caption={`Departs ${formatDateTime(route.departure_time)}`}
      />
      <Cell
        label="Average risk"
        value={formatAverage(m.average_risk)}
        caption="0 = Low · 4 = No Travel"
      />
      <div className="col-span-2 bg-surface p-4 md:col-span-4 xl:col-span-1">
        <p className="kicker">Miles by risk level</p>
        <RiskMilesBar metrics={m} distance={route.distance_mi} className="mt-2.5 h-2.5" />
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {LEVELS.map((level) => (
            <li key={level} className="flex items-center gap-1.5 whitespace-nowrap">
              <RiskDot level={level} />
              <span className="text-ink-2">{RISK[level].label}</span>
              <span className="num font-semibold text-ink">{formatNumber(milesAt(m, level))}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Cell({ label, value, caption }: { label: string; value: ReactNode; caption: string }) {
  return (
    <div className="bg-surface p-4">
      <p className="kicker">{label}</p>
      <p className="num mt-1.5 text-xl font-semibold tracking-tight text-ink lg:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-ink-3">{caption}</p>
    </div>
  )
}
