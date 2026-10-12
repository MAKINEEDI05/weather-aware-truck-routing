// Saved trip: the last successful plan and the UI state around it, kept in sessionStorage so a
// reload restores the results without new routing or weather requests (supersedes DEC-42).
//
// sessionStorage, not localStorage: it survives reloads but belongs to one tab and is cleared when
// the tab closes, so two tabs cannot overwrite each other's trip and provider results are not kept
// long-term (OPEN-10). Only data the API returned plus the form inputs are stored — no keys, no
// tokens, no API URL.
//
// Two records: the large result is written once per successful plan; the small UI record is
// written as the user works (rewriting ~1 MB of geometry on every slider step would stutter).
import type {
  Checkpoint,
  CheckpointInterval,
  GeocodeResult,
  PlanResponse,
  RiskLevel,
  Route,
} from '../api/types'
import { INTERVALS, toLocalInputValue } from '../features/trip-form/validation'
import type { TripDraft } from '../features/trip-form/validation'
import { defaultRouteId } from '../lib/routes'

/** Bump when the stored shape or the API contract changes; older records are then discarded. */
export const TRIP_STORAGE_VERSION = 1
export const RESULT_KEY = 'weather-aware-truck-routing:trip-result'
export const UI_KEY = 'weather-aware-truck-routing:trip-ui'
/** Results older than this are not restored: forecasts will have moved on. */
export const MAX_AGE_MS = 12 * 3_600_000
/** Tolerated clock drift for a calculation time in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60_000
const MAX_HOUR = 48

export interface SavedSelection {
  routeId: string
  index: number
}

export interface SavedTripUi {
  draft: TripDraft
  selectedRouteId: string | null
  selectedCheckpoint: SavedSelection | null
  hour: number
}

export interface SavedTrip extends SavedTripUi {
  result: PlanResponse
  /** Browser time (ms) when the plan succeeded. Expiry is measured from it. */
  calculatedAt: number
}

function store(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null // storage disabled by the browser
  }
}

function write(key: string, value: unknown): boolean {
  try {
    store()?.setItem(key, JSON.stringify(value))
    return store() !== null
  } catch {
    return false // quota exceeded or storage blocked
  }
}

function read(key: string): unknown {
  try {
    const raw = store()?.getItem(key)
    return raw == null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return undefined // unreadable or malformed JSON
  }
}

export function clearSavedTrip(): void {
  try {
    store()?.removeItem(RESULT_KEY)
    store()?.removeItem(UI_KEY)
  } catch {
    // nothing to clear
  }
}

/** Saves a new result. On failure any older saved trip is removed, so a reload never shows it. */
export function saveTripResult(result: PlanResponse, calculatedAt: number): boolean {
  const ok = write(RESULT_KEY, { version: TRIP_STORAGE_VERSION, calculatedAt, result })
  if (!ok) clearSavedTrip()
  return ok
}

export function saveTripUi(calculatedAt: number, ui: SavedTripUi): boolean {
  return write(UI_KEY, { version: TRIP_STORAGE_VERSION, calculatedAt, ...ui })
}

/**
 * Reads, validates and returns the saved trip, or null. Missing, malformed, expired, versioned-out
 * or structurally invalid records are removed. A bad UI record alone falls back to defaults derived
 * from the result.
 */
export function loadSavedTrip(now: number = Date.now()): SavedTrip | null {
  const stored = read(RESULT_KEY)
  if (stored === null) {
    clearSavedTrip() // an orphaned UI record is useless on its own
    return null
  }
  if (
    !isRecord(stored) ||
    stored.version !== TRIP_STORAGE_VERSION ||
    !isFiniteNumber(stored.calculatedAt) ||
    stored.calculatedAt > now + FUTURE_TOLERANCE_MS ||
    now - stored.calculatedAt > MAX_AGE_MS ||
    !isPlanResponse(stored.result)
  ) {
    clearSavedTrip()
    return null
  }
  const result = stored.result
  const calculatedAt = stored.calculatedAt
  return { result, calculatedAt, ...restoreUi(read(UI_KEY), result, calculatedAt) }
}

