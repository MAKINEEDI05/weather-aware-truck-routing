import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, PLAN_TIMEOUT_MS, planTrip } from '../api/client'
import type { PlanRequest, PlanResponse } from '../api/types'
import { draftMatchesResult, emptyDraft, toPlanRequest } from '../features/trip-form/validation'
import type { TripDraft } from '../features/trip-form/validation'
import { defaultRouteId } from '../lib/routes'
import {
  clearSavedTrip,
  draftFromRequest,
  loadSavedTrip,
  saveTripResult,
  saveTripUi,
} from './tripStorage'
import type { SavedTrip } from './tripStorage'

export type PlanStatus = 'idle' | 'loading' | 'error'

export interface SelectedCheckpoint {
  routeId: string
  index: number
}

interface TripContextValue {
  draft: TripDraft
  updateDraft: (changes: Partial<TripDraft>) => void
  status: PlanStatus
  error: ApiError | null
  loadingSince: number | null
  /** The last successful plan. Kept while re-planning so other pages stay usable. */
  result: PlanResponse | null
  /** Browser time (ms) when `result` was calculated; null for results injected by tests. */
  calculatedAt: number | null
  /** True when `result` was restored from browser storage after a reload. */
  restored: boolean
  /** True when the form inputs no longer match the inputs that produced `result`. */
  outdated: boolean
  submitPlan: () => Promise<boolean>
  retryPlan: () => Promise<boolean>
  /** Clears the planner, the results and the saved trip. */
  newTrip: () => void
  /** Changes on every New trip, so forms can remount with fresh local state. */
  tripSession: number
  selectedRouteId: string | null
  selectRoute: (routeId: string) => void
  selectedCheckpoint: SelectedCheckpoint | null
  selectCheckpoint: (checkpoint: SelectedCheckpoint | null) => void
  hour: number
  setHour: (hour: number) => void
}

const TripContext = createContext<TripContextValue | null>(null)

interface TripProviderProps {
  children: ReactNode
  /** Test hooks: start with a result and/or a draft. Either one disables restoring. */
  initialResult?: PlanResponse
  initialDraft?: TripDraft
}

