import type { ReactNode } from 'react'
import { CloudOff, Weight } from 'lucide-react'
import type { Checkpoint, RiskLevel, Route } from '../../api/types'
import { RiskBadge } from '../../components/RiskBadge'
import {
  formatClock,
  formatDateTime,
  formatMilepost,
  formatMiles,
  formatValue,
} from '../../lib/format'

interface CheckpointDetailProps {
  route: Route
  checkpoint: Checkpoint
  /** Tighter spacing for map popups. */
  compact?: boolean
}

/**
 * Everything the backend reports for one checkpoint: ETA, each factor's value and level, the
 * forecast hours used, the miles it covers and the rule reasons. Shared by map popups and the
 * route details inspector.
 */
export function CheckpointDetail({ route, checkpoint, compact = false }: CheckpointDetailProps) {
  const { weather, risk } = checkpoint
  const pad = compact ? 'px-4' : 'px-5'

  return (
    <div className="text-sm">
      <div className={`flex items-start justify-between gap-3 border-b border-line py-3 ${pad}`}>
        <div className="min-w-0">
          <p className="kicker">
            {route.label} · checkpoint {checkpoint.index + 1} of {route.checkpoints.length}
          </p>
          <p className="num mt-0.5 text-lg leading-tight font-semibold text-ink">
            Mile {formatMilepost(checkpoint.mile)}
          </p>
        </div>
        <span className={compact ? 'mr-5' : ''}>
          <RiskBadge level={risk.overall} size="md" />
        </span>
      </div>

      <dl className={`divide-y divide-line ${pad}`}>
        <Row label="ETA" value={formatDateTime(checkpoint.eta)} />
        {weather ? (
          <>
            <Row
              label="Wind"
              note={`forecast ${formatClock(weather.wind_hour)}`}
              value={`${formatValue(weather.wind_mph, 1)} mph`}
              level={risk.wind}
            />
            <Row
              label="Rain"
              note={`hour to ${formatClock(weather.precip_hour)}`}
              value={`${formatValue(weather.rain_in_hr, 2)} in/hr`}
              level={risk.rain}
            />
            <Row
              label="Snow"
              note={`hour to ${formatClock(weather.precip_hour)}`}
              value={`${formatValue(weather.snow_in_hr, 2)} in/hr`}
              level={risk.snow}
            />
          </>
        ) : (
          <div className="flex items-center gap-2 py-2.5 text-ink-2">
            <CloudOff className="size-4 shrink-0" aria-hidden="true" />
            No forecast is available for this point.
          </div>
        )}
        <Row label="Covers" value={formatMiles(checkpoint.covered_mi)} />
      </dl>

      <div className={`space-y-1.5 border-t border-line bg-paper py-2.5 text-xs text-ink-2 ${pad}`}>
        {risk.load_adjusted && (
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <Weight className="size-3.5 shrink-0" aria-hidden="true" />A load rule raised the wind
            level for this load.
          </p>
        )}
        <ul className="space-y-0.5">
          {risk.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
          {risk.overall === 'UNKNOWN' && <li>Unknown is never treated as Low.</li>}
        </ul>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  note,
  level,
}: {
  label: string
  value: ReactNode
  note?: string
  level?: RiskLevel
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-ink-2">
        <span className="font-semibold text-ink">{label}</span>
        {note && <span className="num ml-1.5 text-[11px] text-ink-3">{note}</span>}
      </dt>
      <dd className="flex items-center gap-2">
        <span className="num text-[13px] font-medium text-ink">{value}</span>
        {level && <RiskBadge level={level} />}
      </dd>
    </div>
  )
}
