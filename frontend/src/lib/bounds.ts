import type { Place, Route } from '../api/types'

export type Bounds = [[number, number], [number, number]]

/** Bounding box of route geometries and/or places, or null if there is nothing to show. */
export function boundsOf(
  routes: Route[],
  places: (Place | null | undefined)[] = [],
): Bounds | null {
  let minLat = Infinity
  let minLon = Infinity
  let maxLat = -Infinity
  let maxLon = -Infinity
  const add = (lat: number, lon: number) => {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
  }
  for (const route of routes) {
    for (const [lat, lon] of route.geometry) add(lat, lon)
  }
  for (const place of places) {
    if (place) add(place.lat, place.lon)
  }
  return Number.isFinite(minLat)
    ? [
        [minLat, minLon],
        [maxLat, maxLon],
      ]
    : null
}
