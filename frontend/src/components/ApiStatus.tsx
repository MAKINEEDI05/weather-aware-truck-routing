import type { ApiHealth } from '../api/useApiHealth'

interface ApiStatusProps {
  health: ApiHealth
  onRetry: () => void
}

const STYLES: Record<ApiHealth['state'], { dot: string; label: string }> = {
  checking: { dot: 'bg-fog motion-safe:animate-pulse', label: 'checking…' },
  online: { dot: 'bg-[#3f9f62]', label: 'ok' },
  offline: { dot: 'bg-[#e5533f]', label: 'unreachable' },
}

/** Backend connection readout for the dark app bar. The state is always text, not colour alone. */
export function ApiStatus({ health, onRetry }: ApiStatusProps) {
  const style = STYLES[health.state]

  return (
    <div className="flex shrink-0 items-center gap-2">
      <p
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-md border border-asphalt-3 bg-asphalt-2 px-2.5 py-1 text-xs whitespace-nowrap text-fog"
      >
        <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
        <span className="font-mono">API: {style.label}</span>
        {health.state === 'online' && (
          <span className="hidden font-mono text-fog/75 sm:inline">v{health.version}</span>
        )}
      </p>
      {health.state === 'offline' && (
        <button
          type="button"
          onClick={onRetry}
          className="h-7 rounded-md bg-white px-2.5 text-xs font-semibold text-ink hover:bg-paper"
        >
          Retry
        </button>
      )}
    </div>
  )
}
