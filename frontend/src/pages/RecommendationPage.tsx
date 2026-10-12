import { useNavigate } from 'react-router'
import { CircleCheck, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import type { PlanResponse, Route } from '../api/types'
import { NoTripState } from '../components/PlanStates'
import { RankingList } from '../components/RulesContent'
import { RiskDot } from '../components/RiskBadge'
import { RiskMilesBar } from '../components/RiskMilesBar'
import { TopBar } from '../components/TopBar'
import { WarningsBanner } from '../components/WarningsBanner'
import { ComparisonTable } from '../features/recommendation/ComparisonTable'
import { DecisionTrace } from '../features/recommendation/DecisionTrace'
import { CRITERIA, decidedIndex, runnerUp, whyNotText } from '../features/recommendation/criteria'
import { RouteSwatch } from '../features/routes/RouteCard'
import { formatDayTimeZone, formatDuration, formatMiles } from '../lib/format'
import { RISK } from '../lib/risk'
import { findRoute, routesByRank } from '../lib/routes'
import { buttonClass } from '../lib/ui'
import { useTrip } from '../state/TripContext'

export function RecommendationPage() {
  const { result } = useTrip()
  return (
    <>
      <TopBar title="Recommendation" showTrip={Boolean(result)} />
      {result ? <Recommendation result={result} /> : <NoTripState />}
    </>
  )
}

function Recommendation({ result }: { result: PlanResponse }) {
  const { recommendation } = result
  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <WarningsBanner warnings={result.warnings} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {recommendation.status === 'RECOMMENDED' ? (
          <RecommendedCard result={result} />
        ) : recommendation.status === 'NO_ELIGIBLE_ROUTE' ? (
          <NoEligibleCard result={result} />
        ) : (
          <NoWeatherCard result={result} />
        )}
        <aside className="card p-5" aria-labelledby="ranked-title">
          <h2 id="ranked-title" className="text-base font-semibold text-ink">
            How routes are ranked
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Assessment priority, compared in this exact order
          </p>
          <div className="mt-2">
            <RankingList />
          </div>
          <p className="mt-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3 text-sm text-fuchsia-900">
            <strong className="font-semibold">App policy:</strong> a route with any No Travel miles
            keeps its rank but is not recommended.
          </p>
        </aside>
      </div>

      <ComparisonTable result={result} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <MilesByRisk result={result} />
        {recommendation.status === 'RECOMMENDED' && <WhyNotCards result={result} />}
      </div>
    </div>
  )
}

function RecommendedCard({ result }: { result: PlanResponse }) {
  const { recommendation } = result
  const route = findRoute(result, recommendation.route_id) as Route
  const runner = runnerUp(recommendation.comparisons)
  const other = runner ? findRoute(result, runner.other_route) : undefined

  return (
    <section
      className="card border-2 !border-green-300 p-5 lg:p-6"
      aria-labelledby="recommended-title"
    >
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
          <CircleCheck className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-green-700">Recommended route</p>
          <h2
            id="recommended-title"
            className="mt-0.5 flex items-center gap-3 text-2xl font-bold tracking-tight text-ink"
          >
            <RouteSwatch routeId={route.id} className="h-1.5 w-8" />
            {route.label}
          </h2>
        </div>
        <dl className="grid w-full grid-cols-3 gap-4 sm:w-auto sm:gap-6 sm:text-right">
          <Figure label="Distance" value={formatMiles(route.distance_mi)} />
          <Figure label="Travel time" value={formatDuration(route.travel_time_s)} />
          <Figure label="Arrival" value={formatDayTimeZone(route.arrival_time)} />
        </dl>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-ink">{recommendation.explanation}</p>
      {runner && other && (
        <div className="mt-5">
          <DecisionTrace recommended={route} other={other} comparison={runner} />
        </div>
      )}
    </section>
  )
}

