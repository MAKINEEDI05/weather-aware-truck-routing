import type { ReactNode } from 'react'
import type { Checkpoint, RiskLevel, Route } from '../../api/types'
import { RiskBadge } from '../../components/RiskBadge'
import {
  formatAverage,
  formatClock,
  formatDateTime,
  formatDuration,
  formatMiles,
  formatValue,
} from '../../lib/format'
import { routeColor } from '../../lib/routes'

/** Popup / panel content for one checkpoint: ETA, values, forecast hours, levels and reasons. */
export function CheckpointPopup({ route, checkpoint }: { route: Route; checkpoint: Checkpoint }) {
  const { weather, risk } = checkpoint
  return (
    <div className="w-72 text-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="font-semibold text-ink">
          {route.label} · mile {formatValue(checkpoint.mile, 1)}
        </p>
        <RiskBadge level={risk.overall} />
      </div>
      <dl className="space-y-1.5 px-4 py-3">
        <Row label="ETA" value={formatDateTime(checkpoint.eta)} />
        {weather ? (
          <>
            <Row
              label={`Wind · forecast ${formatClock(weather.wind_hour)}`}
              value={`${formatValue(weather.wind_mph, 1)} mph`}
              level={risk.wind}
            />
            <Row
              label={`Rain · hour to ${formatClock(weather.precip_hour)}`}
              value={`${formatValue(weather.rain_in_hr, 2)} in/hr`}
              level={risk.rain}
            />
            <Row
              label={`Snow · hour to ${formatClock(weather.precip_hour)}`}
              value={`${formatValue(weather.snow_in_hr, 2)} in/hr`}
              level={risk.snow}
            />
          </>
        ) : (
          <p className="text-ink-muted">No forecast is available for this point.</p>
        )}
        <Row label="Covers" value={formatMiles(checkpoint.covered_mi)} />
      </dl>
      <ul className="space-y-0.5 border-t border-line bg-slate-50 px-4 py-2.5 text-xs text-ink-muted">
        {risk.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
        {risk.overall === 'UNKNOWN' && <li>Unknown is never treated as Low.</li>}
      </ul>
    </div>
  )
}

function Row({ label, value, level }: { label: string; value: ReactNode; level?: RiskLevel }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="flex items-center gap-2 font-semibold text-ink tabular-nums">
        {value}
        {level && <RiskBadge level={level} />}
      </dd>
    </div>
  )
}

/** Route summary shown on the map when a route line is clicked (FR-10). */
export function RouteSummaryPopup({ route }: { route: Route }) {
  const m = route.metrics
  return (
    <div className="w-64 text-sm">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-1 w-5 rounded-full" style={{ backgroundColor: routeColor(route.id) }} />
        <p className="font-semibold text-ink">{route.label}</p>
        <span className="ml-auto text-xs font-medium text-ink-subtle">Rank #{route.rank}</span>
      </div>
      <dl className="space-y-1.5 px-4 py-3">
        <Row label="Distance" value={formatMiles(route.distance_mi)} />
        <Row label="Travel time" value={formatDuration(route.travel_time_s)} />
        <Row label="Arrival" value={formatDateTime(route.arrival_time)} />
        <Row label="Severe miles" value={formatMiles(m.severe_mi)} />
        <Row label="High miles" value={formatMiles(m.high_mi)} />
        <Row label="No Travel miles" value={formatMiles(m.no_travel_mi)} />
        <Row label="Average risk" value={formatAverage(m.average_risk)} />
      </dl>
      <p className="border-t border-line px-4 py-2 text-xs text-ink-muted">
        {route.is_recommended
          ? 'Recommended route'
          : route.eligible
            ? 'Eligible'
            : 'Not recommended: contains No Travel conditions'}
      </p>
    </div>
  )
}
