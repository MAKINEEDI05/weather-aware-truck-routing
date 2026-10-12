import type { Comparison, Route } from '../../api/types'
import { CRITERIA, criterionValue, decidedIndex, formatPair } from './criteria'

interface DecisionTraceProps {
  recommended: Route
  other: Route
  comparison: Comparison
}

/** The four PDF criteria for the recommended route vs the runner-up, in priority order. */
export function DecisionTrace({ recommended, other, comparison }: DecisionTraceProps) {
  const decided = decidedIndex(comparison)
  const otherAbove = comparison.other_rank < recommended.rank

  return (
    <section aria-labelledby="trace-title">
      <h3 id="trace-title" className="eyebrow">
        Decision trace · {recommended.label} vs {otherAbove ? 'higher-ranked' : 'runner-up'}{' '}
        {other.label}
      </h3>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CRITERIA.map((criterion, index) => {
          const [r, o] = formatPair(
            criterion.key,
            criterionValue(recommended, criterion.key),
            criterionValue(other, criterion.key),
          )
          const state = index < decided ? 'tie' : index === decided ? 'decided' : 'skipped'
          return (
            <li
              key={criterion.key}
              className={`rounded-xl border p-3 ${
                state === 'decided'
                  ? otherAbove
                    ? 'border-fuchsia-300 bg-fuchsia-50'
                    : 'border-green-300 bg-green-50'
                  : 'border-line bg-white'
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-white">
                  {criterion.priority}
                </span>
                {criterion.label}
              </p>
              <p
                className={`mt-1.5 font-semibold tabular-nums ${state === 'skipped' ? 'text-ink-subtle' : 'text-ink'}`}
              >
                {r} vs {o}
              </p>
              <p
                className={`mt-0.5 text-sm ${
                  state === 'decided'
                    ? otherAbove
                      ? 'font-medium text-fuchsia-700'
                      : 'font-medium text-green-700'
                    : state === 'tie'
                      ? 'text-ink-muted'
                      : 'text-ink-subtle'
                }`}
              >
                {state === 'tie'
                  ? 'Tie — compare next'
                  : state === 'decided'
                    ? otherAbove
                      ? `Better: ${other.label} (not eligible)`
                      : `Decides: ${recommended.label}`
                    : 'Not needed'}
              </p>
            </li>
          )
        })}
      </ol>
      {decided === CRITERIA.length && (
        <p className="mt-3 text-sm text-ink-muted">
          All four criteria tie; the routing provider's order decides.
        </p>
      )}
    </section>
  )
}
