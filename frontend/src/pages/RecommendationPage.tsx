import { Link, useNavigate } from 'react-router'
import { CircleCheck, CloudOff, OctagonX, RefreshCw } from 'lucide-react'
import type { PlanResponse, Route } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { NoTripState } from '../components/PlanStates'
import { RankingList } from '../components/RulesContent'
import { RiskDot } from '../components/RiskBadge'
import { RouteProfile } from '../components/RouteProfile'
import { RouteShield } from '../components/RouteShield'
import { WarningsBanner } from '../components/WarningsBanner'
import { ComparisonTable } from '../features/recommendation/ComparisonTable'
import { DecisionTrace } from '../features/recommendation/DecisionTrace'
import { CRITERIA, decidedIndex, runnerUp, whyNotText } from '../features/recommendation/criteria'
import { formatDayTimeZone, formatDuration, formatMiles } from '../lib/format'
import { RISK, RISK_ORDER } from '../lib/risk'
import { findRoute, routesByRank } from '../lib/routes'
import { buttonClass } from '../lib/ui'
import { useTrip } from '../state/TripContext'

export function RecommendationPage() {
  const { result } = useTrip()
  return (
    <>
      <PageHeader
        title="Recommendation"
        kicker="Step 3 · Decision"
        description={
          result
            ? 'Which route to take, the rule that decided it, and why each other route was not chosen.'
            : undefined
        }
        trip={Boolean(result)}
      />
      {result ? <Recommendation result={result} /> : <NoTripState />}
    </>
  )
}

function Recommendation({ result }: { result: PlanResponse }) {
  const { recommendation } = result
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 lg:space-y-6 lg:p-8">
      <WarningsBanner warnings={result.warnings} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {recommendation.status === 'RECOMMENDED' ? (
          <RecommendedCard result={result} />
        ) : recommendation.status === 'NO_ELIGIBLE_ROUTE' ? (
          <NoEligibleCard result={result} />
        ) : (
          <NoWeatherCard result={result} />
        )}
        <aside className="panel self-start p-5" aria-labelledby="ranked-title">
          <h2 id="ranked-title" className="text-base font-bold">
            How routes are ranked
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Assessment priority, compared in this exact order
          </p>
          <div className="mt-2">
            <RankingList />
          </div>
          <p className="mt-3 rounded-md border-l-[3px] border-l-closed bg-closed-soft px-3 py-2.5 text-[13px] text-ink">
            <strong className="font-semibold">App policy:</strong> a route with any No Travel miles
            keeps its rank but is not recommended.
          </p>
        </aside>
      </div>

      <ComparisonTable result={result} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <RiskAlongRoutes result={result} />
        {recommendation.status === 'RECOMMENDED' && (
          <div className="space-y-5 lg:space-y-6">
            <WhyNotCards result={result} />
          </div>
        )}
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
    <section className="panel overflow-hidden" aria-labelledby="recommended-title">
      <div className="on-dark bg-gradient-to-r from-[#12452a] via-[#185c38] to-[#1d6b42] px-5 py-5 text-white lg:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="min-w-0 flex-[1_1_14rem]">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-[#bbf7d0] uppercase">
              <CircleCheck className="size-4" aria-hidden="true" />
              Recommended route
            </p>
            <h2
              id="recommended-title"
              className="mt-2 flex items-center gap-3 text-3xl leading-none font-bold tracking-tight whitespace-nowrap"
            >
              <RouteShield routeId={route.id} size="lg" />
              {route.label}
            </h2>
          </div>
          <dl className="grid w-full grid-cols-3 gap-4 sm:w-auto sm:gap-8">
            <Figure label="Distance" value={formatMiles(route.distance_mi)} />
            <Figure label="Travel time" value={formatDuration(route.travel_time_s)} />
            <Figure label="Arrival" value={formatDayTimeZone(route.arrival_time)} />
          </dl>
        </div>
      </div>
      <div className="p-5 lg:p-6">
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink">
          {recommendation.explanation}
        </p>
        {runner && other && (
          <div className="mt-5 border-t border-line pt-4">
            <DecisionTrace recommended={route} other={other} comparison={runner} />
          </div>
        )}
      </div>
    </section>
  )
}

