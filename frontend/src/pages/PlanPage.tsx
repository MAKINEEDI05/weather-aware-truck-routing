import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Route as RouteIcon } from 'lucide-react'
import { PlanErrorState } from '../components/PlanStates'
import { RiskRulesTable } from '../components/RulesContent'
import { LoadingState } from '../components/StateViews'
import { TopBar } from '../components/TopBar'
import { EndpointMarkers, TripMap } from '../features/map'
import { TripForm } from '../features/trip-form/TripForm'
import { boundsOf } from '../lib/bounds'
import { useTrip } from '../state/TripContext'

export function PlanPage() {
  const { draft, status, error, loadingSince, result, retryPlan } = useTrip()
  const navigate = useNavigate()
  const location = useLocation()

  // "Try a later departure" (recommendation page) lands here with the departure field focused.
  useEffect(() => {
    const state = location.state as { focus?: string } | null
    if (state?.focus) {
      document.getElementById(state.focus)?.focus()
    }
  }, [location.state])

  const bounds = useMemo(
    () => boundsOf([], [draft.origin, draft.destination]),
    [draft.origin, draft.destination],
  )
  const showError = status === 'error' && error !== null && error.status !== 400

  return (
    <>
      <TopBar title="Plan a trip" subtitle={result ? 'Edit trip' : 'New trip'} showTrip />
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-6 p-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:p-6">
        <section className="card self-start p-5 lg:p-6" aria-labelledby="trip-details-title">
          <div className="mb-5 flex items-baseline justify-between border-b border-line pb-4">
            <h2 id="trip-details-title" className="text-base font-semibold text-ink">
              Trip details
            </h2>
            <span className="text-sm text-ink-subtle">All fields required</span>
          </div>
          <TripForm onPlanned={() => navigate('/routes')} />
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {status === 'loading' && (
            <section className="card p-5" aria-label="Planning in progress">
              <LoadingState since={loadingSince} />
            </section>
          )}
          {showError && (
            <section className="card" aria-label="Planning failed">
              <PlanErrorState
                error={error}
                onRetry={() => void retryPlan().then((ok) => ok && navigate('/routes'))}
                onEdit={() => document.getElementById('origin-input')?.focus()}
              />
            </section>
          )}

          <section className="card hidden overflow-hidden lg:block" aria-labelledby="preview-title">
            <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <h2 id="preview-title" className="text-base font-semibold text-ink">
                Map preview
              </h2>
              <span className="text-sm text-ink-subtle">Routes appear after planning</span>
            </div>
            <div className="relative h-[420px]">
              <TripMap bounds={bounds} label="Map preview of the selected places">
                <EndpointMarkers origin={draft.origin} destination={draft.destination} />
              </TripMap>
              {!(draft.origin && draft.destination) && (
                <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[500] flex -translate-y-1/2 justify-center px-6">
                  <p className="overlay flex items-center gap-3 px-4 py-3 text-sm text-ink">
                    <RouteIcon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                    {draft.origin
                      ? 'Pick a destination to see up to three route options.'
                      : 'Pick an origin and a destination to see up to three route options.'}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="card hidden lg:block" aria-labelledby="scoring-title">
            <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <h2 id="scoring-title" className="text-base font-semibold text-ink">
                How each checkpoint is scored
              </h2>
              <span className="text-sm text-ink-subtle">From the assessment risk rules</span>
            </div>
            <div className="py-3">
              <RiskRulesTable />
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
