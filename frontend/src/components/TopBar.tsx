import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, useOutletContext } from 'react-router'
import { CalendarDays, MapPin, Pencil, Weight } from 'lucide-react'
import type { ApiHealth } from '../api/useApiHealth'
import { BRAND_NAME } from '../assets/brand'
import { formatDateTime, formatLoad } from '../lib/format'
import { buttonClass } from '../lib/ui'
import { useTrip } from '../state/TripContext'
import { ApiStatus } from './ApiStatus'
import { BrandMark } from './BrandMark'

export interface LayoutContext {
  health: ApiHealth
  retryHealth: () => void
}

interface TopBarProps {
  title: string
  subtitle?: ReactNode
  /** Show the planned trip as chips and an "Edit trip" button. */
  showTrip?: boolean
}

/** Page header: white bar on desktop, navy bar on mobile. Also hosts the API status. */
export function TopBar({ title, subtitle, showTrip = false }: TopBarProps) {
  const { health, retryHealth } = useOutletContext<LayoutContext>()
  const { result } = useTrip()

  useEffect(() => {
    document.title = `${title} · ${BRAND_NAME}`
  }, [title])

  const request = result?.request
  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 bg-navy-950 px-4 text-white lg:border-b lg:border-line lg:bg-white lg:px-6 lg:text-ink">
        <span className="lg:hidden">
          <BrandMark size="sm" />
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="truncate text-lg font-semibold tracking-tight lg:text-xl">{title}</h1>
          {subtitle && (
            <span className="hidden truncate text-sm text-ink-subtle md:inline">{subtitle}</span>
          )}
        </div>
        {showTrip && request && (
          <div className="hidden items-center gap-2 xl:flex" aria-label="Planned trip">
            <Chip icon={<MapPin className="size-3.5" />}>
              {request.origin.label} → {request.destination.label}
            </Chip>
            <Chip icon={<CalendarDays className="size-3.5" />}>
              {formatDateTime(request.departure_time)}
            </Chip>
            <Chip icon={<Weight className="size-3.5" />}>{formatLoad(request.load_weight_lb)}</Chip>
            <Chip>Every {request.checkpoint_interval_mi} mi</Chip>
          </div>
        )}
        {showTrip && request && (
          <span className="hidden lg:block">
            <Link to="/plan" className={buttonClass('secondary', 'sm')}>
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit trip
            </Link>
          </span>
        )}
        <ApiStatus health={health} onRetry={retryHealth} />
      </header>
      {health.state === 'offline' && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 lg:px-6"
        >
          <span className="font-semibold">Backend unavailable.</span> {health.message} Make sure the
          Django server is running, then select Retry.
        </div>
      )}
    </>
  )
}

function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-72 items-center gap-1.5 truncate rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-ink-muted">
      {icon && (
        <span aria-hidden="true" className="text-ink-subtle">
          {icon}
        </span>
      )}
      <span className="truncate">{children}</span>
    </span>
  )
}