function NoEligibleCard({ result }: { result: PlanResponse }) {
  const navigate = useNavigate()
  return (
    <section className="panel overflow-hidden" aria-labelledby="blocked-title" role="alert">
      <div aria-hidden="true" className="hatch-closed h-2 bg-closed" />
      <div className="bg-closed px-5 py-5 text-white lg:px-6">
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase">
          <OctagonX className="size-4" aria-hidden="true" />
          No eligible route
        </p>
        <h2 id="blocked-title" className="mt-2 text-2xl leading-tight font-bold tracking-tight">
          No route can be recommended
        </h2>
      </div>
      <div className="p-5 lg:p-6">
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink">
          {result.recommendation.explanation}
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-3">
          {result.recommendation.ineligible.map((item) => (
            <li
              key={item.route}
              className="flex items-center gap-2 rounded-md border border-line px-3 py-2.5"
            >
              <RouteShield routeId={item.route} size="sm" />
              <span className="font-semibold text-ink">Route {item.route}</span>
              <span className="num ml-auto text-[13px] font-semibold text-closed">
                {item.no_travel_mi.toFixed(1)} mi No Travel
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/plan', { state: { focus: 'departure' } })}
            className={buttonClass('primary', 'lg')}
          >
            Try a later departure
          </button>
          <p className="text-[13px] text-ink-3">
            Conditions change by the hour — the heatmap shows when the corridor clears.
          </p>
        </div>
      </div>
    </section>
  )
}

function NoWeatherCard({ result }: { result: PlanResponse }) {
  const { retryPlan, status } = useTrip()
  return (
    <section className="panel overflow-hidden" aria-labelledby="noweather-title" role="alert">
      <div aria-hidden="true" className="hatch-unknown h-2 bg-[#8b9099]" />
      <div className="bg-[#4b4f57] px-5 py-5 text-white lg:px-6">
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase">
          <CloudOff className="size-4" aria-hidden="true" />
          Weather unavailable
        </p>
        <h2 id="noweather-title" className="mt-2 text-2xl leading-tight font-bold tracking-tight">
          No recommendation without forecasts
        </h2>
      </div>
      <div className="p-5 lg:p-6">
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink">
          {result.recommendation.explanation}
        </p>
        <button
          type="button"
          onClick={() => void retryPlan()}
          disabled={status === 'loading'}
          className={buttonClass('primary', 'lg', 'mt-5')}
        >
          <RefreshCw
            className={`size-4 ${status === 'loading' ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Retry weather
        </button>
      </div>
    </section>
  )
}

/** Every route's risk profile on one mile scale, so lengths and risk positions compare directly. */
function RiskAlongRoutes({ result }: { result: PlanResponse }) {
  const longest = Math.max(...result.routes.map((route) => route.distance_mi), 1)
  return (
    <section className="panel self-start p-5" aria-labelledby="along-title">
      <h2 id="along-title" className="text-base font-bold">
        Risk along each route, to scale
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-3">
        Origin on the left. Bar length is route length; colour is each checkpoint's level at its
        ETA.
      </p>
      <ul className="mt-4 space-y-4">
        {routesByRank(result).map((route) => (
          <li key={route.id}>
            <div className="mb-1.5 flex items-baseline gap-2 text-sm">
              <RouteShield routeId={route.id} size="sm" />
              <span className="font-semibold text-ink">{route.label}</span>
              <span className="num text-xs text-ink-3">#{route.rank}</span>
              <span className="num ml-auto text-[13px] text-ink-2">
                {formatMiles(route.distance_mi)}
              </span>
            </div>
            <RouteProfile route={route} className="h-3.5" scale={route.distance_mi / longest} />
          </li>
        ))}
      </ul>
      <ul
        className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-2"
        aria-hidden="true"
      >
        {RISK_ORDER.map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <RiskDot level={level} />
            {RISK[level].label}
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
        const blocked = above || !other.eligible
        const heading = above
          ? 'Not eligible — No Travel conditions'
          : criterion
            ? `Lost on priority ${criterion.priority} — ${criterion.label}`
            : 'Lost on provider order (full tie)'
        return (
          <section
            key={comparison.other_route}
            className="panel p-5"
            aria-labelledby={`why-${other.id}`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2
                id={`why-${other.id}`}
                className="flex items-center gap-2 text-base font-bold text-ink"
              >
                <RouteShield routeId={other.id} size="sm" />
                Why not {other.label}?
              </h2>
              <GateMarks decided={above ? -1 : index} blocked={blocked} />
            </div>
            <p className={`mt-2 text-[13px] font-semibold ${blocked ? 'text-closed' : 'text-ink'}`}>
              {heading}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              {whyNotText(recommended, other, comparison)}
            </p>
            <Link
              to={`/routes/${other.id}`}
              className="mt-3 inline-block text-[13px] font-semibold text-accent-ink underline underline-offset-2"
            >
              Inspect {other.label}
            </Link>
          </section>
        )
      })}
    </>
  )
}

/** Four small gates, the deciding one filled: where on the ladder this route was decided. */
function GateMarks({ decided, blocked }: { decided: number; blocked: boolean }) {
  return (
    <span aria-hidden="true" className="ml-auto flex items-center gap-1">
      {CRITERIA.map((criterion, index) => (
        <span
          key={criterion.key}
          className={`num flex size-5 items-center justify-center rounded-[4px] border text-[10px] font-semibold ${
            index === decided
              ? 'border-accent bg-accent text-white'
              : index < decided
                ? 'border-line-strong bg-paper text-ink-2'
                : 'border-dashed border-line-strong text-ink-3'
          }`}
        >
          {criterion.priority}
        </span>
      ))}
      {blocked && (
        <span className="ml-1 flex h-5 items-center rounded-[4px] bg-closed px-1.5 font-mono text-[10px] font-semibold text-white">
          NT
        </span>
      )}
    </span>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-[0.12em] text-white/60 uppercase">{label}</dt>
      <dd className="num mt-1 text-base font-semibold sm:text-lg sm:whitespace-nowrap">{value}</dd>
    </div>
  )
}
