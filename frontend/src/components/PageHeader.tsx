import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { MoveRight, Pencil, Plus } from 'lucide-react'
import { BRAND_NAME } from '../assets/brand'
import { formatDateTime, formatLoad } from '../lib/format'
import { buttonClass } from '../lib/ui'
import { useTrip } from '../state/TripContext'
import { ResultNotice } from './ResultNotice'

interface PageHeaderProps {
  title: string
  /** Small signage label above the title. */
  kicker?: ReactNode
  description?: ReactNode
  /** Show the planned trip, Edit trip / New trip, and the results status notice. */
  trip?: boolean
  /** Status tags and similar, shown next to the title. */
  aside?: ReactNode
  /** One slim row for full-height map pages. */
  compact?: boolean
}

/** Page title block. Sets the document title; the h1 of every workspace page lives here. */
export function PageHeader({
  title,
  kicker,
  description,
  trip = false,
  aside,
  compact = false,
}: PageHeaderProps) {
  useEffect(() => {
    document.title = `${title} · ${BRAND_NAME}`
  }, [title])

  if (compact) {
    return (
      <>
        <header className="shrink-0 border-b border-line bg-surface px-4 py-3 lg:px-6">
          <div className="flex flex-col gap-x-6 gap-y-2 lg:flex-row lg:items-center">
            <h1 className="shrink-0 text-lg leading-tight font-bold tracking-tight lg:text-xl">
              {title}
            </h1>
            {trip && <TripStrip />}
          </div>
        </header>
        {trip && <ResultNotice />}
      </>
    )
  }

  return (
    <>
      <header className="header-band border-b border-line">
        <div className="mx-auto max-w-[1440px] px-4 pt-6 pb-5 lg:px-8 lg:pt-8 lg:pb-6">
          {kicker && <p className="kicker !text-accent-ink">{kicker}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-[26px] leading-tight font-bold tracking-tight lg:text-[32px]">
              {title}
            </h1>
            {aside}
          </div>
          {description && (
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</p>
          )}
          {trip && (
            <div className="mt-4 border-t border-line pt-3">
              <TripStrip />
            </div>
          )}
        </div>
      </header>
      {trip && <ResultNotice />}
    </>
  )
}

/** The planned trip as one line: origin → destination, departure, load and interval. */
export function TripStrip() {
  const { result, newTrip } = useTrip()
  const navigate = useNavigate()
  const request = result?.request
  if (!request) return null

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
      <dl className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <dt className="sr-only">Trip</dt>
          <dd className="flex min-w-0 items-center gap-2 font-semibold">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full border-[3px] border-ink"
            />
            <span className="truncate">{request.origin.label}</span>
            <MoveRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
            <span className="sr-only">to</span>
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px] bg-ink" />
            <span className="truncate">{request.destination.label}</span>
          </dd>
        </div>
        <Field label="Departs">{formatDateTime(request.departure_time)}</Field>
        <Field label="Load">{formatLoad(request.load_weight_lb)}</Field>
        <Field label="Every">{request.checkpoint_interval_mi} mi</Field>
      </dl>
      <div className="ml-auto flex gap-2">
        <Link to="/plan" className={buttonClass('secondary', 'sm')}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit trip
        </Link>
        <button
          type="button"
          onClick={() => {
            newTrip()
            navigate('/plan', { state: { focus: 'origin-input' } })
          }}
          className={buttonClass(
            'ghost',
            'sm',
            'border border-transparent hover:border-line-strong',
          )}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New trip
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <dt className="kicker">{label}</dt>
      <dd className="num text-[13px] text-ink">{children}</dd>
    </div>
  )
}