function restoreUi(stored: unknown, result: PlanResponse, calculatedAt: number): SavedTripUi {
  const fallback: SavedTripUi = {
    draft: draftFromRequest(result),
    selectedRouteId: defaultRouteId(result) ?? null,
    selectedCheckpoint: null,
    hour: 0,
  }
  if (
    !isRecord(stored) ||
    stored.version !== TRIP_STORAGE_VERSION ||
    stored.calculatedAt !== calculatedAt || // belongs to a different result
    !isDraft(stored.draft)
  ) {
    return fallback
  }
  const routeId =
    typeof stored.selectedRouteId === 'string' &&
    result.routes.some((route) => route.id === stored.selectedRouteId)
      ? stored.selectedRouteId
      : fallback.selectedRouteId
  const checkpoint = stored.selectedCheckpoint
  const selectedCheckpoint =
    isRecord(checkpoint) &&
    typeof checkpoint.routeId === 'string' &&
    Number.isInteger(checkpoint.index) &&
    result.routes
      .find((route) => route.id === checkpoint.routeId)
      ?.checkpoints.some((c) => c.index === checkpoint.index)
      ? { routeId: checkpoint.routeId, index: checkpoint.index as number }
      : null
  const hour =
    Number.isInteger(stored.hour) &&
    (stored.hour as number) >= 0 &&
    (stored.hour as number) <= MAX_HOUR
      ? (stored.hour as number)
      : 0
  const { origin, destination, departureLocal, loadText, interval } = stored.draft
  return {
    draft: {
      origin: place(origin),
      destination: place(destination),
      departureLocal,
      loadText,
      interval,
    },
    selectedRouteId: routeId,
    selectedCheckpoint,
    hour,
  }
}

/** Copies only the known fields of a stored place. */
function place(value: GeocodeResult | null): GeocodeResult | null {
  return value && { label: value.label, detail: value.detail, lat: value.lat, lon: value.lon }
}

/** The form inputs that produced a result, for when no UI record survives. */
export function draftFromRequest(result: PlanResponse): TripDraft {
  const { origin, destination, departure_time, load_weight_lb, checkpoint_interval_mi } =
    result.request
  return {
    origin: { ...origin, detail: '' },
    destination: { ...destination, detail: '' },
    departureLocal: toLocalInputValue(new Date(departure_time)),
    loadText: String(load_weight_lb),
    interval: checkpoint_interval_mi,
  }
}

// ---------------------------------------------------------------------------------------------
// Structural validation (docs/API_CONTRACT.md). Anything unexpected means "do not restore".
// ---------------------------------------------------------------------------------------------

const RISK_LEVELS = new Set<RiskLevel>([
  'LOW',
  'MODERATE',
  'HIGH',
  'SEVERE',
  'NO_TRAVEL',
  'UNKNOWN',
])
const STATUSES = new Set(['RECOMMENDED', 'NO_ELIGIBLE_ROUTE', 'NO_WEATHER_DATA'])
const DECIDED_BY = new Set([
  'severe_miles',
  'high_miles',
  'average_risk',
  'travel_time',
  'provider_order',
])

type Rec = Record<string, unknown>

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
function isNumberOrNull(value: unknown): boolean {
  return value === null || isFiniteNumber(value)
}
function isTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
function isInterval(value: unknown): value is CheckpointInterval {
  return INTERVALS.includes(value as CheckpointInterval)
}
function isPlace(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    isFiniteNumber(value.lat) &&
    isFiniteNumber(value.lon)
  )
}
function isLevel(value: unknown): boolean {
  return RISK_LEVELS.has(value as RiskLevel)
}

function isCheckpoint(value: unknown): value is Checkpoint {
  if (!isRecord(value) || !isRecord(value.risk)) return false
  const { risk, weather } = value
  return (
    Number.isInteger(value.index) &&
    ['mile', 'lat', 'lon', 'covered_mi'].every((key) => isFiniteNumber(value[key])) &&
    isTime(value.eta) &&
    (weather === null ||
      (isRecord(weather) &&
        ['wind_mph', 'rain_in_hr', 'snow_in_hr'].every((key) => isNumberOrNull(weather[key])) &&
        isTime(weather.wind_hour) &&
        isTime(weather.precip_hour))) &&
    ['overall', 'wind', 'rain', 'snow'].every((key) => isLevel(risk[key])) &&
    typeof risk.load_adjusted === 'boolean' &&
    isStringArray(risk.reasons)
  )
}

