import type { PlanResponse } from '../../api/types'
import { formatAverage, formatDuration, formatNumber } from '../../lib/format'
import { routesByRank } from '../../lib/routes'
import { RouteSwatch } from '../routes/RouteCard'
import { CRITERIA } from './criteria'

/** Routes in rank order with the four criteria; the cell where each route lost is highlighted. */
export function ComparisonTable({ result }: { result: PlanResponse }) {
  const { recommendation } = result
  const recommended = result.routes.find((route) => route.is_recommended)
  const comparisonFor = new Map(recommendation.comparisons.map((c) => [c.other_route, c]))

  return (
    <section className="card overflow-hidden" aria-labelledby="comparison-title">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-3 lg:px-5">
        <h2 id="comparison-title" className="text-base font-semibold text-ink">
          Route comparison
        </h2>
        <p className="text-sm text-ink-subtle">
          Columns 1–4 follow the ranking priority.
          {recommended ? ` Highlighted cell = where the route lost to ${recommended.label}.` : ''}
        </p>
      </div>
      {/* relative: keeps sr-only (absolute) labels inside the scroll area on narrow screens */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow px-4 py-2.5 text-left">
                Rank
              </th>
              <th scope="col" className="eyebrow px-3 py-2.5 text-left">
                Route
              </th>
              {CRITERIA.map((criterion) => (
                <th key={criterion.key} scope="col" className="eyebrow px-3 py-2.5 text-right">
                  <span className="sr-only">Priority {criterion.priority}: </span>
                  <span aria-hidden="true">{criterion.priority} · </span>
                  {criterion.label}
                </th>
              ))}
              <th scope="col" className="eyebrow px-3 py-2.5 text-right">
                No Travel mi
              </th>
              <th scope="col" className="eyebrow px-3 py-2.5 text-right">
                Unknown mi
              </th>
              <th scope="col" className="eyebrow px-4 py-2.5 text-left">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {routesByRank(result).map((route) => {
              const comparison = comparisonFor.get(route.id)
              const lostOn =
                comparison && recommended && comparison.other_rank > recommended.rank
                  ? comparison.decided_by
                  : null
              const highlight = (key: string) =>
                lostOn === key ? 'bg-orange-50 font-semibold ring-2 ring-orange-400 ring-inset' : ''
              const m = route.metrics
              return (
                <tr
                  key={route.id}
                  className={`border-b border-line last:border-0 ${route.is_recommended ? 'bg-green-50/60' : ''}`}
                >
                  <td className="px-4 py-3 font-semibold text-ink tabular-nums">#{route.rank}</td>
                  <th scope="row" className="px-3 py-3 text-left font-semibold text-ink">
                    <span className="inline-flex items-center gap-2">
                      <RouteSwatch routeId={route.id} className="h-1 w-5" />
                      {route.label}
                    </span>
                  </th>
                  <td className={`px-3 py-3 text-right tabular-nums ${highlight('severe_miles')}`}>
                    {formatNumber(m.severe_mi)}
                  </td>
                  <td className={`px-3 py-3 text-right tabular-nums ${highlight('high_miles')}`}>
                    {formatNumber(m.high_mi)}
                  </td>
                  <td className={`px-3 py-3 text-right tabular-nums ${highlight('average_risk')}`}>
                    {formatAverage(m.average_risk)}
                  </td>
                  <td className={`px-3 py-3 text-right tabular-nums ${highlight('travel_time')}`}>
                    {formatDuration(route.travel_time_s)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right tabular-nums ${
                      m.no_travel_mi > 0 ? 'font-semibold text-fuchsia-700' : 'text-ink-muted'
                    }`}
                  >
                    {formatNumber(m.no_travel_mi)}
                  </td>
                  <td className="px-3 py-3 text-right text-ink-muted tabular-nums">
                    {formatNumber(m.unknown_mi)}
                  </td>
                  <td className="px-4 py-3">
                    {route.is_recommended ? (
                      <span className="rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-green-800 uppercase">
                        Recommended
                      </span>
                    ) : !route.eligible ? (
                      <span className="rounded-md bg-fuchsia-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-fuchsia-700 uppercase">
                        Not eligible
                      </span>
                    ) : (
                      <span className="text-ink-muted">Eligible</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
