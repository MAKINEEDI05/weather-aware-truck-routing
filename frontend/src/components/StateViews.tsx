import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { LoaderCircle } from 'lucide-react'

type Tone = 'neutral' | 'brand' | 'danger' | 'warning' | 'blocked'

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-ink-muted',
  brand: 'bg-brand-soft text-brand',
  danger: 'bg-red-50 text-red-600',
  warning: 'bg-amber-50 text-amber-600',
  blocked: 'bg-fuchsia-50 text-fuchsia-700',
}

interface StateViewProps {
  icon: LucideIcon
  title: string
  children?: ReactNode
  actions?: ReactNode
  tone?: Tone
  role?: 'alert' | 'status'
  dashed?: boolean
}

/** Centered icon, title, sentence and actions — used for empty and error states. */
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
      className={`flex flex-col items-center justify-center rounded-xl px-6 py-10 text-center ${
        dashed ? 'border border-dashed border-slate-300 bg-white' : ''
      }`}
    >
      <span className={`mb-4 flex size-14 items-center justify-center rounded-2xl ${TONES[tone]}`}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children && <div className="mt-2 max-w-sm text-sm text-ink-muted">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  )
}

interface LoadingStateProps {
  since: number | null
}

/**
 * Time-based loading text (blueprint §6.7) — it does not claim real progress.
 */
export function LoadingState({ since }: LoadingStateProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const elapsed = since === null ? 0 : Math.max(0, now - since)
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
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-brand-soft p-4">
        <LoaderCircle
          className="mt-0.5 size-5 shrink-0 animate-spin text-brand"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold text-blue-900">{title}</p>
          <p className="mt-0.5 text-sm text-blue-800">{detail}</p>
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" className="card space-y-3 p-4">
          <div className="h-3 w-1/3 rounded-full bg-slate-200 motion-safe:animate-pulse" />
          <div className="h-2 w-full rounded-full bg-slate-100 motion-safe:animate-pulse" />
          <div className="h-2 w-2/3 rounded-full bg-slate-100 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  )
}
