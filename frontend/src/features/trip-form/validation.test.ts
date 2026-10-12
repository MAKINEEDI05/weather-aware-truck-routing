import type { GeocodeResult } from '../../api/types'
import { makePlanResponse } from '../../test/fixtures'
import {
  defaultDepartureLocal,
  draftMatchesResult,
  parseLoad,
  serverErrorsToFields,
  toIsoWithOffset,
  toPlanRequest,
  validateDraft,
} from './validation'
import type { TripDraft } from './validation'

const NOW = new Date('2026-10-12T15:20:00Z') // 10:20 CDT
const CHICAGO: GeocodeResult = { label: 'Chicago, IL', detail: '', lat: 41.8842, lon: -87.6324 }
const DENVER: GeocodeResult = { label: 'Denver, CO', detail: '', lat: 39.7392, lon: -104.9903 }

function draft(overrides: Partial<TripDraft> = {}): TripDraft {
  return {
    origin: CHICAGO,
    destination: DENVER,
    departureLocal: '2026-10-14T08:00',
    loadText: '38,000',
    interval: 25,
    ...overrides,
  }
}

describe('validateDraft', () => {
  it('accepts a complete trip', () => {
    expect(validateDraft(draft(), NOW)).toEqual({})
  })

  it('requires both places', () => {
    const errors = validateDraft(draft({ origin: null, destination: null }), NOW)
    expect(Object.keys(errors).sort()).toEqual(['destination', 'origin'])
  })

  it('rejects places less than a mile apart', () => {
    const errors = validateDraft(
      draft({ destination: { ...CHICAGO, label: 'Loop', lat: 41.885 } }),
      NOW,
    )
    expect(errors.destination).toMatch(/at least 1 mile/)
  })

  it.each([
    ['2026-10-12T10:00', true], // 20 min ago → outside the 15-min grace
    ['2026-10-12T10:10', false], // 10 min ago → allowed
    ['2026-10-19T10:00', false], // just under 7 days
    ['2026-10-19T11:00', true], // over 7 days
    ['', true],
    ['not a date', true],
  ])('departure %s → error %s', (value, hasError) => {
    expect(Boolean(validateDraft(draft({ departureLocal: value }), NOW).departure)).toBe(hasError)
  })

  it.each([
    ['0', false],
    ['100000', false],
    ['100,000', false],
    ['100001', true],
    ['-1', true],
    ['abc', true],
    ['', true],
  ])('load %s → error %s', (value, hasError) => {
    expect(Boolean(validateDraft(draft({ loadText: value }), NOW).load)).toBe(hasError)
  })
})

describe('request building', () => {
  it('sends local departure time with the browser offset', () => {
    const request = toPlanRequest(draft())

    expect(request.departure_time).toBe('2026-10-14T08:00:00-05:00')
    expect(request.load_weight_lb).toBe(38_000)
    expect(request.origin).toEqual({ label: 'Chicago, IL', lat: 41.8842, lon: -87.6324 })
    expect(request.checkpoint_interval_mi).toBe(25)
  })

  it('formats winter offsets too', () => {
    expect(toIsoWithOffset(new Date(2026, 11, 1, 9, 30))).toBe('2026-12-01T09:30:00-06:00')
  })

  it('defaults the departure to the next full hour', () => {
    expect(defaultDepartureLocal(NOW)).toBe('2026-10-12T11:00')
  })

  it('parses loads with separators', () => {
    expect(parseLoad('38 000.5')).toBe(38000.5)
    expect(parseLoad('1e5')).toBeNull()
  })
})

describe('server errors and result matching', () => {
  it('maps backend 400 details onto form fields', () => {
    expect(
      serverErrorsToFields({
        origin: { lat: ['Ensure this value is less than or equal to 90.'] },
        departure_time: ['Choose a departure between now and 7 days from now.'],
        unknown_field: ['ignored'],
      }),
    ).toEqual({
      origin: 'Ensure this value is less than or equal to 90.',
      departure: 'Choose a departure between now and 7 days from now.',
    })
  })

  it('detects whether the draft still matches the planned result', () => {
    const result = makePlanResponse()
    const same = draft({ loadText: '38000' })

    expect(draftMatchesResult(same, result)).toBe(true)
    expect(draftMatchesResult({ ...same, interval: 10 }, result)).toBe(false)
    expect(draftMatchesResult({ ...same, loadText: '39000' }, result)).toBe(false)
  })
})
