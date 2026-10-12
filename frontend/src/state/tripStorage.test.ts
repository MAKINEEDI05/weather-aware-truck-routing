import { makePlanResponse } from '../test/fixtures'
import {
  MAX_AGE_MS,
  RESULT_KEY,
  TRIP_STORAGE_VERSION,
  UI_KEY,
  clearSavedTrip,
  draftFromRequest,
  loadSavedTrip,
  saveTripResult,
  saveTripUi,
} from './tripStorage'
import type { SavedTripUi } from './tripStorage'

const NOW = Date.parse('2026-10-14T12:00:00Z')

function ui(changes: Partial<SavedTripUi> = {}): SavedTripUi {
  return {
    draft: draftFromRequest(makePlanResponse()),
    selectedRouteId: 'A',
    selectedCheckpoint: { routeId: 'A', index: 2 },
    hour: 7,
    ...changes,
  }
}

function stored(key: string): unknown {
  const raw = window.sessionStorage.getItem(key)
  return raw === null ? null : JSON.parse(raw)
}

describe('saved trip storage', () => {
  it('returns nothing and writes nothing when the browser has no saved trip', () => {
    expect(loadSavedTrip(NOW)).toBeNull()
    expect(window.sessionStorage.length).toBe(0)
  })

  it('round-trips a result with its inputs, selection and slider hour', () => {
    const result = makePlanResponse()
    expect(saveTripResult(result, NOW)).toBe(true)
    expect(saveTripUi(NOW, ui())).toBe(true)

    const saved = loadSavedTrip(NOW + 60_000)
    expect(saved?.result).toEqual(result)
    expect(saved?.calculatedAt).toBe(NOW)
    expect(saved).toMatchObject({
      selectedRouteId: 'A',
      selectedCheckpoint: { routeId: 'A', index: 2 },
      hour: 7,
    })
    expect(saved?.draft.origin?.label).toBe('Chicago, IL')
  })

  it('stores only the versioned records it needs — no keys or URLs', () => {
    saveTripResult(makePlanResponse(), NOW)
    saveTripUi(NOW, ui())

    expect(Object.keys(stored(RESULT_KEY) as object).sort()).toEqual([
      'calculatedAt',
      'result',
      'version',
    ])
    expect(Object.keys(stored(UI_KEY) as object).sort()).toEqual([
      'calculatedAt',
      'draft',
      'hour',
      'selectedCheckpoint',
      'selectedRouteId',
      'version',
    ])
    expect((stored(RESULT_KEY) as { version: number }).version).toBe(TRIP_STORAGE_VERSION)
    const everything = JSON.stringify([stored(RESULT_KEY), stored(UI_KEY)]).toLowerCase()
    expect(everything).not.toMatch(/api[_-]?key|token|password|secret|http:\/\/api/)
  })

  it.each([
    ['malformed JSON', () => window.sessionStorage.setItem(RESULT_KEY, '{"version":1,')],
    ['a plain string', () => window.sessionStorage.setItem(RESULT_KEY, '"hello"')],
    [
      'another schema version',
      () =>
        window.sessionStorage.setItem(
          RESULT_KEY,
          JSON.stringify({ version: 999, calculatedAt: NOW, result: makePlanResponse() }),
        ),
    ],
    ['an expired result', () => saveTripResult(makePlanResponse(), NOW - MAX_AGE_MS - 1)],
    ['a calculation time in the future', () => saveTripResult(makePlanResponse(), NOW + 3_600_000)],
    ['a result without routes', () => saveTripResult({ ...makePlanResponse(), routes: [] }, NOW)],
    [
      'a recommendation for a route that does not exist',
      () => {
        const result = makePlanResponse()
        result.recommendation.route_id = 'Z'
        saveTripResult(result, NOW)
      },
    ],
    [
      'heatmap cells with the wrong number of hours',
      () => {
        const result = makePlanResponse()
        result.corridor.cells[0]!.risk = [0, 1]
        saveTripResult(result, NOW)
      },
    ],
    [
      'an unknown risk level',
      () => {
        const result = makePlanResponse()
        ;(result.routes[0]!.checkpoints[0]!.risk as { overall: string }).overall = 'MILD'
        saveTripResult(result, NOW)
      },
    ],
  ])('discards %s and clears both records', (_, seed) => {
    seed()
    saveTripUi(NOW, ui())

    expect(loadSavedTrip(NOW)).toBeNull()
    expect(window.sessionStorage.getItem(RESULT_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(UI_KEY)).toBeNull()
  })

  it('removes a UI record that has no result', () => {
    saveTripUi(NOW, ui())
    expect(loadSavedTrip(NOW)).toBeNull()
    expect(window.sessionStorage.getItem(UI_KEY)).toBeNull()
  })

  it('falls back to the inputs of the result when the UI record is unusable', () => {
    const result = makePlanResponse()
    saveTripResult(result, NOW)
    window.sessionStorage.setItem(UI_KEY, 'not json')

    const saved = loadSavedTrip(NOW)
    expect(saved?.result).toEqual(result)
    expect(saved).toMatchObject({ selectedRouteId: 'C', selectedCheckpoint: null, hour: 0 })
    expect(saved?.draft).toEqual(draftFromRequest(result))
  })

  it('ignores a UI record that belongs to a different result', () => {
    saveTripResult(makePlanResponse(), NOW)
    saveTripUi(NOW - 1, ui())
    expect(loadSavedTrip(NOW)).toMatchObject({ selectedRouteId: 'C', hour: 0 })
  })

  it('drops selections and slider hours that do not fit the result', () => {
    saveTripResult(makePlanResponse(), NOW)
    saveTripUi(
      NOW,
      ui({ selectedRouteId: 'Q', selectedCheckpoint: { routeId: 'A', index: 99 }, hour: 99 }),
    )
    expect(loadSavedTrip(NOW)).toMatchObject({
      selectedRouteId: 'C',
      selectedCheckpoint: null,
      hour: 0,
    })
  })

  it('reports a failed save and removes the older trip so a reload cannot show it', () => {
    saveTripResult(makePlanResponse(), NOW)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    expect(saveTripResult(makePlanResponse(), NOW + 1000)).toBe(false)
    expect(window.sessionStorage.getItem(RESULT_KEY)).toBeNull()
  })

  it('clears both records', () => {
    saveTripResult(makePlanResponse(), NOW)
    saveTripUi(NOW, ui())
    clearSavedTrip()
    expect(window.sessionStorage.length).toBe(0)
  })
})
