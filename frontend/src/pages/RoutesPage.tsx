import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, CircleCheck, CloudOff, Layers, OctagonX } from 'lucide-react'
import type { PlanResponse } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { NoTripState } from '../components/PlanStates'
import { RouteShield } from '../components/RouteShield'
import { WarningsBanner } from '../components/WarningsBanner'
import { CheckpointLayer, EndpointMarkers, RouteLayer, TripMap } from '../features/map'
import { InlineRiskLegend, MapLegend } from '../features/map/MapLegend'
import { CRITERIA, runnerUp } from '../features/recommendation/criteria'
import { RouteCard } from '../features/routes/RouteCard'
import { boundsOf } from '../lib/bounds'
import { findRoute, routesByRank } from '../lib/routes'
import { buttonClass } from '../lib/ui'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useTrip } from '../state/TripContext'

export function RoutesPage() {
  const { result } = useTrip()
  if (!result) {
    return (
      <>
        <PageHeader title="Route comparison" kicker="Step 2" />
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
  const recommended = result.routes.find((route) => route.is_recommended)
  const lostOn = new Map(
    result.recommendation.comparisons
      .filter((c) => recommended && c.other_rank > recommended.rank)
      .map((c) => [c.other_route, c.decided_by]),
  )
  // Selected route's checkpoints are drawn last so they sit on top.
  const drawOrder = [...result.routes].sort(
    (a, b) => Number(a.id === selected?.id) - Number(b.id === selected?.id),
  )

  return (
    <div className="flex flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-none">
      <PageHeader title="Route comparison" trip compact />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="relative order-1 h-[46vh] min-h-[300px] lg:order-2 lg:h-auto">
          <TripMap
            bounds={bounds}
            paddingTopLeft={desktop ? [40, 40] : [20, 20]}
            paddingBottomRight={desktop ? [40, 72] : [20, 20]}
            weatherAttribution
            label="Route comparison map"
          >
            <RouteLayer routes={result.routes} selectedId={selected?.id} onSelect={selectRoute} />
            {drawOrder.map((route) => (
              <CheckpointLayer
                key={route.id}
                route={route}
                radius={route.id === selected?.id ? 5 : 4}
                muted={route.id !== selected?.id}
              />
            ))}
            <EndpointMarkers
              origin={result.request.origin}
              destination={result.request.destination}
            />
          </TripMap>
          <MapLegend
            routeIds={result.routes.map((route) => route.id)}
            className="absolute bottom-7 left-3 z-[500] hidden lg:flex"
          />
        </div>

        <div className="order-2 border-b border-line bg-surface px-4 py-2.5 lg:hidden">
          <InlineRiskLegend />
        </div>

        <aside
          aria-label="Routes"
          className="order-3 min-h-0 space-y-3 p-4 lg:order-1 lg:overflow-y-auto lg:border-r lg:border-line lg:bg-paper"
        >
          <div className="flex items-baseline gap-2">
            <p className="text-sm text-ink-2">
              <span className="font-bold text-ink">
                {result.routes.length} route{result.routes.length === 1 ? '' : 's'}
              </span>{' '}
              ranked by the assessment priority
            </p>
            <Link
              to="/recommendation"
              className="ml-auto text-[13px] font-semibold text-accent-ink underline underline-offset-2"
            >
              Details
            </Link>
          </div>
          <RecommendationLine result={result} />
          <WarningsBanner warnings={result.warnings} />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            {ranked.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                selected={route.id === selected?.id}
                onSelect={() => selectRoute(route.id)}
                lostOn={lostOn.get(route.id) ?? null}
              />
            ))}
          </div>
          <p className="pt-1 text-xs text-ink-3">
            Ranked by Severe miles → High miles → average risk → travel time. Select a card or a
            line on the map to focus a route.
          </p>
          <div className="grid grid-cols-2 gap-3 lg:hidden">
            <Link to={`/routes/${selected?.id ?? ''}`} className={buttonClass('secondary', 'lg')}>
              Route details
            </Link>
            <Link to="/heatmap" className={buttonClass('secondary', 'lg')}>
              <Layers className="size-5" aria-hidden="true" />
              Heatmap
            </Link>
          </div>
        </aside>
      </div>
    </div>
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
        className="group flex items-center gap-3 rounded-lg bg-gradient-to-r from-[#12452a] to-[#1d6b42] px-4 py-3 text-sm text-white hover:from-[#0f3a23] hover:to-[#185c38]"
      >
        <CircleCheck className="size-5 shrink-0 text-[#bbf7d0]" aria-hidden="true" />
        {route && <RouteShield routeId={route.id} size="sm" />}
        <span className="min-w-0 flex-1">
          <span className="font-bold">{route?.label} recommended</span>
          {criterion && runner && runner.other_rank > (route?.rank ?? 0) && (
            <>
              {' '}
              <span className="text-white/75">— {criterion.phrase}</span>
            </>
          )}
        </span>
        <ArrowRight
          className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    )
  }
  if (recommendation.status === 'NO_ELIGIBLE_ROUTE') {
    return (
      <Link
        to="/recommendation"
        className="flex items-start gap-2.5 rounded-lg bg-closed px-4 py-3 text-sm text-white"
      >
        <OctagonX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-bold">No route can be recommended.</span> Every route has No Travel
          conditions at the planned departure time.
        </span>
      </Link>
    )
  }
  return (
    <Link
      to="/recommendation"
      className="flex items-start gap-2.5 rounded-lg border border-line-strong bg-paper-2 px-4 py-3 text-sm text-ink"
    >
      <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-bold">No recommendation.</span> No checkpoint could be scored because
        no forecast data was available.
      </span>
    </Link>
  )
}
