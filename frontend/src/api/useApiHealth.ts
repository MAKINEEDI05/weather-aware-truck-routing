import { useCallback, useEffect, useState } from 'react'
import { ApiError, fetchHealth } from './client'

export const HEALTH_TIMEOUT_MS = 5000

export type ApiHealth =
  | { state: 'checking' }
  | { state: 'online'; version: string }
  | { state: 'offline'; message: string }

function describeFailure(error: unknown, timedOut: boolean): string {
  if (timedOut) {
    return 'The backend did not respond in time.'
  }
  if (error instanceof ApiError) {
    return error.message
  }
  return 'The backend could not be reached.'
}

/** Checks the backend health endpoint once on mount and again on each `retry()`. */
export function useApiHealth(): { health: ApiHealth; retry: () => void } {
  const [health, setHealth] = useState<ApiHealth>({ state: 'checking' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timedOut = false
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, HEALTH_TIMEOUT_MS)

    fetchHealth(controller.signal)
      .then((result) => {
        if (!cancelled) {
          setHealth({ state: 'online', version: result.version })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHealth({ state: 'offline', message: describeFailure(error, timedOut) })
        }
      })
      .finally(() => window.clearTimeout(timer))

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [attempt])

  const retry = useCallback(() => {
    setHealth({ state: 'checking' })
    setAttempt((value) => value + 1)
  }, [])

  return { health, retry }
}
