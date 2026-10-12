import { Link } from 'react-router'
import {
  Ban,
  Clock,
  CloudOff,
  KeyRound,
  RefreshCw,
  Route,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import type { ApiError } from '../api/client'
import { buttonClass } from '../lib/ui'
import { StateView } from './StateViews'

/** Pages that need a plan show this when there is none (design 08 "Empty"). */
export function NoTripState() {
  return (
    <div className="mx-auto w-full max-w-[1440px] p-4 lg:p-8">
      <StateView
        icon={Route}
        tone="neutral"
        dashed
        title="No trip planned yet"
        actions={
          <Link to="/plan" className={buttonClass('primary')}>
            Plan a trip
          </Link>
        }
      >
        Enter an origin, destination, departure time and load weight. Routes, the recommendation and
        the weather heatmap appear here once the trip is planned.
      </StateView>
    </div>
  )
}

const RETRY_LABEL = (
  <>
    <RefreshCw className="size-4" aria-hidden="true" /> Retry
  </>
)

interface PlanErrorStateProps {
  error: ApiError
  onRetry: () => void
  onEdit?: () => void
}

/** Planning failures, one message per contract error code (docs/API_CONTRACT.md §5). */
export function PlanErrorState({ error, onRetry, onEdit }: PlanErrorStateProps) {
  const retry = (
    <button type="button" onClick={onRetry} className={buttonClass('primary')}>
      {RETRY_LABEL}
    </button>
  )
  const edit = onEdit && (
    <button type="button" onClick={onEdit} className={buttonClass('secondary')}>
      Edit trip
    </button>
  )

  switch (error.code) {
    case 'NO_ROUTE_FOUND':
      return (
        <StateView
          icon={Ban}
          tone="danger"
          role="alert"
          title="No truck route found"
          actions={
            <>
              {edit}
              {retry}
            </>
          }
        >
          The routing service could not connect these locations by road. Try a different origin or
          destination.
        </StateView>
      )
    case 'RATE_LIMITED':
    case 'TOO_MANY_REQUESTS':
      return (
        <StateView
          icon={Clock}
          tone="warning"
          role="alert"
          title="Routing service is busy"
          actions={retry}
        >
          Too many requests right now. Your trip details are saved — try again
          {error.retryAfterS ? ` in about ${error.retryAfterS} seconds` : ' in a moment'}.
        </StateView>
      )
    case 'ROUTING_NOT_CONFIGURED':
      return (
        <StateView
          icon={KeyRound}
          tone="danger"
          role="alert"
          title="Routing is not configured"
          actions={retry}
        >
          The server has no TomTom API key. Add <code className="font-mono">TOMTOM_API_KEY</code> to
          the backend environment and restart the server.
        </StateView>
      )
    case 'ROUTING_CONFIGURATION_ERROR':
      return (
        <StateView
          icon={KeyRound}
          tone="danger"
          role="alert"
          title="Routing provider rejected the key"
          actions={retry}
        >
          The TomTom API key on the server was rejected (invalid, inactive or over quota).
        </StateView>
      )
    case 'UPSTREAM_TIMEOUT':
    case 'CLIENT_TIMEOUT':
      return (
        <StateView
          icon={Timer}
          tone="warning"
          role="alert"
          title="This took too long"
          actions={retry}
        >
          {error.message} Your trip details are saved.
        </StateView>
      )
    case 'NETWORK_ERROR':
      return (
        <StateView
          icon={CloudOff}
          tone="danger"
          role="alert"
          title="Backend unavailable"
          actions={retry}
        >
          Could not reach the backend. Check that the Django server is running, then retry.
        </StateView>
      )
    default:
      return (
        <StateView
          icon={TriangleAlert}
          tone="danger"
          role="alert"
          title="Planning failed"
          actions={
            <>
              {edit}
              {retry}
            </>
          }
        >
          {error.message}
        </StateView>
      )
  }
}
