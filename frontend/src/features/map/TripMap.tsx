import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { LatLngBoundsExpression, PointExpression } from 'leaflet'
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet'

const CONTINENTAL_US_CENTER: [number, number] = [39.5, -98.35]
const CONTINENTAL_US_ZOOM = 4
const WEATHER_ATTRIBUTION =
  'Weather: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0)'

interface TripMapProps {
  children?: ReactNode
  /** Fit the view to these bounds whenever they change. */
  bounds?: LatLngBoundsExpression | null
  /** Extra space for overlay panels, in pixels: [left, top]. */
  paddingTopLeft?: PointExpression
  paddingBottomRight?: PointExpression
  weatherAttribution?: boolean
  className?: string
  label?: string
}

/**
 * Base map of the continental US (DEC-1) with OSM tiles and attribution. The tiles are greyed out in
 * CSS (.trip-map) so that only risk and routes carry colour.
 */
export function TripMap({
  children,
  bounds = null,
  paddingTopLeft = [32, 32],
  paddingBottomRight = [32, 32],
  weatherAttribution = false,
  className = 'size-full',
  label = 'Map',
}: TripMapProps) {
  return (
    <MapContainer
      center={CONTINENTAL_US_CENTER}
      zoom={CONTINENTAL_US_ZOOM}
      preferCanvas
      zoomSnap={0.5}
      zoomControl={false}
      className={`trip-map ${className}`}
      aria-label={label}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <ZoomControl position="topright" />
      {weatherAttribution && <WeatherAttribution />}
      {bounds && (
        <FitBounds
          bounds={bounds}
          paddingTopLeft={paddingTopLeft}
          paddingBottomRight={paddingBottomRight}
        />
      )}
      {children}
    </MapContainer>
  )
}

function WeatherAttribution() {
  const map = useMap()
  useEffect(() => {
    const control = map.attributionControl
    control?.addAttribution(WEATHER_ATTRIBUTION)
    return () => {
      control?.removeAttribution(WEATHER_ATTRIBUTION)
    }
  }, [map])
  return null
}

interface FitBoundsProps {
  bounds: LatLngBoundsExpression
  paddingTopLeft: PointExpression
  paddingBottomRight: PointExpression
}

function FitBounds({ bounds, paddingTopLeft, paddingBottomRight }: FitBoundsProps) {
  const map = useMap()
  const key = useMemo(() => JSON.stringify(bounds), [bounds])
  const padding = useRef({ paddingTopLeft, paddingBottomRight })
  useEffect(() => {
    padding.current = { paddingTopLeft, paddingBottomRight }
  })
  useEffect(() => {
    // Refit only when the trip geometry changes, not on every render. Not animated: a zoom
    // animation still running when the page unmounts makes Leaflet read a removed pane
    // ("_leaflet_pos" TypeError) — easy to hit with quick navigation or a reload.
    map.fitBounds(JSON.parse(key) as LatLngBoundsExpression, {
      ...padding.current,
      maxZoom: 9,
      animate: false,
    })
  }, [map, key])
  return null
}
