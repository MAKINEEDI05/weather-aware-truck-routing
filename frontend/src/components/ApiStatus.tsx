import type { ApiHealth } from '../api/useApiHealth'

interface ApiStatusProps {
  health: ApiHealth
  onRetry: () => void
}

const STYLES: Record<ApiHealth['state'], { dot: string; label: string }> = {
  checking: { dot: 'bg-slate-400 motion-safe:animate-pulse', label: 'checking…' },
  online: { dot: 'bg-emerald-500', label: 'ok' },
  offline: { dot: 'bg-red-500', label: 'unreachable' },
}

/** Compact backend connection indicator. The state is always given as text, not colour alone. */
export function ApiStatus({ health, onRetry }: ApiStatusProps) {
  const style = STYLES[health.state]

  return (
    <div className="flex shrink-0 items-center gap-2">
      <p
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-full whitespace-nowrap border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
      >
        <span aria-hidden="true" className={`size-2 rounded-full ${style.dot}`} />
        <span>API: {style.label}</span>
        {health.state === 'online' && (
          <span className="hidden text-slate-400 sm:inline">v{health.version}</span>
        )}
      </p>
      {health.state === 'offline' && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Retry
        </button>
      )}
    </div>
  )
}
