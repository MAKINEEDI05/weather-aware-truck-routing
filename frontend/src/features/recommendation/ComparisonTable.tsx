import type { PlanResponse } from '../../api/types'
import { RouteSwatch } from '../../components/RouteShield'
import { formatAverage, formatDuration, formatNumber } from '../../lib/format'
import { routesByRank } from '../../lib/routes'
import { CRITERIA } from './criteria'

/** Routes in rank order with the four criteria; the cell where each route lost is inverted. */
export function ComparisonTable({ result }: { result: PlanResponse }) {
  const { recommendation } = result
  const recommended = result.routes.find((route) => route.is_recommended)
  const comparisonFor = new Map(recommendation.comparisons.map((c) => [c.other_route, c]))

  return (
    <section className="panel overflow-hidden" aria-labelledby="comparison-title">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-3 lg:px-5">
        <h2 id="comparison-title" className="text-base font-bold text-ink">
          Route comparison
        </h2>
        <p className="text-[13px] text-ink-3">
          Columns 1–4 follow the ranking priority.
          {recommended ? ` A filled cell marks where a route lost to ${recommended.label}.` : ''}
        </p>
      </div>
      {/* relative: keeps sr-only (absolute) labels inside the scroll area on narrow screens */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-paper">
            <tr className="border-b border-line">
              <th scope="col" className="kicker sticky left-0 z-10 bg-paper px-4 py-2.5 text-left">
                Route
              </th>
              <th scope="col" className="kicker px-3 py-2.5 text-left">
                Rank
              </th>
              {CRITERIA.map((criterion) => (
                <th key={criterion.key} scope="col" className="kicker px-3 py-2.5 text-right">
                  <span className="sr-only">Priority {criterion.priority}: </span>
                  <span aria-hidden="true" className="text-ink">
                    {criterion.priority} ·{' '}
                  </span>
                  {criterion.label}
                </th>
              ))}
              <th scope="col" className="kicker px-3 py-2.5 text-right">
                No Travel mi
              </th>
              <th scope="col" className="kicker px-3 py-2.5 text-right">
                Unknown mi
              </th>
              <th scope="col" className="kicker px-4 py-2.5 text-left">
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
              const cell = (key: string) =>
                `num px-3 py-3 text-right text-[13px] ${
                  lostOn === key ? 'bg-accent font-semibold text-white' : 'text-ink'
                }`
              const marker = (key: string) =>
                lostOn === key ? <span className="sr-only"> (deciding difference)</span> : null
              const m = route.metrics
              const rowTone = route.is_recommended ? 'bg-go-soft' : 'bg-surface'
              return (
                <tr key={route.id} className={`border-b border-line last:border-0 ${rowTone}`}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 px-4 py-3 text-left font-semibold text-ink ${rowTone}`}
                  >
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <RouteSwatch routeId={route.id} className="h-3 w-1 rounded-[1px]" />
                      {route.label}
                    </span>
                  </th>
                  <td className="num px-3 py-3 text-[13px] font-semibold text-ink">
                    #{route.rank}
                  </td>
                  <td className={cell('severe_miles')}>
                    {formatNumber(m.severe_mi)}
                    {marker('severe_miles')}
                  </td>
                  <td className={cell('high_miles')}>
                    {formatNumber(m.high_mi)}
                    {marker('high_miles')}
                  </td>
                  <td className={cell('average_risk')}>
                    {formatAverage(m.average_risk)}
                    {marker('average_risk')}
                  </td>
                  <td className={cell('travel_time')}>
                    {formatDuration(route.travel_time_s)}
                    {marker('travel_time')}
                  </td>
                  <td
                    className={`num px-3 py-3 text-right text-[13px] ${
                      m.no_travel_mi > 0 ? 'font-semibold text-closed' : 'text-ink-3'
                    }`}
                  >
                    {formatNumber(m.no_travel_mi)}
                  </td>
                  <td className="num px-3 py-3 text-right text-[13px] text-ink-3">
                    {formatNumber(m.unknown_mi)}
                  </td>
                  <td className="px-4 py-3">
                    {route.is_recommended ? (
                      <span className="rounded-[4px] bg-go px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-white uppercase">
                        Recommended
                      </span>
                    ) : !route.eligible ? (
                      <span className="rounded-[4px] bg-closed-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-closed uppercase">
                        Not eligible
                      </span>
                    ) : (
                      <span className="text-[13px] text-ink-3">Eligible</span>
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
