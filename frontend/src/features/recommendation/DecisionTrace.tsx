import { Check, ChevronRight, Equal, Minus, OctagonX } from 'lucide-react'
import type { Comparison, Route } from '../../api/types'
import { CRITERIA, criterionValue, decidedIndex, formatPair } from './criteria'

interface DecisionTraceProps {
  recommended: Route
  other: Route
  comparison: Comparison
}

/**
 * The four PDF criteria for the recommended route vs the runner-up, as a tie-break ladder: ties pass
 * to the next gate, the first difference decides, later gates are not needed.
 */
export function DecisionTrace({ recommended, other, comparison }: DecisionTraceProps) {
  const decided = decidedIndex(comparison)
  const otherAbove = comparison.other_rank < recommended.rank

  return (
    <section aria-labelledby="trace-title">
      <h3 id="trace-title" className="kicker">
        Decision trace · {recommended.label} vs {otherAbove ? 'higher-ranked' : 'runner-up'}{' '}
        {other.label}
      </h3>
      <p className="mt-1 text-xs text-ink-3">
        Values read {recommended.label} first, then {other.label}.
      </p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        {CRITERIA.map((criterion, index) => {
          const [r, o] = formatPair(
            criterion.key,
            criterionValue(recommended, criterion.key),
            criterionValue(other, criterion.key),
          )
          const state = index < decided ? 'tie' : index === decided ? 'decided' : 'skipped'
          const tone =
            state === 'decided'
              ? otherAbove
                ? 'border-closed bg-closed text-white'
                : 'border-ink bg-ink text-white'
              : state === 'tie'
                ? 'border-line-strong bg-paper text-ink'
                : 'border-dashed border-line-strong bg-surface text-ink-3'
          const Icon =
            state === 'tie' ? Equal : state === 'skipped' ? Minus : otherAbove ? OctagonX : Check
          return (
            <li key={criterion.key} className={`relative rounded-md border p-3 ${tone}`}>
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <span
                  className={`num flex size-5 items-center justify-center rounded-[4px] border text-[11px] ${
                    state === 'decided' ? 'border-white/60' : 'border-current'
                  }`}
                >
                  {criterion.priority}
                </span>
                {criterion.label}
              </p>
              <p className="num mt-2 text-base font-semibold">
                <span className="whitespace-nowrap">{r}</span> vs{' '}
                <span className="whitespace-nowrap">{o}</span>
              </p>
              <p
                className={`mt-1 flex items-center gap-1.5 text-[13px] ${
                  state === 'decided' ? 'font-semibold' : ''
                }`}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {state === 'tie'
                  ? 'Tie — compare next'
                  : state === 'decided'
                    ? otherAbove
                      ? `Better: ${other.label} (not eligible)`
                      : `Decides: ${recommended.label}`
                    : 'Not needed'}
              </p>
              {index < CRITERIA.length - 1 && (
                <ChevronRight
                  className="absolute top-1/2 -right-[19px] hidden size-4 -translate-y-1/2 text-ink-3 xl:block"
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
      {decided === CRITERIA.length && (
        <p className="mt-3 text-sm text-ink-2">
          All four criteria tie; the routing provider's order decides.
        </p>
      )}
    </section>
  )
}
