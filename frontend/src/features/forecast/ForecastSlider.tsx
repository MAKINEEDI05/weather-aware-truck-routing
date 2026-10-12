import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Corridor } from '../../api/types'
import { hourTime } from '../../lib/corridor'
import { formatDateTime, formatDayTime } from '../../lib/format'

const MAX_HOUR = 48
const TICKS = [0, 12, 24, 36, 48]

interface ForecastSliderProps {
  corridor: Corridor
  hour: number
  onChange: (hour: number) => void
}

/**
 * 0–48 h corridor forecast slider (DEC-15). It only changes which pre-loaded hour is drawn;
 * it never triggers a network request.
 */
export function ForecastSlider({ corridor, hour, onChange }: ForecastSliderProps) {
  const label = formatDateTime(hourTime(corridor, hour))
  const set = (value: number) => onChange(Math.max(0, Math.min(MAX_HOUR, value)))

  return (
    <section className="overlay p-4 lg:px-6 lg:py-5" aria-label="Corridor forecast time">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Corridor forecast</p>
          <p className="mt-1 text-lg font-semibold text-ink" aria-live="polite">
            {label} <span className="text-brand">· departure + {hour} h</span>
          </p>
        </div>
        <p className="hidden max-w-xs text-right text-sm text-ink-muted md:block">
          Forecasts for all 49 hours are already loaded — moving the slider makes no new requests.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => set(hour - 1)}
            disabled={hour <= 0}
            aria-label="Previous hour"
            className="flex size-10 items-center justify-center rounded-[10px] border border-line bg-white text-ink hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => set(hour + 1)}
            disabled={hour >= MAX_HOUR}
            aria-label="Next hour"
            className="flex size-10 items-center justify-center rounded-[10px] border border-line bg-white text-ink hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={MAX_HOUR}
        step={1}
        value={hour}
        onChange={(event) => set(Number(event.target.value))}
        aria-label="Forecast hour after departure"
        aria-valuetext={`${label}, departure plus ${hour} hours`}
        className="mt-4 w-full accent-brand"
      />
      <ol className="mt-1 flex justify-between text-xs" aria-hidden="true">
        {TICKS.map((tick) => (
          <li
            key={tick}
            className={`text-center ${tick === 0 ? 'text-left' : tick === 48 ? 'text-right' : ''}`}
          >
            <span className="block font-semibold text-ink">+{tick} h</span>
            <span className="block text-ink-subtle">{formatDayTime(hourTime(corridor, tick))}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
