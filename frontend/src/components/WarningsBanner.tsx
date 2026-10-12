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
            className={`flex gap-3 rounded-xl border p-3 text-sm ${
              weather
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-blue-200 bg-brand-soft text-blue-900'
            }`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
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
