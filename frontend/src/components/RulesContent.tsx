import type { RiskLevel } from '../api/types'
import { RiskDot } from './RiskBadge'

// Display copy of the assessment rules (docs/REQUIREMENTS.md §3). The rules are applied only by
// the backend (backend/trips/domain/risk.py); nothing here classifies anything.
const COLUMNS: { level: RiskLevel; label: string }[] = [
  { level: 'LOW', label: 'Low' },
  { level: 'MODERATE', label: 'Moderate' },
  { level: 'HIGH', label: 'High' },
  { level: 'SEVERE', label: 'Severe' },
  { level: 'NO_TRAVEL', label: 'No Travel' },
]

const ROWS: { condition: string; values: string[] }[] = [
  { condition: 'Wind', values: ['<25 mph', '25–34', '35–44', '45–54', '≥55 mph'] },
  { condition: 'Rain', values: ['<0.10 in/hr', '0.10–0.25', '0.25–0.50', '0.50–1.00', '>1.00'] },
  { condition: 'Snow', values: ['<0.5 in/hr', '0.5–1.0', '1.0–2.0', '2.0–3.0', '>3.0'] },
]

const RANKING_CRITERIA = [
  'Fewest Severe miles',
  'Fewest High miles',
  'Lowest average risk',
  'Shortest travel time',
]

export function RiskRulesTable() {
  return (
    <div>
      {/* relative: keeps sr-only (absolute) labels inside the scroll area on narrow screens */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Risk thresholds per checkpoint</caption>
          <thead>
            <tr className="border-b border-line bg-slate-50">
              <th scope="col" className="eyebrow px-3 py-2">
                Condition
              </th>
              {COLUMNS.map((column) => (
                <th key={column.level} scope="col" className="eyebrow px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <RiskDot level={column.level} />
                    {column.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.condition} className="border-b border-line last:border-0">
                <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                  {row.condition}
                </th>
                {row.values.map((value) => (
                  <td key={value} className="px-3 py-2.5 text-ink-muted tabular-nums">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 px-3 text-sm text-ink-muted">
        <strong className="font-semibold text-ink">Load rules</strong> · ≥55 mph → No Travel for any
        load · 45–54 mph with &gt;30,000 lb → No Travel · 35–44 mph with &gt;40,000 lb → Severe
      </p>
    </div>
  )
}

export function RankingList({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={compact ? 'space-y-2' : 'divide-y divide-line'}>
      {RANKING_CRITERIA.map((criterion, index) => (
        <li key={criterion} className={`flex items-center gap-3 ${compact ? '' : 'py-3'}`}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-ink">{criterion}</span>
        </li>
      ))}
    </ol>
  )
}
