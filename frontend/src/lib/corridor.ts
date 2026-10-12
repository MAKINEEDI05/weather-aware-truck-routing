import type { Corridor } from '../api/types'
import { RISK, riskFromCode } from './risk'

export const HOUR_MS = 3_600_000

/** ISO time of slider hour k (k = 0…48 after the departure hour, DEC-15). */
export function hourTime(corridor: Corridor, hour: number): string {
  return new Date(new Date(corridor.start_time).getTime() + hour * HOUR_MS).toISOString()
}

export interface CellStyle {
  color: string
  fillColor: string
  fillOpacity: number
  weight: number
  opacity: number
  dashArray?: string
}

/** Leaflet path style for a corridor cell risk code. Unknown cells are transparent with an outline. */
export function cellStyle(code: number | undefined): CellStyle {
  const level = riskFromCode(code ?? -1)
  if (level === 'UNKNOWN') {
    return {
      color: RISK.UNKNOWN.color,
      fillColor: RISK.UNKNOWN.color,
      fillOpacity: 0,
      weight: 0.6,
      opacity: 0.6,
      dashArray: '2 3',
    }
  }
  const color = RISK[level].color
  return { color, fillColor: color, fillOpacity: 0.45, weight: 0, opacity: 0 }
}

export function cellBounds(
  lat: number,
  lon: number,
  size: number,
): [[number, number], [number, number]] {
  const half = size / 2
  return [
    [lat - half, lon - half],
    [lat + half, lon + half],
  ]
}
