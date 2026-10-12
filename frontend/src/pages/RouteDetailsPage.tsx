import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft, ChevronRight, MousePointerClick, SearchX } from 'lucide-react'
import type { PlanResponse, Route } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { NoTripState } from '../components/PlanStates'
import { RouteProfile } from '../components/RouteProfile'
import { RouteShield } from '../components/RouteShield'
import { StateView } from '../components/StateViews'
import { CheckpointLayer, EndpointMarkers, RouteLayer, TripMap } from '../features/map'
import { MapLegend } from '../features/map/MapLegend'
import { CheckpointDetail } from '../features/routes/CheckpointDetail'
import { CheckpointTable } from '../features/routes/CheckpointTable'
import type { LevelFilter } from '../features/routes/CheckpointTable'
import { RouteStatusBadge } from '../features/routes/RouteCard'
import { RouteStats } from '../features/routes/RouteStats'
import { boundsOf } from '../lib/bounds'
import { findRoute, routesByRank } from '../lib/routes'
import { buttonClass } from '../lib/ui'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useTrip } from '../state/TripContext'

export function RouteDetailsPage() {
  const { routeId } = useParams()
  const { result } = useTrip()
  const route = result ? findRoute(result, routeId) : undefined

  if (!result) {
    return (
      <>
        <PageHeader title="Route details" kicker="Step 2 · Routes" />
        <NoTripState />
      </>
    )
  }
  if (!route) {
    return (
      <>
        <PageHeader title="Route details" kicker="Step 2 · Routes" trip />
        <div className="mx-auto w-full max-w-[1440px] p-4 lg:p-8">
          <StateView
            icon={SearchX}
            dashed
            title={`There is no Route ${routeId ?? ''}`}
            actions={
              <Link to="/routes" className={buttonClass('primary')}>
                Back to routes
              </Link>
            }
          >
            This trip has {result.routes.length} route{result.routes.length === 1 ? '' : 's'}:{' '}
            {result.routes.map((r) => r.id).join(', ')}.
          </StateView>
        </div>
      </>
    )
  }
  return <RouteDetails result={result} route={route} />
}

function RouteDetails({ result, route }: { result: PlanResponse; route: Route }) {
  const { selectRoute, selectedCheckpoint, selectCheckpoint } = useTrip()
  const [filter, setFilter] = useState<LevelFilter>('ALL')
  const keyBar = useMediaQuery('(min-width: 640px)')
  const bounds = useMemo(() => boundsOf([route]), [route])
  const selectedIndex = selectedCheckpoint?.routeId === route.id ? selectedCheckpoint.index : null
  const position = route.checkpoints.findIndex((c) => c.index === selectedIndex)
  const selected = position >= 0 ? route.checkpoints[position] : undefined

  useEffect(() => {
    selectRoute(route.id)
  }, [route.id, selectRoute])

  const select = (index: number) => selectCheckpoint({ routeId: route.id, index })
  const step = (delta: number) => {
    const next = route.checkpoints[position + delta]
    if (next) select(next.index)
  }

  return (
    <>
      <PageHeader
        title={route.label}
        kicker={
          <>
            <Link to="/routes" className="underline underline-offset-2 hover:text-ink">
              Routes
            </Link>{' '}
            / Route details
          </>
        }
        aside={
          <span className="flex items-center gap-2">
            <span className="num rounded-[4px] border border-line-strong px-1.5 py-px text-xs text-ink-2">
              Rank #{route.rank} of {result.routes.length}
            </span>
            <RouteStatusBadge route={route} />
          </span>
        }
        trip
      />

      <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 lg:space-y-6 lg:p-8">
        <nav aria-label="Routes" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <div className="flex w-max gap-1 rounded-lg border border-line bg-surface p-1">
            {routesByRank(result).map((r) => (
              <Link
                key={r.id}
                to={`/routes/${r.id}`}
                aria-current={r.id === route.id ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${
                  r.id === route.id
                    ? 'bg-accent text-white'
                    : 'text-ink-2 hover:bg-paper hover:text-ink'
                }`}
              >
                <RouteShield routeId={r.id} size="sm" />
                <span aria-hidden="true" className="num text-[11px] opacity-60">
                  #{r.rank}
                </span>
                {r.label}
                {r.is_recommended && (
                  <>
                    {' '}
                    <span className="font-medium opacity-75">· Recommended</span>
                  </>
                )}
              </Link>
            ))}
          </div>
        </nav>

        <RouteStats route={route} />

        <section className="panel px-4 pt-3 pb-2 lg:px-5" aria-labelledby="profile-title">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="profile-title" className="text-base font-bold">
              Risk along the route
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-ink-3">
              <MousePointerClick className="size-3.5" aria-hidden="true" />
              Origin to destination · select a stretch to inspect its checkpoint
            </p>
          </div>
          <RouteProfile
            route={route}
            className="h-6"
            selectedIndex={selectedIndex}
            onSelect={select}
            axis
          />
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section
            className="panel flex flex-col overflow-hidden"
            aria-labelledby="route-map-title"
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
              <h2 id="route-map-title" className="text-base font-bold">
                Map
              </h2>
              <span className="text-xs text-ink-3">
                Checkpoints every {result.request.checkpoint_interval_mi} mi
              </span>
            </div>
            <div className="relative h-[52vh] min-h-[340px] xl:h-[640px]">
              <TripMap
                bounds={bounds}
                paddingTopLeft={keyBar ? [40, 40] : [20, 20]}
                paddingBottomRight={keyBar ? [40, 72] : [20, 20]}
                weatherAttribution
                label={`${route.label} map`}
              >
                <RouteLayer
                  routes={result.routes}
                  selectedId={route.id}
                  onSelect={selectRoute}
                  emphasizeSelected
                />
                <CheckpointLayer
                  route={route}
                  selectedIndex={selectedIndex}
                  onSelect={select}
                  popups={false}
                  panToSelected
                />
                <EndpointMarkers
                  origin={result.request.origin}
                  destination={result.request.destination}
                />
              </TripMap>
              <MapLegend
                showEndpoints={false}
                className="absolute bottom-7 left-3 z-[500] hidden sm:flex"
              />
            </div>
          </section>

          <div className="flex min-h-0 flex-col gap-5 xl:h-[693px]">
            <section className="panel shrink-0 overflow-hidden" aria-label="Selected checkpoint">
              {selected ? (
                <>
                  <CheckpointDetail route={route} checkpoint={selected} />
                  <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      disabled={position <= 0}
                      className={buttonClass('ghost', 'sm')}
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                      Previous checkpoint
                    </button>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      disabled={position >= route.checkpoints.length - 1}
                      className={buttonClass('ghost', 'sm')}
                    >
                      Next checkpoint
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 p-4 text-sm text-ink-2">
                  <MousePointerClick className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>
                    <span className="font-semibold text-ink">No checkpoint selected.</span> Choose
                    one on the map, on the strip above or in the table to see its forecast, ETA and
                    the rule that set its level.
                  </p>
                </div>
              )}
            </section>
            <CheckpointTable
              route={route}
              selectedIndex={selectedIndex}
              onSelect={select}
              filter={filter}
              onFilterChange={setFilter}
              className="max-h-[70vh] flex-1 xl:max-h-none"
            />
          </div>
        </div>
      </div>
    </>
  )
}
