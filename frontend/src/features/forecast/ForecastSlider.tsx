import { useMemo } from 'react'
import type { MouseEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Corridor, RiskLevel } from '../../api/types'
import { hourTime } from '../../lib/corridor'
import { formatDateTime, formatDayTime } from '../../lib/format'
import { RISK, riskFromCode, riskPatternClass } from '../../lib/risk'

const MAX_HOUR = 48
const TICKS = [0, 12, 24, 36, 48]
// Half the range thumb width (index.css .timeline-range): columns and ticks align with its centre.
const THUMB_HALF_PX = 9

// Bottom-up stacking: the most severe share sits on the baseline, where heights compare best.
const STACK: RiskLevel[] = ['NO_TRAVEL', 'SEVERE', 'HIGH', 'MODERATE', 'LOW', 'UNKNOWN']

export interface DriveWindow {
  label: string
  /** Hours after the corridor start (may fall outside 0–48). */
  start: number
  end: number
  arrival: string
}

interface ForecastSliderProps {
  corridor: Corridor
  hour: number
  onChange: (hour: number) => void
  /** The selected route's time on the road, drawn under the timeline. */
  drive?: DriveWindow | null
}

/**
 * 0–48 h corridor forecast slider (DEC-15) over a histogram of corridor cells by risk level for each
 * hour. It only changes which pre-loaded hour is drawn; it never triggers a network request.
 */
export function ForecastSlider({ corridor, hour, onChange, drive = null }: ForecastSliderProps) {
  const label = formatDateTime(hourTime(corridor, hour))
  const set = (value: number) => onChange(Math.max(0, Math.min(MAX_HOUR, value)))

  return (
    <section className="p-4 lg:px-5 lg:py-4" aria-label="Corridor forecast time">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="kicker">Corridor forecast · 0–48 h</p>
          <p className="mt-0.5 text-lg leading-snug font-bold text-ink" aria-live="polite">
            {label}{' '}
            <span className="num text-[15px] font-semibold text-ink-2">· departure + {hour} h</span>
          </p>
        </div>
        <p className="hidden max-w-[17rem] text-xs leading-relaxed text-ink-3 xl:block">
          Forecasts for all 49 hours are already loaded — moving the slider makes no new requests.
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => set(hour - 1)}
            disabled={hour <= 0}
            aria-label="Previous hour"
            className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-surface text-ink hover:bg-paper disabled:opacity-35"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => set(hour + 1)}
            disabled={hour >= MAX_HOUR}
            aria-label="Next hour"
            className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-surface text-ink hover:bg-paper disabled:opacity-35"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <RiskTimeline corridor={corridor} hour={hour} onPick={set} />
      {drive && <DriveBand drive={drive} />}

      <input
        type="range"
        min={0}
        max={MAX_HOUR}
        step={1}
        value={hour}
        onChange={(event) => set(Number(event.target.value))}
        aria-label="Forecast hour after departure"
        aria-valuetext={`${label}, departure plus ${hour} hours`}
        className="timeline-range mt-1 block"
      />
      <ol aria-hidden="true" className="relative mt-0.5 h-8 text-[11px]" style={inset}>
        {TICKS.map((tick) => (
          <li
            key={tick}
            className={`absolute top-0 whitespace-nowrap ${
              tick === 0
                ? 'text-left'
                : tick === MAX_HOUR
                  ? '-translate-x-full text-right'
                  : '-translate-x-1/2 text-center'
            } ${tick % 24 === 0 ? '' : 'hidden sm:block'}`}
            style={{ left: `${(tick / MAX_HOUR) * 100}%` }}
          >
            <span className="num block font-semibold text-ink">+{tick} h</span>
            <span className="num block text-ink-3">{formatDayTime(hourTime(corridor, tick))}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

const inset = { marginInline: `${THUMB_HALF_PX}px` }

/** Share of corridor cells at each risk level, per hour, as 49 stacked columns. */
function RiskTimeline({
  corridor,
  hour,
  onPick,
}: {
  corridor: Corridor
  hour: number
  onPick: (hour: number) => void
}) {
  const shares = useMemo(() => {
    const total = Math.max(1, corridor.cells.length)
    return Array.from({ length: MAX_HOUR + 1 }, (_, h) => {
      const counts = new Map<RiskLevel, number>()
      for (const cell of corridor.cells) {
        const level = riskFromCode(cell.risk[h] ?? -1)
        counts.set(level, (counts.get(level) ?? 0) + 1)
      }
      return STACK.map((level) => ({ level, share: (counts.get(level) ?? 0) / total }))
    })
  }, [corridor])

  function pick(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width <= 0) return
    onPick(Math.round(((event.clientX - box.left) / box.width) * MAX_HOUR))
  }

  return (
    <div className="mt-3" aria-hidden="true">
      <div className="mb-1 flex items-baseline justify-between text-[11px] text-ink-3">
        <span>Corridor cells by risk level, each hour</span>
        <span className="num">{corridor.cells.length} cells</span>
      </div>
      <div className="relative h-11 cursor-pointer" style={inset} onClick={pick}>
        {shares.map((stack, h) => (
          <div
            key={h}
            className={`absolute bottom-0 flex h-full -translate-x-1/2 flex-col-reverse overflow-hidden rounded-[2px] ${
              h === hour
                ? 'outline-2 outline-offset-1 outline-accent'
                : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              left: `${(h / MAX_HOUR) * 100}%`,
              width: `calc(${100 / (MAX_HOUR + 1)}% - 1px)`,
            }}
          >
            {stack.map(({ level, share }) =>
              share > 0 ? (
                <span
                  key={level}
                  className={`block w-full shrink-0 ${riskPatternClass(level)}`}
                  style={{
                    height: `${share * 100}%`,
                    backgroundColor: level === 'UNKNOWN' ? '#d6d4ce' : RISK[level].color,
                  }}
                />
              ) : null,
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** The selected route's departure-to-arrival window on the same hour scale. */
function DriveBand({ drive }: { drive: DriveWindow }) {
  const start = Math.max(0, Math.min(MAX_HOUR, drive.start))
  const end = Math.max(0, Math.min(MAX_HOUR, drive.end))
  const beyond = drive.end > MAX_HOUR
  return (
    <div className="mt-2" style={inset}>
      <div className="relative h-1.5 rounded-full bg-paper-2" aria-hidden="true">
        <span
          className="absolute inset-y-0 rounded-full bg-accent"
          style={{
            left: `${(start / MAX_HOUR) * 100}%`,
            width: `${((end - start) / MAX_HOUR) * 100}%`,
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink-2">
        <span className="font-semibold text-ink">{drive.label}</span> on the road
        {beyond ? ' past +48 h' : ` until ${formatDayTime(drive.arrival)}`} (continuous driving)
      </p>
    </div>
  )
}
