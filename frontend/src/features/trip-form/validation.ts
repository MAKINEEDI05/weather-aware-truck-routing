// Client-side mirror of docs/REQUIREMENTS.md §5 for immediate feedback.
// The backend remains authoritative; its 400 details are mapped back onto these fields.
import type { CheckpointInterval, GeocodeResult, PlanRequest, PlanResponse } from '../../api/types'
import { haversineMiles } from '../../lib/geo'

export const MAX_LOAD_LB = 100_000
export const MAX_DEPARTURE_DAYS = 7
export const DEPARTURE_GRACE_MIN = 15
export const INTERVALS: CheckpointInterval[] = [10, 25, 50]

export interface TripDraft {
  origin: GeocodeResult | null
  destination: GeocodeResult | null
  /** `datetime-local` value, browser local time: YYYY-MM-DDTHH:MM */
  departureLocal: string
  loadText: string
  interval: CheckpointInterval
}

export type FieldName = 'origin' | 'destination' | 'departure' | 'load' | 'interval'
export type FieldErrors = Partial<Record<FieldName, string>>

export const FIELD_ORDER: FieldName[] = ['origin', 'destination', 'departure', 'load', 'interval']

const pad = (value: number) => String(value).padStart(2, '0')

export function toLocalInputValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Next full hour in local time (blueprint §6.3). */
export function defaultDepartureLocal(now: Date = new Date()): string {
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return toLocalInputValue(next)
}

export function parseLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!match) {
    return null
  }
  const [, y, mo, d, h, mi, s] = match
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0))
  return Number.isNaN(date.getTime()) || date.getMonth() !== Number(mo) - 1 ? null : date
}

/** ISO 8601 with the browser's UTC offset, e.g. 2026-10-14T08:00:00-05:00. */
export function toIsoWithOffset(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

export function emptyDraft(now: Date = new Date()): TripDraft {
  return {
    origin: null,
    destination: null,
    departureLocal: defaultDepartureLocal(now),
    loadText: '',
    interval: 25,
  }
}

/** Accepts "38000", "38,000" or "38 000.5"; returns null if not a number. */
export function parseLoad(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return null
  }
  return Number(cleaned)
}

export function validateDraft(draft: TripDraft, now: Date = new Date()): FieldErrors {
  const errors: FieldErrors = {}
  if (!draft.origin) {
    errors.origin = 'Search for the origin and select a place.'
  }
  if (!draft.destination) {
    errors.destination = 'Search for the destination and select a place.'
  } else if (draft.origin && haversineMiles(draft.origin, draft.destination) < 1) {
    errors.destination = 'Origin and destination must be at least 1 mile apart.'
  }

  const departure = parseLocalDateTime(draft.departureLocal)
  if (!departure) {
    errors.departure = 'Enter a departure date and time.'
  } else {
    const earliest = now.getTime() - DEPARTURE_GRACE_MIN * 60_000
    const latest = now.getTime() + MAX_DEPARTURE_DAYS * 86_400_000
    if (departure.getTime() < earliest || departure.getTime() > latest) {
      errors.departure = `Choose a departure between now and ${MAX_DEPARTURE_DAYS} days from now.`
    }
  }

  const load = parseLoad(draft.loadText)
  if (draft.loadText.trim() === '') {
    errors.load = 'Enter the load weight in pounds.'
  } else if (load === null || load > MAX_LOAD_LB) {
    errors.load = 'Enter a load weight between 0 and 100,000 lb.'
  }

  if (!INTERVALS.includes(draft.interval)) {
    errors.interval = 'Choose 10, 25 or 50 miles.'
  }
  return errors
}

export function toPlanRequest(draft: TripDraft): PlanRequest {
  const departure = parseLocalDateTime(draft.departureLocal)
  const load = parseLoad(draft.loadText)
  if (!draft.origin || !draft.destination || !departure || load === null) {
    throw new Error('Draft is not valid; validate before building a request.')
  }
  const place = ({ label, lat, lon }: GeocodeResult) => ({ label, lat, lon })
  return {
    origin: place(draft.origin),
    destination: place(draft.destination),
    departure_time: toIsoWithOffset(departure),
    load_weight_lb: load,
    checkpoint_interval_mi: draft.interval,
  }
}

const SERVER_FIELDS: Record<string, FieldName> = {
  origin: 'origin',
  destination: 'destination',
  departure_time: 'departure',
  load_weight_lb: 'load',
  checkpoint_interval_mi: 'interval',
}

function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstMessage(item)
      if (message) return message
    }
  }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) {
      const message = firstMessage(item)
      if (message) return message
    }
  }
  return null
}

/** Maps a backend 400 `details` object onto form fields. */
export function serverErrorsToFields(details: Record<string, unknown>): FieldErrors {
  const errors: FieldErrors = {}
  for (const [key, value] of Object.entries(details)) {
    const field = SERVER_FIELDS[key]
    const message = firstMessage(value)
    if (field && message) {
      errors[field] = message
    }
  }
  return errors
}

/** True when the draft would produce the same request as the one that produced `result`. */
export function draftMatchesResult(draft: TripDraft, result: PlanResponse): boolean {
  const request = result.request
  const departure = parseLocalDateTime(draft.departureLocal)
  const samePlace = (a: GeocodeResult | null, b: { label: string; lat: number; lon: number }) =>
    a !== null && a.label === b.label && a.lat === b.lat && a.lon === b.lon
  return (
    samePlace(draft.origin, request.origin) &&
    samePlace(draft.destination, request.destination) &&
    departure !== null &&
    departure.getTime() === new Date(request.departure_time).getTime() &&
    parseLoad(draft.loadText) === request.load_weight_lb &&
    draft.interval === request.checkpoint_interval_mi
  )
}