function NoEligibleCard({ result }: { result: PlanResponse }) {
  const navigate = useNavigate()
  return (
    <section
      className="card border-2 !border-fuchsia-300 p-5 lg:p-6"
      aria-labelledby="blocked-title"
      role="alert"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-700">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow !text-fuchsia-700">No eligible route</p>
          <h2 id="blocked-title" className="mt-0.5 text-xl font-bold text-ink">
            No route can be recommended
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">
            {result.recommendation.explanation}
          </p>
        </div>
      </div>
      <ul className="mt-5 grid gap-2 sm:grid-cols-3">
        {result.recommendation.ineligible.map((item) => (
          <li
            key={item.route}
            className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5"
          >
            <RouteSwatch routeId={item.route} className="h-1 w-5" />
            <span className="font-semibold text-ink">Route {item.route}</span>
            <span className="ml-auto text-sm font-semibold text-fuchsia-700 tabular-nums">
              {item.no_travel_mi.toFixed(1)} mi No Travel
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => navigate('/plan', { state: { focus: 'departure' } })}
        className={buttonClass('primary', 'lg', 'mt-5 w-full sm:w-auto')}
      >
        Try a later departure
      </button>
    </section>
  )
}

function NoWeatherCard({ result }: { result: PlanResponse }) {
  const { retryPlan, status } = useTrip()
  return (
    <section
      className="card border-2 !border-amber-300 p-5 lg:p-6"
      aria-labelledby="noweather-title"
      role="alert"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <CloudOff className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow !text-amber-700">Weather unavailable</p>
          <h2 id="noweather-title" className="mt-0.5 text-xl font-bold text-ink">
            No recommendation without forecasts
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">
            {result.recommendation.explanation}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void retryPlan()}
        disabled={status === 'loading'}
        className={buttonClass('secondary', 'lg', 'mt-5')}
      >
        <RefreshCw
          className={`size-4 ${status === 'loading' ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        Retry weather
      </button>
    </section>
  )
}

function MilesByRisk({ result }: { result: PlanResponse }) {
  return (
    <section className="card p-5" aria-labelledby="miles-title">
      <h2 id="miles-title" className="text-base font-semibold text-ink">
        Miles by risk level
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted" aria-hidden="true">
        {(['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL', 'UNKNOWN'] as const).map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <RiskDot level={level} className="size-2.5 rounded-sm" />
            {RISK[level].label}
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-3">
        {routesByRank(result).map((route) => (
          <li
            key={route.id}
            className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 text-sm"
          >
            <span className="flex items-center gap-2 font-semibold text-ink">
              <RouteSwatch routeId={route.id} className="h-1 w-4" />
              {route.label}
            </span>
            <RiskMilesBar metrics={route.metrics} distance={route.distance_mi} className="h-3" />
            <span className="text-ink-muted tabular-nums">{formatMiles(route.distance_mi)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function WhyNotCards({ result }: { result: PlanResponse }) {
  const recommended = findRoute(result, result.recommendation.route_id) as Route
  return (
    <>
      {result.recommendation.comparisons.map((comparison) => {
        const other = findRoute(result, comparison.other_route)
        if (!other) return null
        const index = decidedIndex(comparison)
        const above = comparison.other_rank < recommended.rank
        const criterion = CRITERIA[index]
        const heading = above
          ? 'Not eligible — No Travel conditions'
          : criterion
            ? `Lost on priority ${criterion.priority} — ${criterion.label}`
            : 'Lost on provider order (full tie)'
        return (
          <section
            key={comparison.other_route}
            className="card p-5"
            aria-labelledby={`why-${other.id}`}
          >
            <h2
              id={`why-${other.id}`}
              className="flex items-center gap-2 text-base font-semibold text-ink"
            >
              <RouteSwatch routeId={other.id} className="h-1 w-5" />
              Why not {other.label}?
            </h2>
            <p
              className={`mt-1 text-sm font-semibold ${above || !other.eligible ? 'text-fuchsia-700' : 'text-orange-700'}`}
            >
              {heading}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {whyNotText(recommended, other, comparison)}
            </p>
          </section>
        )
      })}
    </>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold text-ink tabular-nums sm:text-lg sm:whitespace-nowrap">
        {value}
      </dd>
    </div>
  )
}