function isRoute(value: unknown): value is Route {
  if (!isRecord(value) || !isRecord(value.metrics)) return false
  const { metrics } = value
  return (
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    ['provider_index', 'distance_mi', 'travel_time_s', 'traffic_delay_s', 'rank'].every((key) =>
      isFiniteNumber(value[key]),
    ) &&
    isTime(value.departure_time) &&
    isTime(value.arrival_time) &&
    Array.isArray(value.geometry) &&
    value.geometry.every(
      (point) => Array.isArray(point) && point.length === 2 && point.every(isFiniteNumber),
    ) &&
    Array.isArray(value.checkpoints) &&
    value.checkpoints.every(isCheckpoint) &&
    [
      'low_mi',
      'moderate_mi',
      'high_mi',
      'severe_mi',
      'no_travel_mi',
      'unknown_mi',
      'known_mi',
    ].every((key) => isFiniteNumber(metrics[key])) &&
    isNumberOrNull(metrics.average_risk) &&
    typeof value.eligible === 'boolean' &&
    typeof value.is_recommended === 'boolean'
  )
}

export function isPlanResponse(value: unknown): value is PlanResponse {
  if (!isRecord(value)) return false
  const { request, routes, recommendation, corridor, warnings, meta } = value
  if (
    !isRecord(request) ||
    !isPlace(request.origin) ||
    !isPlace(request.destination) ||
    !isTime(request.departure_time) ||
    !isFiniteNumber(request.load_weight_lb) ||
    !isInterval(request.checkpoint_interval_mi)
  ) {
    return false
  }
  if (!Array.isArray(routes) || routes.length === 0 || !routes.every(isRoute)) return false
  const ids = new Set(routes.map((route) => route.id))
  if (ids.size !== routes.length) return false

  if (
    !isRecord(recommendation) ||
    !STATUSES.has(recommendation.status as string) ||
    !(recommendation.route_id === null || ids.has(recommendation.route_id as string)) ||
    !isStringArray(recommendation.ranking) ||
    typeof recommendation.explanation !== 'string' ||
    !Array.isArray(recommendation.ineligible) ||
    !recommendation.ineligible.every(
      (item) =>
        isRecord(item) && typeof item.route === 'string' && isFiniteNumber(item.no_travel_mi),
    ) ||
    !Array.isArray(recommendation.comparisons) ||
    !recommendation.comparisons.every(
      (c) =>
        isRecord(c) &&
        ids.has(c.other_route as string) &&
        isFiniteNumber(c.other_rank) &&
        typeof c.other_eligible === 'boolean' &&
        DECIDED_BY.has(c.decided_by as string) &&
        isNumberOrNull(c.recommended_value) &&
        isNumberOrNull(c.other_value),
    )
  ) {
    return false
  }

  if (
    !isRecord(corridor) ||
    !isTime(corridor.start_time) ||
    !Number.isInteger(corridor.hours) ||
    !isFiniteNumber(corridor.cell_size_deg) ||
    !Array.isArray(corridor.cells)
  ) {
    return false
  }
  const hours = corridor.hours as number
  const cellsOk = corridor.cells.every(
    (cell) =>
      isRecord(cell) &&
      isFiniteNumber(cell.lat) &&
      isFiniteNumber(cell.lon) &&
      ['risk', 'wind_mph', 'rain_in_hr', 'snow_in_hr'].every(
        (key) => Array.isArray(cell[key]) && (cell[key] as unknown[]).length === hours,
      ) &&
      (cell.risk as unknown[]).every(isFiniteNumber) &&
      ['wind_mph', 'rain_in_hr', 'snow_in_hr'].every((key) =>
        (cell[key] as unknown[]).every(isNumberOrNull),
      ),
  )
  if (!cellsOk) return false

  return (
    Array.isArray(warnings) &&
    warnings.every(
      (w) => isRecord(w) && typeof w.code === 'string' && typeof w.message === 'string',
    ) &&
    isRecord(meta) &&
    isTime(meta.generated_at)
  )
}

function isGeocodeResult(value: unknown): value is GeocodeResult {
  return isPlace(value) && typeof (value as Rec).detail === 'string'
}

function isDraft(value: unknown): value is TripDraft {
  return (
    isRecord(value) &&
    (value.origin === null || isGeocodeResult(value.origin)) &&
    (value.destination === null || isGeocodeResult(value.destination)) &&
    typeof value.departureLocal === 'string' &&
    value.departureLocal.length <= 40 &&
    typeof value.loadText === 'string' &&
    value.loadText.length <= 40 &&
    isInterval(value.interval)
  )
}