export function TripProvider({ children, initialResult, initialDraft }: TripProviderProps) {
  // Restore once, before the first render, so pages never flash the empty state.
  const [saved] = useState<SavedTrip | null>(() =>
    initialResult || initialDraft ? null : loadSavedTrip(),
  )
  const [draft, setDraft] = useState<TripDraft>(
    () =>
      saved?.draft ??
      initialDraft ??
      (initialResult ? draftFromRequest(initialResult) : emptyDraft()),
  )
  const [status, setStatus] = useState<PlanStatus>('idle')
  const [error, setError] = useState<ApiError | null>(null)
  const [loadingSince, setLoadingSince] = useState<number | null>(null)
  const [result, setResult] = useState<PlanResponse | null>(saved?.result ?? initialResult ?? null)
  const [calculatedAt, setCalculatedAt] = useState<number | null>(saved?.calculatedAt ?? null)
  const [restored, setRestored] = useState(saved !== null)
  // Whether the current result is in storage, i.e. UI changes should be saved alongside it.
  const [persisted, setPersisted] = useState(saved !== null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(() =>
    saved ? saved.selectedRouteId : initialResult ? (defaultRouteId(initialResult) ?? null) : null,
  )
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<SelectedCheckpoint | null>(
    saved?.selectedCheckpoint ?? null,
  )
  const [hour, setHourState] = useState(saved?.hour ?? 0)
  const [tripSession, setTripSession] = useState(0)
  const inFlight = useRef<AbortController | null>(null)
  const lastRequest = useRef<PlanRequest | null>(null)

  useEffect(() => () => inFlight.current?.abort(), [])

  // Keep the small UI record in step with the saved result.
  useEffect(() => {
    if (persisted && result && calculatedAt !== null) {
      saveTripUi(calculatedAt, { draft, selectedRouteId, selectedCheckpoint, hour })
    }
  }, [persisted, result, calculatedAt, draft, selectedRouteId, selectedCheckpoint, hour])

  const updateDraft = useCallback((changes: Partial<TripDraft>) => {
    setDraft((current) => ({ ...current, ...changes }))
  }, [])

  const run = useCallback(async (request: PlanRequest): Promise<boolean> => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    lastRequest.current = request
    let timedOut = false
    const timer = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, PLAN_TIMEOUT_MS)

    setStatus('loading')
    setError(null)
    setLoadingSince(Date.now())
    try {
      const response = await planTrip(request, controller.signal)
      const now = Date.now()
      setResult(response)
      setCalculatedAt(now)
      setRestored(false)
      setPersisted(saveTripResult(response, now))
      setSelectedRouteId(defaultRouteId(response) ?? null)
      setSelectedCheckpoint(null)
      setHourState(0)
      setStatus('idle')
      return true
    } catch (caught) {
      if (controller.signal.aborted && !timedOut) {
        return false // superseded by a newer request, New trip or unmounted
      }
      setError(
        timedOut
          ? new ApiError('Planning took too long. Try again.', null, 'CLIENT_TIMEOUT')
          : caught instanceof ApiError
            ? caught
            : new ApiError('Something went wrong while planning.', null, 'UNKNOWN'),
      )
      setStatus('error')
      return false
    } finally {
      window.clearTimeout(timer)
      setLoadingSince(null)
      if (inFlight.current === controller) {
        inFlight.current = null
      }
    }
  }, [])

  const submitPlan = useCallback(() => run(toPlanRequest(draft)), [draft, run])

  // Retry the last request; if there is none (e.g. state restored from a result), repeat the
  // request that produced the current result.
  const retryPlan = useCallback(() => {
    const request = lastRequest.current ?? result?.request ?? null
    return request ? run(request) : submitPlan()
  }, [run, submitPlan, result])

  const newTrip = useCallback(() => {
    inFlight.current?.abort()
    inFlight.current = null
    lastRequest.current = null
    clearSavedTrip()
    setPersisted(false)
    setDraft(emptyDraft())
    setResult(null)
    setCalculatedAt(null)
    setRestored(false)
    setStatus('idle')
    setError(null)
    setLoadingSince(null)
    setSelectedRouteId(null)
    setSelectedCheckpoint(null)
    setHourState(0)
    setTripSession((value) => value + 1)
  }, [])

  const selectRoute = useCallback((routeId: string) => {
    setSelectedRouteId(routeId)
    setSelectedCheckpoint((current) => (current?.routeId === routeId ? current : null))
  }, [])

  const setHour = useCallback((value: number) => {
    setHourState(Math.max(0, Math.min(48, Math.round(value))))
  }, [])

  const outdated = result !== null && !draftMatchesResult(draft, result)

  const value = useMemo<TripContextValue>(
    () => ({
      draft,
      updateDraft,
      status,
      error,
      loadingSince,
      result,
      calculatedAt,
      restored,
      outdated,
      submitPlan,
      retryPlan,
      newTrip,
      tripSession,
      selectedRouteId,
      selectRoute,
      selectedCheckpoint,
      selectCheckpoint: setSelectedCheckpoint,
      hour,
      setHour,
    }),
    [
      draft,
      updateDraft,
      status,
      error,
      loadingSince,
      result,
      calculatedAt,
      restored,
      outdated,
      submitPlan,
      retryPlan,
      newTrip,
      tripSession,
      selectedRouteId,
      selectRoute,
      selectedCheckpoint,
      hour,
      setHour,
    ],
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs with its provider
export function useTrip(): TripContextValue {
  const context = useContext(TripContext)
  if (!context) {
    throw new Error('useTrip must be used inside <TripProvider>.')
  }
  return context
}
