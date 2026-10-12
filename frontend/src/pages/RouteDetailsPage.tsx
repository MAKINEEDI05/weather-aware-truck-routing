import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { SearchX } from 'lucide-react'
import type { PlanResponse, Route } from '../api/types'
import { NoTripState } from '../components/PlanStates'
import { StateView } from '../components/StateViews'
import { TopBar } from '../components/TopBar'
import { CheckpointLayer, EndpointMarkers, RouteLayer, TripMap } from '../features/map'
import { MapLegend } from '../features/map/MapLegend'
import { CheckpointTable } from '../features/routes/CheckpointTable'
import type { LevelFilter } from '../features/routes/CheckpointTable'
import { RouteStatusBadge, RouteSwatch } from '../features/routes/RouteCard'
import { RouteStats } from '../features/routes/RouteStats'
import { boundsOf } from '../lib/bounds'
import { findRoute } from '../lib/routes'
import { buttonClass } from '../lib/ui'
import { useTrip } from '../state/TripContext'

export function RouteDetailsPage() {
  const { routeId } = useParams()
  const { result } = useTrip()
  const route = result ? findRoute(result, routeId) : undefined

  if (!result) {
    return (
      <>
        <TopBar title="Route details" />
        <NoTripState />
      </>
    )
  }
  if (!route) {
    return (
      <>
        <TopBar title="Route details" showTrip />
        <div className="p-4 lg:p-6">
          <StateView
            icon={SearchX}
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
  const bounds = useMemo(() => boundsOf([route]), [route])
  const selectedIndex = selectedCheckpoint?.routeId === route.id ? selectedCheckpoint.index : null

  useEffect(() => {
    selectRoute(route.id)
  }, [route.id, selectRoute])

  const select = (index: number) => selectCheckpoint({ routeId: route.id, index })

  return (
    <>
      <TopBar
        title="Route details"
        subtitle={
          <>
            <Link to="/routes" className="hover:text-brand">
              Routes
            </Link>{' '}
            / {route.label}
          </>
        }
        showTrip
      />
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Routes" className="flex flex-wrap gap-1 rounded-xl bg-slate-200/70 p-1">
            {[...result.routes]
              .sort((a, b) => a.provider_index - b.provider_index)
              .map((r) => (
                <Link
                  key={r.id}
                  to={`/routes/${r.id}`}
                  aria-current={r.id === route.id ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                    r.id === route.id
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <RouteSwatch routeId={r.id} className="h-1 w-5" />
                  {r.label}
                  {r.is_recommended && (
                    <>
                      {' '}
                      <span className="font-medium text-ink-muted">· Recommended</span>
                    </>
                  )}
                </Link>
              ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-ink-muted">
              Rank #{route.rank} of {result.routes.length}
            </span>
            <RouteStatusBadge route={route} />
          </div>
        </div>

        <RouteStats route={route} />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-6 xl:grid-cols-2">
          <section className="card flex flex-col overflow-hidden" aria-labelledby="route-map-title">
            <div className="border-b border-line px-4 py-3">
              <h2 id="route-map-title" className="text-base font-semibold text-ink">
                {route.label} · checkpoints every {result.request.checkpoint_interval_mi} mi
              </h2>
            </div>
            <div className="relative h-[420px] xl:h-[600px]">
              <TripMap bounds={bounds} weatherAttribution label={`${route.label} map`}>
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
                  openSelected
                />
                <EndpointMarkers
                  origin={result.request.origin}
                  destination={result.request.destination}
                />
              </TripMap>
              <MapLegend
                showEndpoints={false}
                className="absolute bottom-8 left-3 z-[500] hidden sm:block"
              />
            </div>
          </section>
          <div className="min-h-0 xl:h-[653px]">
            <CheckpointTable
              route={route}
              selectedIndex={selectedIndex}
              onSelect={select}
              filter={filter}
              onFilterChange={setFilter}
            />
          </div>
        </div>
      </div>
    </>
  )
}
