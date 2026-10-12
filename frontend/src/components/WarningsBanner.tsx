import { CloudOff, Info, TriangleAlert } from 'lucide-react'
import type { PlanWarning } from '../api/types'

const TITLES: Record<string, string> = {
  FEWER_THAN_THREE_ROUTES: 'Fewer than three routes.',
  WEATHER_PARTIAL: 'Some forecasts are missing.',
  WEATHER_UNAVAILABLE: 'Weather forecast unavailable.',
  CORRIDOR_WEATHER_PARTIAL: 'Heatmap partly unavailable.',
  INCOMPLETE_WEATHER_DATA: 'Incomplete weather data.',
  CORRIDOR_COARSENED: 'Coarser heatmap.',
}

interface WarningsBannerProps {
  warnings: PlanWarning[]
  /** Warning codes shown elsewhere (e.g. the heatmap cell size note). */
  exclude?: string[]
}

/** Backend warnings as margin notes: a rule on the left, the title in bold, the message verbatim. */
export function WarningsBanner({
  warnings,
  exclude = ['CORRIDOR_COARSENED'],
}: WarningsBannerProps) {
  const shown = warnings.filter((warning) => !exclude.includes(warning.code))
  if (!shown.length) {
    return null
  }
  return (
    <ul className="space-y-2" aria-label="Warnings">
      {shown.map((warning) => {
        const weather = warning.code.includes('WEATHER')
        const Icon =
          warning.code === 'WEATHER_UNAVAILABLE' ? CloudOff : weather ? TriangleAlert : Info
        return (
          <li
            key={warning.code}
            className={`flex gap-2.5 rounded-r-md border-l-[3px] px-3 py-2.5 text-sm text-ink ${
              weather ? 'border-l-[#e2b024] bg-caution-soft' : 'border-l-ink bg-paper-2'
            }`}
          >
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${weather ? 'text-caution' : 'text-ink-2'}`}
              aria-hidden="true"
            />
            <p>
              <strong className="font-semibold">{TITLES[warning.code] ?? 'Note.'}</strong>{' '}
              {warning.message}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
