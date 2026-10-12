import type { Checkpoint, Route } from '../../api/types'
import { RouteShield } from '../../components/RouteShield'
import { formatAverage, formatDayTimeZone, formatDuration, formatMiles } from '../../lib/format'
import { CheckpointDetail } from '../routes/CheckpointDetail'

/** Popup content for one checkpoint. */
export function CheckpointPopup({ route, checkpoint }: { route: Route; checkpoint: Checkpoint }) {
  return (
    <div className="w-[19rem]">
      <CheckpointDetail route={route} checkpoint={checkpoint} compact />
    </div>
  )
}

/** Route summary shown on the map when a route line is clicked (FR-10). */
export function RouteSummaryPopup({ route }: { route: Route }) {
  const m = route.metrics
  const rows: [string, string][] = [
    ['Distance', formatMiles(route.distance_mi)],
    ['Travel time', formatDuration(route.travel_time_s)],
    ['Arrival', formatDayTimeZone(route.arrival_time)],
    ['Severe miles', formatMiles(m.severe_mi)],
    ['High miles', formatMiles(m.high_mi)],
    ['No Travel miles', formatMiles(m.no_travel_mi)],
    ['Average risk', formatAverage(m.average_risk)],
  ]
  return (
    <div className="w-64 text-sm">
      <div className="flex items-center gap-2 border-b border-line py-3 pr-9 pl-4">
        <RouteShield routeId={route.id} size="sm" />
        <p className="font-semibold text-ink">{route.label}</p>
        <span className="num ml-auto text-xs text-ink-3">#{route.rank}</span>
      </div>
      <dl className="divide-y divide-line px-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink-2">{label}</dt>
            <dd className="num text-[13px] font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p
        className={`border-t border-line px-4 py-2 text-xs font-semibold ${
          route.is_recommended ? 'text-go' : route.eligible ? 'text-ink-2' : 'text-closed'
        }`}
      >
        {route.is_recommended
          ? 'Recommended route'
          : route.eligible
            ? 'Eligible'
            : 'Not recommended: contains No Travel conditions'}
      </p>
    </div>
  )
}
