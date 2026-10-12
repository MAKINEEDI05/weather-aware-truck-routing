import { useEffect, useRef } from 'react'
import type { RiskLevel, Route } from '../../api/types'
import { RiskBadge } from '../../components/RiskBadge'
import { formatDayTime, formatMilepost, formatValue, timeZoneName } from '../../lib/format'
import { RISK, RISK_ORDER, riskPatternClass } from '../../lib/risk'

export type LevelFilter = 'ALL' | RiskLevel

interface CheckpointTableProps {
  route: Route
  selectedIndex: number | null
  onSelect: (index: number) => void
  filter: LevelFilter
  onFilterChange: (filter: LevelFilter) => void
  className?: string
}

/**
 * Accessible, non-map view of every checkpoint on a route (blueprint §6.8). Each weather value
 * carries a small chip with that factor's own level, so the factor that drove the risk is visible.
 */
export function CheckpointTable({
  route,
  selectedIndex,
  onSelect,
  filter,
  onFilterChange,
  className = '',
}: CheckpointTableProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const selectedRow = useRef<HTMLTableRowElement>(null)
  const rows = route.checkpoints.filter((c) => filter === 'ALL' || c.risk.overall === filter)

  // Keep the selected row visible by scrolling the table only, never the page.
  useEffect(() => {
    const box = scroller.current
    const row = selectedRow.current
    if (!box || !row) return
    const header = 36
    if (row.offsetTop - header < box.scrollTop) {
      box.scrollTop = row.offsetTop - header
    } else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight
    }
  }, [selectedIndex])

  return (
    <section
      className={`panel flex min-h-0 flex-col overflow-hidden ${className}`}
      aria-labelledby="checkpoints-title"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <div>
          <h2 id="checkpoints-title" className="text-base font-bold text-ink">
            Checkpoints
          </h2>
          <p className="text-xs text-ink-3">
            {route.checkpoints.length} total · ETA in {timeZoneName(route.departure_time)}
          </p>
        </div>
        <span aria-hidden="true" className="kicker ml-auto">
          Show
        </span>
        <label className="flex items-center text-sm text-ink-2">
          <span className="sr-only">Filter by risk level</span>
          <select
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as LevelFilter)}
            className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink"
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
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">
            Checkpoints on {route.label}. Select a row to show it on the map.
          </caption>
          <thead className="sticky top-0 z-10 bg-paper">
            <tr className="border-b border-line">
              <th scope="col" className="kicker px-4 py-2 text-left">
                Mile
              </th>
              <th scope="col" className="kicker px-3 py-2 text-left">
                ETA
              </th>
              <th scope="col" className="kicker px-3 py-2 text-right">
                Wind mph
              </th>
              <th scope="col" className="kicker px-3 py-2 text-right">
                Rain in/hr
              </th>
              <th scope="col" className="kicker px-3 py-2 text-right">
                Snow in/hr
              </th>
              <th scope="col" className="kicker px-4 py-2 text-left">
                Risk
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((checkpoint) => {
              const selected = checkpoint.index === selectedIndex
              const { weather, risk } = checkpoint
              return (
                <tr
                  key={checkpoint.index}
                  ref={selected ? selectedRow : undefined}
                  onClick={() => onSelect(checkpoint.index)}
                  aria-selected={selected}
                  className={`cursor-pointer border-b border-line last:border-0 ${
                    selected
                      ? 'bg-paper-2 shadow-[inset_3px_0_0_var(--color-ink)]'
                      : 'hover:bg-paper'
                  }`}
                >
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelect(checkpoint.index)
                      }}
                      aria-pressed={selected}
                      aria-label={`Mile ${formatMilepost(checkpoint.mile)}`}
                      className="num font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
                    >
                      {formatMilepost(checkpoint.mile)}
                    </button>
                  </td>
                  <td className="num px-3 py-2 text-[13px] text-ink-2">
                    {formatDayTime(checkpoint.eta)}
                  </td>
                  <Value value={formatValue(weather?.wind_mph ?? null, 1)} level={risk.wind} />
                  <Value value={formatValue(weather?.rain_in_hr ?? null, 2)} level={risk.rain} />
                  <Value value={formatValue(weather?.snow_in_hr ?? null, 2)} level={risk.snow} />
                  <td className="px-4 py-2">
                    <RiskBadge level={risk.overall} />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-2">
                  No checkpoints at this level.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line bg-paper px-4 py-2 text-xs text-ink-3">
        Rain and snow use the hourly total that contains the ETA; wind uses the nearest forecast
        hour. The chip beside each value is that factor's own level.
      </p>
    </section>
  )
}

function Value({ value, level }: { value: string; level: RiskLevel }) {
  return (
    <td className="px-3 py-2 text-right">
      <span className="num inline-flex items-center justify-end gap-1.5 text-[13px] text-ink">
        {value}
        <span
          aria-hidden="true"
          title={RISK[level].label}
          className={`inline-block size-2 rounded-[2px] ${riskPatternClass(level)}`}
          style={
            level === 'UNKNOWN'
              ? { border: `1px dashed ${RISK.UNKNOWN.color}` }
              : { backgroundColor: RISK[level].color }
          }
        />
        <span className="sr-only">({RISK[level].label})</span>
      </span>
    </td>
  )
}
