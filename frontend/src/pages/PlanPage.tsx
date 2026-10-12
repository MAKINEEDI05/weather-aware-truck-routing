import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { MousePointerClick, Plus } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { PlanErrorState } from '../components/PlanStates'
import { RankingList, RiskRulesTable } from '../components/RulesContent'
import { LoadingState } from '../components/StateViews'
import { EndpointMarkers, TripMap } from '../features/map'
import { EndpointGlyph } from '../features/trip-form/LocationSearch'
import { TripForm } from '../features/trip-form/TripForm'
import { boundsOf } from '../lib/bounds'
import { buttonClass } from '../lib/ui'
import { useTrip } from '../state/TripContext'

export function PlanPage() {
  const { draft, status, error, loadingSince, result, retryPlan, newTrip, tripSession } = useTrip()
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
  const hasTrip =
    result !== null || draft.origin !== null || draft.destination !== null || draft.loadText !== ''
  const loading = status === 'loading'
  const errorPanel = useRef<HTMLElement>(null)

  // The submit button sits at the foot of the form; bring a planning failure into view.
  useEffect(() => {
    if (showError) {
      errorPanel.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    }
  }, [showError, error])

  return (
    <>
      <PageHeader
        title="Plan a trip"
        kicker={result ? 'Step 1 · Edit trip' : 'Step 1 · New trip'}
        aside={
          hasTrip && (
            <button
              type="button"
              onClick={() => {
                newTrip()
                navigate('/plan', { replace: true, state: { focus: 'origin-input' } })
              }}
              className={buttonClass('secondary', 'sm')}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              New trip
            </button>
          )
        }
        description="Search for each place and pick the right match, then set when the truck leaves and what it carries. The routing service returns up to three truck routes to compare."
      />
      <div className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-[minmax(0,1fr)] gap-6 p-4 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)] lg:gap-8 lg:p-8">
        <section className="panel self-start p-5 lg:p-6" aria-labelledby="trip-details-title">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 id="trip-details-title" className="text-lg font-bold">
              Trip details
            </h2>
            <span className="kicker">All fields required</span>
          </div>
          <TripForm key={tripSession} onPlanned={() => navigate('/routes')} />
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {showError && (
            <section ref={errorPanel} className="panel scroll-mt-20" aria-label="Planning failed">
              <PlanErrorState
                error={error}
                onRetry={() => void retryPlan().then((ok) => ok && navigate('/routes'))}
                onEdit={() => document.getElementById('origin-input')?.focus()}
              />
            </section>
          )}

          <section className="panel overflow-hidden" aria-labelledby="preview-title">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-3">
              <h2 id="preview-title" className="text-base font-bold">
                Map preview
              </h2>
              <span className="flex items-center gap-3 text-xs text-ink-3">
                <span className="flex items-center gap-1.5">
                  <EndpointGlyph tone="origin" /> Origin
                </span>
                <span className="flex items-center gap-1.5">
                  <EndpointGlyph tone="destination" /> Destination
                </span>
              </span>
            </div>
            <div className="relative h-[280px] sm:h-[360px] lg:h-[480px]">
              <TripMap bounds={bounds} label="Map preview of the selected places">
                <EndpointMarkers origin={draft.origin} destination={draft.destination} />
              </TripMap>
              {loading ? (
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-paper/70 p-4 backdrop-blur-[2px]">
                  <section className="float w-full max-w-lg p-5" aria-label="Planning in progress">
                    <LoadingState since={loadingSince} />
                  </section>
                </div>
              ) : (
                !(draft.origin && draft.destination) && (
                  <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex justify-center px-4">
                    <p className="float flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink">
                      <MousePointerClick
                        className="size-4 shrink-0 text-ink-2"
                        aria-hidden="true"
                      />
                      {draft.origin
                        ? 'Pick a destination to see up to three route options.'
                        : 'Pick an origin and a destination to see up to three route options.'}
                    </p>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="panel" aria-labelledby="scoring-title">
            <div className="min-w-0 p-5">
              <h2 id="scoring-title" className="text-base font-bold">
                How each checkpoint is scored
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-3">
                Assessment thresholds, applied by the server to the forecast at each ETA.
              </p>
              <div className="mt-2">
                <RiskRulesTable />
              </div>
            </div>
            <div className="border-t border-line p-5">
              <h3 className="text-base font-bold">How routes are ranked</h3>
              <p className="mt-0.5 text-[13px] text-ink-3">
                Compared in order; the first difference decides. A route with any No Travel miles
                keeps its rank but is never recommended.
              </p>
              <div className="mt-3">
                <RankingList compact layout="row" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
