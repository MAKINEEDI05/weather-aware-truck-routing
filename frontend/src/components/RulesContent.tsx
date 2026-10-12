import { RISK, riskPatternClass } from '../lib/risk'
import { LOAD_RULES, RANKING_CRITERIA, RULE_LEVELS, RULE_ROWS } from '../lib/rulesCopy'

// Display only: the backend applies the rules (see src/lib/rulesCopy.ts).

/** Threshold matrix. Each level column is headed by its colour chip and name. */
export function RiskRulesTable() {
  return (
    <div>
      {/* relative: keeps sr-only (absolute) labels inside the scroll area on narrow screens */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[540px] border-collapse text-left text-sm">
          <caption className="sr-only">Risk thresholds per checkpoint</caption>
          <thead>
            <tr>
              <th scope="col" className="kicker border-b border-line px-3 pt-3 pb-2 align-bottom">
                Condition
              </th>
              {RULE_LEVELS.map((level) => (
                <th
                  key={level}
                  scope="col"
                  className="border-b border-line px-3 pt-0 pb-2 align-bottom text-[13px] font-semibold text-ink"
                >
                  <span
                    aria-hidden="true"
                    className={`mb-2 block h-1.5 rounded-b-[2px] ${riskPatternClass(level)}`}
                    style={{ backgroundColor: RISK[level].color }}
                  />
                  {RISK[level].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RULE_ROWS.map((row) => (
              <tr key={row.condition} className="border-b border-line last:border-0">
                <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                  {row.condition}
                </th>
                {row.values.map((value) => (
                  <td
                    key={value}
                    className="num px-3 py-2.5 text-[13px] whitespace-nowrap text-ink-2"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 rounded-md bg-paper px-3 py-2.5 text-sm text-ink-2">
        <p className="font-semibold text-ink">Load rules — heavier loads, lower wind limits</p>
        <ul className="mt-1 space-y-0.5">
          {LOAD_RULES.map((rule) => (
            <li key={rule.when}>
              <span className="num text-[13px]">{rule.when}</span> with {rule.load} →{' '}
              <span className="font-semibold text-ink">{rule.result}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** The four ranking criteria as a numbered ladder: compared in order, the first difference wins. */
export function RankingList({
  compact = false,
  layout = 'column',
}: {
  compact?: boolean
  layout?: 'column' | 'row'
}) {
  const list =
    layout === 'row'
      ? 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4'
      : compact
        ? 'space-y-2'
        : 'divide-y divide-line'
  return (
    <ol className={list}>
      {RANKING_CRITERIA.map((criterion, index) => (
        <li
          key={criterion}
          className={`flex items-center gap-3 ${
            layout === 'row' ? 'rounded-md border border-line px-3 py-2.5' : compact ? '' : 'py-2.5'
          }`}
        >
          <span className="num flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-accent-soft text-xs font-semibold text-accent-ink">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-ink">{criterion}</span>
        </li>
      ))}
    </ol>
  )
}
