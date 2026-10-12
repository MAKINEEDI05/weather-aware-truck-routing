import { useEffect, useRef } from 'react'
import type { RiskLevel, Route } from '../../api/types'
import { RiskBadge } from '../../components/RiskBadge'
import { formatDayTime, formatValue, timeZoneName } from '../../lib/format'
import { RISK, RISK_ORDER } from '../../lib/risk'

export type LevelFilter = 'ALL' | RiskLevel

interface CheckpointTableProps {
  route: Route
  selectedIndex: number | null
  onSelect: (index: number) => void
  filter: LevelFilter
  onFilterChange: (filter: LevelFilter) => void
}

/** Accessible, non-map view of every checkpoint on a route (blueprint §6.8). */
export function CheckpointTable({
  route,
  selectedIndex,
  onSelect,
  filter,
  onFilterChange,
}: CheckpointTableProps) {
  const selectedRow = useRef<HTMLTableRowElement>(null)
  const rows = route.checkpoints.filter((c) => filter === 'ALL' || c.risk.overall === filter)

  useEffect(() => {
    selectedRow.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <section
      className="card flex h-full max-h-[70vh] min-h-0 flex-col xl:max-h-none"
      aria-labelledby="checkpoints-title"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <h2 id="checkpoints-title" className="text-base font-semibold text-ink">
          Checkpoints
        </h2>
        <p className="text-sm text-ink-subtle">
          {route.checkpoints.length} total · ETA in {timeZoneName(route.departure_time)}
        </p>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          <span className="sr-only">Filter by risk level</span>
          <select
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as LevelFilter)}
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="ALL">All levels</option>
            {RISK_ORDER.map((level) => (
              <option key={level} value={level}>
                {RISK[level].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Checkpoints on {route.label}. Select a row to show it on the map.
          </caption>
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow px-4 py-2 text-left">
                Mile
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-left">
                ETA
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-right">
                Wind mph
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-right">
                Rain in/hr
              </th>
              <th scope="col" className="eyebrow px-3 py-2 text-right">
                Snow in/hr
              </th>
              <th scope="col" className="eyebrow px-4 py-2 text-left">
                Risk
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((checkpoint) => {
              const selected = checkpoint.index === selectedIndex
              return (
                <tr
                  key={checkpoint.index}
                  ref={selected ? selectedRow : undefined}
                  onClick={() => onSelect(checkpoint.index)}
                  aria-selected={selected}
                  className={`cursor-pointer border-b border-line last:border-0 ${
                    selected ? 'bg-brand-soft' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelect(checkpoint.index)
                      }}
                      aria-pressed={selected}
                      aria-label={`Mile ${formatValue(checkpoint.mile, checkpoint.mile % 1 === 0 ? 0 : 1)}`}
                      className="font-semibold text-ink tabular-nums hover:text-brand"
                    >
                      {formatValue(checkpoint.mile, checkpoint.mile % 1 === 0 ? 0 : 1)}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted tabular-nums">
                    {formatDayTime(checkpoint.eta)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink tabular-nums">
                    {formatValue(checkpoint.weather?.wind_mph ?? null, 1)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink tabular-nums">
                    {formatValue(checkpoint.weather?.rain_in_hr ?? null, 2)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink tabular-nums">
                    {formatValue(checkpoint.weather?.snow_in_hr ?? null, 2)}
                  </td>
                  <td className="px-4 py-2.5">
                    <RiskBadge level={checkpoint.risk.overall} />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                  No checkpoints at this level.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-xs text-ink-subtle">
        Rain and snow use the hourly total that contains the ETA; wind uses the nearest forecast
        hour.
      </p>
    </section>
  )
}
