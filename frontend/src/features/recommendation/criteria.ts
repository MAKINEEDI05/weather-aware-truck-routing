import type { Comparison, DecidedBy, Route } from '../../api/types'
import { formatAverage, formatDuration } from '../../lib/format'

export interface Criterion {
  key: Exclude<DecidedBy, 'provider_order'>
  priority: number
  label: string
  short: string
  /** How the criterion reads as a winning reason, e.g. "fewest High miles". */
  phrase: string
}

// Assessment priority, in order (docs/REQUIREMENTS.md §3.3).
export const CRITERIA: Criterion[] = [
  {
    key: 'severe_miles',
    priority: 1,
    label: 'Severe miles',
    short: 'Severe',
    phrase: 'fewest Severe miles',
  },
  {
    key: 'high_miles',
    priority: 2,
    label: 'High miles',
    short: 'High',
    phrase: 'fewest High miles',
  },
  {
    key: 'average_risk',
    priority: 3,
    label: 'Average risk',
    short: 'Avg risk',
    phrase: 'lowest average risk',
  },
  {
    key: 'travel_time',
    priority: 4,
    label: 'Travel time',
    short: 'Time',
    phrase: 'shortest travel time',
  },
]

export function criterionValue(route: Route, key: Criterion['key']): number | null {
  switch (key) {
    case 'severe_miles':
      return route.metrics.severe_mi
    case 'high_miles':
      return route.metrics.high_mi
    case 'average_risk':
      return route.metrics.average_risk
    case 'travel_time':
      return route.travel_time_s
  }
}

/** Formats a pair of values so that a real difference is never hidden by rounding (DEC-49). */
export function formatPair(
  key: Criterion['key'],
  a: number | null,
  b: number | null,
): [string, string] {
  if (key === 'travel_time') {
    return [formatDuration(a ?? 0), formatDuration(b ?? 0)]
  }
  if (key === 'average_risk') {
    for (const digits of [2, 3, 4]) {
      const pair: [string, string] = [
        a === null ? '—' : a.toFixed(digits),
        b === null ? '—' : b.toFixed(digits),
      ]
      if (pair[0] !== pair[1] || a === b) return pair
    }
    return [formatAverage(a), formatAverage(b)]
  }
  const one: [string, string] = [(a ?? 0).toFixed(1), (b ?? 0).toFixed(1)]
  if (one[0] === one[1] && a !== b) {
    return [(a ?? 0).toFixed(2), (b ?? 0).toFixed(2)]
  }
  return one
}

/** Index in CRITERIA of the deciding criterion (4 = provider order, i.e. all four tied). */
export function decidedIndex(comparison: Comparison): number {
  const index = CRITERIA.findIndex((criterion) => criterion.key === comparison.decided_by)
  return index === -1 ? CRITERIA.length : index
}

/** The best-ranked other route — the "runner-up" of the decision trace (DEC-38). */
export function runnerUp(comparisons: Comparison[]): Comparison | undefined {
  return [...comparisons].sort((a, b) => a.other_rank - b.other_rank)[0]
}

/** Plain-language reason why `other` is not the recommended route. */
export function whyNotText(recommended: Route, other: Route, comparison: Comparison): string {
  const index = decidedIndex(comparison)
  const criterion = CRITERIA[index]
  const noTravel = `${other.metrics.no_travel_mi.toFixed(1)} mi of No Travel conditions make it ineligible.`

  if (comparison.other_rank < recommended.rank) {
    if (!criterion) {
      return `It ties ${recommended.label} on all four criteria and ranks first by provider order, but ${noTravel}`
    }
    const [o, r] = formatPair(criterion.key, comparison.other_value, comparison.recommended_value)
    return `It ranks higher on ${criterion.label.toLowerCase()} (${o} vs ${r}), but ${noTravel}`
  }

  let text: string
  if (!criterion) {
    text = `It ties ${recommended.label} on all four criteria; the routing provider's order decides.`
  } else {
    const [o, r] = formatPair(criterion.key, comparison.other_value, comparison.recommended_value)
    const ties = CRITERIA.slice(0, index).map((c) =>
      c.key === 'average_risk' ? 'average risk' : c.label,
    )
    const tieList = ties.length > 1 ? `${ties.slice(0, -1).join(', ')} and ${ties.at(-1)}` : ties[0]
    const subject = tieList ? `Same ${tieList} as ${recommended.label}, but it` : 'It'
    text =
      criterion.key === 'travel_time'
        ? `${subject} takes ${o} against ${r}.`
        : criterion.key === 'average_risk'
          ? `${subject} has a higher average risk: ${o} against ${r}.`
          : `${subject} has ${o} ${criterion.label} against ${r}.`
    const faster = recommended.travel_time_s - other.travel_time_s
    if (index < 3 && faster >= 60) {
      text += ` Its shorter travel time (−${formatDuration(faster)}) is not considered because priority ${criterion.priority} already decided.`
    }
  }
  if (!comparison.other_eligible) {
    text += ` Separately, ${noTravel}`
  }
  return text
}
