import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Tone = 'neutral' | 'danger' | 'warning' | 'blocked'

const TONES: Record<Tone, string> = {
  neutral: 'bg-accent-soft text-accent-ink',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-caution-soft text-caution',
  blocked: 'bg-closed-soft text-closed',
}

interface StateViewProps {
  icon: LucideIcon
  title: string
  children?: ReactNode
  actions?: ReactNode
  tone?: Tone
  role?: 'alert' | 'status'
  /** Draw as a blank sheet (empty states). */
  dashed?: boolean
}

/** Icon tile, title, sentence and actions, left-aligned like a notice — empty and error states. */
export function StateView({
  icon: Icon,
  title,
  children,
  actions,
  tone = 'neutral',
  role,
  dashed = false,
}: StateViewProps) {
  return (
    <div
      role={role}
      className={`flex flex-col gap-4 sm:flex-row sm:items-start ${
        dashed
          ? 'rounded-lg border border-dashed border-line-strong bg-surface p-6 sm:p-8'
          : 'p-5 sm:p-6'
      }`}
    >
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-md ${TONES[tone]}`}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg leading-snug font-bold">{title}</h2>
        {children && <div className="mt-1 max-w-prose text-[15px] text-ink-2">{children}</div>}
        {actions && <div className="mt-4 flex flex-wrap gap-2.5">{actions}</div>}
      </div>
    </div>
  )
}

interface LoadingStateProps {
  since: number | null
}

const PIPELINE = [
  'Truck routes from the routing service',
  'Forecast at each checkpoint for its ETA',
  'Risk scored, routes ranked',
]

/**
 * Planning in progress. The headline changes with elapsed time only (blueprint §6.7) — it does not
 * claim real progress. The steps list what the server does, not where it is.
 */
export function LoadingState({ since }: LoadingStateProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const elapsed = since === null ? 0 : Math.max(0, now - since)
  const seconds = Math.floor(elapsed / 1000)
  const [title, detail] =
    elapsed < 4000
      ? ['Finding routes…', 'Asking the routing service for truck routes.']
      : elapsed < 15000
        ? [
            'Fetching forecasts…',
            'Checking the weather at each checkpoint for the hour the truck arrives.',
          ]
        : ['Still working…', 'Long trips have many checkpoints. This can take up to a minute.']

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div role="status" aria-live="polite">
          <p className="kicker">Planning</p>
          <p className="mt-1 text-lg leading-snug font-bold">{title}</p>
          <p className="mt-0.5 text-sm text-ink-2">{detail}</p>
        </div>
        <p aria-hidden="true" className="num shrink-0 text-sm text-ink-3">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </p>
      </div>
      <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-paper-2">
        <div className="lane-dashes h-full motion-safe:animate-lane" />
      </div>
      <ol className="mt-4 grid gap-2 text-[13px] text-ink-2 sm:grid-cols-3">
        {PIPELINE.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="num text-ink-3">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  )
}
