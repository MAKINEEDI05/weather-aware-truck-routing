import type { RiskLevel } from '../api/types'

// Display copy of the assessment rules (docs/REQUIREMENTS.md §3). The rules are applied only by
// the backend (backend/trips/domain/risk.py); nothing here classifies anything.
export const RULE_LEVELS: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL']

export const RULE_ROWS: { condition: string; values: string[] }[] = [
  { condition: 'Wind', values: ['<25 mph', '25–34', '35–44', '45–54', '≥55 mph'] },
  { condition: 'Rain', values: ['<0.10 in/hr', '0.10–0.25', '0.25–0.50', '0.50–1.00', '>1.00'] },
  { condition: 'Snow', values: ['<0.5 in/hr', '0.5–1.0', '1.0–2.0', '2.0–3.0', '>3.0'] },
]

export const LOAD_RULES = [
  { when: 'Wind ≥55 mph', load: 'any load', result: 'No Travel' },
  { when: 'Wind 45–54 mph', load: 'over 30,000 lb', result: 'No Travel' },
  { when: 'Wind 35–44 mph', load: 'over 40,000 lb', result: 'Severe' },
]

export const RANKING_CRITERIA = [
  'Fewest Severe miles',
  'Fewest High miles',
  'Lowest average risk',
  'Shortest travel time',
]
