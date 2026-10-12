import { useMemo } from 'react'
import { Link } from 'react-router'
import { CircleCheck, CloudOff, LayoutGrid, Pencil, TriangleAlert } from 'lucide-react'
import type { PlanResponse } from '../api/types'
import { NoTripState } from '../components/PlanStates'
import { TopBar } from '../components/TopBar'
import { WarningsBanner } from '../components/WarningsBanner'
import { CheckpointLayer, EndpointMarkers, RouteLayer, TripMap } from '../features/map'
import { InlineRiskLegend, MapLegend } from '../features/map/MapLegend'
import { CRITERIA, runnerUp } from '../features/recommendation/criteria'
import { RouteCard } from '../features/routes/RouteCard'
import { boundsOf } from '../lib/bounds'
import { formatDateTime, formatLoad } from '../lib/format'
import { findRoute, routesByRank } from '../lib/routes'
import { buttonClass } from '../lib/ui'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useTrip } from '../state/TripContext'

export function RoutesPage() {
  const { result } = useTrip()
  if (!result) {
    return (
      <>
        <TopBar title="Route comparison" />
        <NoTripState />
      </>
    )
  }
  return <RouteComparison result={result} />
}

function RouteComparison({ result }: { result: PlanResponse }) {
  const { selectedRouteId, selectRoute } = useTrip()
  const desktop = useIsDesktop()
  const ranked = routesByRank(result)
  const bounds = useMemo(() => boundsOf(result.routes), [result])
  const selected = findRoute(result, selectedRouteId) ?? ranked[0]
  const request = result.request
  // Selected route's checkpoints are drawn last so they sit on top.
  const drawOrder = [...result.routes].sort(
    (a, b) => Number(a.id === selected?.id) - Number(b.id === selected?.id),
  )

  return (
    <>
      <TopBar title="Route comparison" showTrip />

      <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">
            {request.origin.label} → {request.destination.label}
          </p>
          <p className="text-sm text-ink-muted">
            {formatDateTime(request.departure_time)} · {formatLoad(request.load_weight_lb)} · every{' '}
            {request.checkpoint_interval_mi} mi
          </p>
        </div>
        <Link to="/plan" className={buttonClass('secondary', 'sm')}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </Link>
      </div>

      <div className="relative flex-1 lg:h-[calc(100dvh-4rem)] lg:flex-none">
        <div className="relative h-[48vh] lg:absolute lg:inset-0 lg:h-auto">
          <TripMap
            bounds={bounds}
            paddingTopLeft={desktop ? [460, 40] : [16, 16]}
            paddingBottomRight={desktop ? [32, 32] : [16, 16]}
            weatherAttribution
            label="Route comparison map"
          >
            <RouteLayer routes={result.routes} selectedId={selected?.id} onSelect={selectRoute} />
            {drawOrder.map((route) => (
              <CheckpointLayer
                key={route.id}
                route={route}
                radius={route.id === selected?.id ? 5 : 4}
              />
            ))}
            <EndpointMarkers origin={request.origin} destination={request.destination} />
          </TripMap>
          <MapLegend
            routeIds={result.routes.map((route) => route.id)}
            className="absolute right-4 bottom-8 z-[500] hidden lg:block"
          />
        </div>

        <div className="border-b border-line bg-white px-4 py-2.5 lg:hidden">
          <InlineRiskLegend />
        </div>

        <aside
          aria-label="Routes"
          className="space-y-3 p-4 lg:absolute lg:top-4 lg:bottom-4 lg:left-4 lg:z-[500] lg:w-[420px] lg:overflow-y-auto lg:p-0"
        >
          <div className="overlay flex items-center gap-2 px-4 py-3">
            <p className="text-sm text-ink-muted">
              <span className="font-semibold text-ink">
                {result.routes.length} route{result.routes.length === 1 ? '' : 's'}
              </span>{' '}
              ranked by the assessment priority
            </p>
            <Link
              to="/recommendation"
              className="ml-auto text-sm font-semibold text-brand hover:underline"
            >
              Details
            </Link>
          </div>
          <RecommendationLine result={result} />
          <WarningsBanner warnings={result.warnings} />
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {ranked.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                selected={route.id === selected?.id}
                onSelect={() => selectRoute(route.id)}
                className="w-[85%] shrink-0 snap-start sm:w-80 lg:w-auto"
              />
            ))}
          </div>
          <p className="text-center text-xs text-ink-subtle lg:hidden">
            Ranked by Severe miles → High miles → average risk → travel time
          </p>
          <div className="grid grid-cols-2 gap-3 lg:hidden">
            <Link to={`/routes/${selected?.id ?? ''}`} className={buttonClass('secondary', 'lg')}>
              Route details
            </Link>
            <Link to="/heatmap" className={buttonClass('secondary', 'lg')}>
              <LayoutGrid className="size-5" aria-hidden="true" />
              Heatmap
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}

function RecommendationLine({ result }: { result: PlanResponse }) {
  const { recommendation } = result
  if (recommendation.status === 'RECOMMENDED') {
    const route = findRoute(result, recommendation.route_id)
    const runner = runnerUp(recommendation.comparisons)
    const criterion = CRITERIA.find((c) => c.key === runner?.decided_by)
    return (
      <Link
        to="/recommendation"
        className="overlay flex items-center gap-2 px-4 py-3 text-sm hover:border-green-300"
      >
        <CircleCheck className="size-5 shrink-0 text-green-600" aria-hidden="true" />
        <span>
          <span className="font-semibold text-ink">{route?.label} recommended</span>
          {criterion && runner && runner.other_rank > (route?.rank ?? 0) && (
            <>
              {' '}
              <span className="text-ink-muted">— {criterion.phrase}</span>
            </>
          )}
        </span>
      </Link>
    )
  }
  if (recommendation.status === 'NO_ELIGIBLE_ROUTE') {
    return (
      <Link
        to="/recommendation"
        className="flex items-start gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-900"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">No route can be recommended.</span> Every route has No
          Travel conditions at the planned departure time.
        </span>
      </Link>
    )
  }
  return (
    <Link
      to="/recommendation"
      className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">No recommendation.</span> No checkpoint could be scored
        because no forecast data was available.
      </span>
    </Link>
  )
}
