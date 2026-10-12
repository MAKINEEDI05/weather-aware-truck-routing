import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, History, TriangleAlert } from 'lucide-react'
import { formatAge, formatDateTime } from '../lib/format'
import { useTrip } from '../state/TripContext'

/**
 * Says how far the results on screen can be trusted: outdated when the form inputs have changed
 * since they were calculated, or restored (with the calculation time) after a reload. Restored
 * forecasts are never presented as current.
 */
export function ResultNotice() {
  const { result, restored, outdated, calculatedAt } = useTrip()
  const now = useNow()
  if (!result || (!restored && !outdated)) return null

  if (outdated) {
    return (
      <aside
        aria-label="Results status"
        className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#ecd9a0] bg-caution-soft px-4 py-2.5 text-sm text-ink lg:px-6"
      >
        <TriangleAlert className="size-4 shrink-0 text-caution" aria-hidden="true" />
        <p className="min-w-0 flex-[1_1_16rem]">
          <strong className="font-semibold">Outdated results.</strong> You changed the trip inputs
          after these routes were calculated, so they still show the previous trip above. Plan again
          to see results for the new inputs.
        </p>
        <Link
          to="/plan"
          className="inline-flex items-center gap-1 font-semibold text-accent-ink underline underline-offset-2"
        >
          Review and plan again
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </aside>
    )
  }

  const calculated = result.meta.generated_at
  const age = formatAge(now - (calculatedAt ?? Date.parse(calculated)))
  return (
    <aside
      aria-label="Results status"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-accent/20 bg-accent-soft px-4 py-2.5 text-sm text-ink lg:px-6"
    >
      <History className="size-4 shrink-0 text-accent-ink" aria-hidden="true" />
      <p className="min-w-0 flex-[1_1_16rem]">
        <strong className="font-semibold">Restored after reload.</strong> Calculated{' '}
        <span className="num text-[13px]">{formatDateTime(calculated)}</span> ({age}). Forecasts
        were not refreshed and may have changed since.
      </p>
      <Link
        to="/plan"
        className="inline-flex items-center gap-1 font-semibold text-accent-ink underline underline-offset-2"
      >
        Plan again for current weather
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </aside>
  )
}

/** The current time, refreshed every minute so "N min ago" stays true. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}
