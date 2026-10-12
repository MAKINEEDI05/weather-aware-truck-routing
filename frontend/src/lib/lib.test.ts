import { makePlanResponse } from '../test/fixtures'
import { CRITERIA, formatPair, runnerUp, whyNotText } from '../features/recommendation/criteria'
import { boundsOf } from './bounds'
import { cellStyle, hourTime } from './corridor'
import {
  formatAverage,
  formatDateTime,
  formatDayTimeZone,
  formatDuration,
  formatLatLonCardinal,
  formatLoad,
  formatMiles,
} from './format'
import { haversineMiles } from './geo'
import { RISK, milesAt, riskFromCode } from './risk'
import { routeColor, routesByRank } from './routes'

describe('format', () => {
  it.each([
    [59, '1 min'],
    [1980, '33 min'],
    [56_100, '15 h 35 m'],
    [3600, '1 h 00 m'],
  ])('duration %i s → %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })

  it('formats miles, loads, averages and coordinates', () => {
    expect(formatMiles(1048.24)).toBe('1,048.2 mi')
    expect(formatLoad(38_000)).toBe('38,000 lb')
    expect(formatAverage(null)).toBe('—')
    expect(formatAverage(0.1666)).toBe('0.17')
    expect(formatLatLonCardinal(40.875, -100.375)).toBe('40.88°N, 100.38°W')
  })

  it('shows times in the browser time zone with its abbreviation', () => {
    expect(formatDateTime('2026-10-14T13:00:00Z')).toBe('Wed 14 Oct, 08:00 CDT')
    expect(formatDayTimeZone('2026-12-01T15:00:00Z')).toBe('Tue 09:00 CST')
  })
})

describe('risk and routes', () => {
  it('maps corridor codes to levels, never defaulting unknown to Low', () => {
    expect([0, 1, 2, 3, 4, -1, 99].map(riskFromCode)).toEqual([
      'LOW',
      'MODERATE',
      'HIGH',
      'SEVERE',
      'NO_TRAVEL',
      'UNKNOWN',
      'UNKNOWN',
    ])
    expect(RISK.NO_TRAVEL.label).toBe('No Travel')
  })

  it('reads miles per level and orders routes by rank', () => {
    const result = makePlanResponse()
    expect(milesAt(result.routes[1]!.metrics, 'NO_TRAVEL')).toBe(25)
    expect(routesByRank(result).map((r) => r.id)).toEqual(['C', 'A', 'B'])
    expect(new Set(['A', 'B', 'C'].map(routeColor)).size).toBe(3)
  })

  it('computes bounds over geometry and places', () => {
    expect(boundsOf([], [])).toBeNull()
    expect(boundsOf(makePlanResponse().routes)).toEqual([
      [39.74, -104.99],
      [41.88, -87.63],
    ])
    expect(
      haversineMiles({ lat: 41.8842, lon: -87.6324 }, { lat: 39.7392, lon: -104.9903 }),
    ).toBeCloseTo(920, -1)
  })
})

describe('corridor', () => {
  it('draws unknown cells transparent with an outline and known cells filled', () => {
    expect(cellStyle(-1)).toMatchObject({ fillOpacity: 0, dashArray: '2 3' })
    expect(cellStyle(undefined)).toMatchObject({ fillOpacity: 0 })
    expect(cellStyle(4)).toMatchObject({ fillColor: RISK.NO_TRAVEL.color, fillOpacity: 0.45 })
  })

  it('maps slider hours to clock times after the departure hour', () => {
    const corridor = makePlanResponse().corridor
    expect(hourTime(corridor, 0)).toBe('2026-10-14T13:00:00.000Z')
    expect(hourTime(corridor, 48)).toBe('2026-10-16T13:00:00.000Z')
  })
})

describe('recommendation criteria', () => {
  it('lists the PDF criteria in priority order', () => {
    expect(CRITERIA.map((c) => c.label)).toEqual([
      'Severe miles',
      'High miles',
      'Average risk',
      'Travel time',
    ])
  })

  it('never hides a real difference by rounding', () => {
    expect(formatPair('high_miles', 25.04, 25)).toEqual(['25.04', '25.00'])
    expect(formatPair('average_risk', 0.1234, 0.1236)).toEqual(['0.123', '0.124'])
    expect(formatPair('average_risk', 0.123, 0.125)).toEqual(['0.12', '0.13'])
    expect(formatPair('travel_time', 3600, 5400)).toEqual(['1 h 00 m', '1 h 30 m'])
  })

  it('picks the best-ranked other route as runner-up', () => {
    expect(runnerUp(makePlanResponse().recommendation.comparisons)?.other_route).toBe('A')
  })

  it('explains a higher-ranked but ineligible route', () => {
    const result = makePlanResponse()
    const [a, b, c] = result.routes
    const text = whyNotText(
      { ...a!, rank: 2 },
      { ...c!, rank: 1, metrics: { ...c!.metrics, no_travel_mi: 4 } },
      {
        other_route: 'C',
        other_rank: 1,
        other_eligible: false,
        decided_by: 'high_miles',
        recommended_value: 50,
        other_value: 25,
      },
    )
    expect(text).toBe(
      'It ranks higher on high miles (25.0 vs 50.0), but 4.0 mi of No Travel conditions make it ineligible.',
    )
    expect(b).toBeDefined()
  })
})
