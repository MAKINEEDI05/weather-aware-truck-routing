import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import type { CircleMarker as LeafletCircleMarker, Polyline as LeafletPolyline } from 'leaflet'
import { CircleMarker, Marker, Polyline, Popup, Rectangle, useMap } from 'react-leaflet'
import type { Checkpoint, Corridor, Place, Route } from '../../api/types'
import { cellBounds, cellStyle } from '../../lib/corridor'
import { NO_TRAVEL_OUTLINE, RISK } from '../../lib/risk'
import { routeColor } from '../../lib/routes'
import { CheckpointPopup, RouteSummaryPopup } from './popups'

// ---------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------

interface RouteLayerProps {
  routes: Route[]
  selectedId?: string | null
  onSelect?: (routeId: string) => void
  /** Draw unselected routes faded (route details page). */
  emphasizeSelected?: boolean
}

export function RouteLayer({
  routes,
  selectedId,
  onSelect,
  emphasizeSelected = false,
}: RouteLayerProps) {
  return (
    <>
      {routes.map((route) => (
        <RoutePolyline
          key={route.id}
          route={route}
          selected={route.id === selectedId}
          faded={emphasizeSelected && route.id !== selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

interface RoutePolylineProps {
  route: Route
  selected: boolean
  faded: boolean
  onSelect?: (routeId: string) => void
}

function RoutePolyline({ route, selected, faded, onSelect }: RoutePolylineProps) {
  const lineRef = useRef<LeafletPolyline>(null)
  const casingRef = useRef<LeafletPolyline>(null)
  const weight = selected ? 6 : route.is_recommended ? 5 : 4
  const opacity = faded ? 0.35 : selected || route.is_recommended ? 1 : 0.75

  useEffect(() => {
    if (selected) {
      casingRef.current?.bringToFront()
      lineRef.current?.bringToFront()
    }
  }, [selected])

  return (
    <>
      <Polyline
        ref={casingRef}
        positions={route.geometry}
        interactive={false}
        pathOptions={{ color: '#ffffff', weight: weight + 4, opacity: faded ? 0.4 : 0.9 }}
      />
      <Polyline
        ref={lineRef}
        positions={route.geometry}
        pathOptions={{ color: routeColor(route.id), weight, opacity, lineCap: 'round' }}
        eventHandlers={{ click: () => onSelect?.(route.id) }}
      >
        <Popup>
          <RouteSummaryPopup route={route} />
        </Popup>
      </Polyline>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------------------------

interface CheckpointLayerProps {
  route: Route
  selectedIndex?: number | null
  onSelect?: (index: number) => void
  radius?: number
  /** Open the popup when a checkpoint is selected from outside the map (e.g. the table). */
  openSelected?: boolean
}

export function CheckpointLayer({
  route,
  selectedIndex = null,
  onSelect,
  radius = 5,
  openSelected = false,
}: CheckpointLayerProps) {
  return (
    <>
      {route.checkpoints.map((checkpoint) => (
        <CheckpointMarker
          key={checkpoint.index}
          route={route}
          checkpoint={checkpoint}
          radius={radius}
          selected={checkpoint.index === selectedIndex}
          openSelected={openSelected}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

interface CheckpointMarkerProps {
  route: Route
  checkpoint: Checkpoint
  radius: number
  selected: boolean
  openSelected: boolean
  onSelect?: (index: number) => void
}

function markerStyle(checkpoint: Checkpoint, selected: boolean) {
  const level = checkpoint.risk.overall
  const base =
    level === 'UNKNOWN'
      ? { color: RISK.UNKNOWN.color, weight: 2, fillColor: '#ffffff', fillOpacity: 1 }
      : level === 'NO_TRAVEL'
        ? { color: NO_TRAVEL_OUTLINE, weight: 2.5, fillColor: RISK.NO_TRAVEL.color, fillOpacity: 1 }
        : { color: '#ffffff', weight: 1.5, fillColor: RISK[level].color, fillOpacity: 1 }
  return selected ? { ...base, color: '#0f172a', weight: 3 } : base
}

function CheckpointMarker({
  route,
  checkpoint,
  radius,
  selected,
  openSelected,
  onSelect,
}: CheckpointMarkerProps) {
  const ref = useRef<LeafletCircleMarker>(null)

  useEffect(() => {
    if (selected) {
      ref.current?.bringToFront()
      if (openSelected) {
        ref.current?.openPopup()
      }
    }
  }, [selected, openSelected])

  return (
    <CircleMarker
      ref={ref}
      center={[checkpoint.lat, checkpoint.lon]}
      radius={selected ? radius + 3 : radius}
      pathOptions={markerStyle(checkpoint, selected)}
      eventHandlers={{ click: () => onSelect?.(checkpoint.index) }}
    >
      <Popup>
        <CheckpointPopup route={route} checkpoint={checkpoint} />
      </Popup>
    </CircleMarker>
  )
}

// ---------------------------------------------------------------------------------------------
// Origin and destination
// ---------------------------------------------------------------------------------------------

const DESTINATION_ICON = L.divIcon({
  className: '',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
  html:
    '<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">' +
    '<path d="M14 1C7 1 1.5 6.4 1.5 13.3 1.5 22.5 14 35 14 35s12.5-12.5 12.5-21.7C26.5 6.4 21 1 14 1z" ' +
    'fill="#2563eb" stroke="#ffffff" stroke-width="2"/><circle cx="14" cy="13" r="4.5" fill="#ffffff"/></svg>',
})

export function EndpointMarkers({
  origin,
  destination,
}: {
  origin?: Place | null
  destination?: Place | null
}) {
  return (
    <>
      {origin && (
        <CircleMarker
          center={[origin.lat, origin.lon]}
          radius={8}
          pathOptions={{ color: '#0f172a', weight: 4, fillColor: '#ffffff', fillOpacity: 1 }}
        >
          <Popup>
            <div className="px-4 py-3 text-sm">
              <p className="eyebrow">Origin</p>
              <p className="font-semibold text-ink">{origin.label}</p>
            </div>
          </Popup>
        </CircleMarker>
      )}
      {destination && (
        <Marker
          position={[destination.lat, destination.lon]}
          icon={DESTINATION_ICON}
          title="Destination"
        >
          <Popup>
            <div className="px-4 py-3 text-sm">
              <p className="eyebrow">Destination</p>
              <p className="font-semibold text-ink">{destination.label}</p>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Corridor heatmap (imperative canvas rectangles; the slider only restyles them — NFR-2)
// ---------------------------------------------------------------------------------------------

const CORRIDOR_PANE = 'corridor'

interface CorridorLayerProps {
  corridor: Corridor
  hour: number
  visible: boolean
  selectedCell?: number | null
  onSelectCell?: (index: number) => void
}

export function CorridorLayer({
  corridor,
  hour,
  visible,
  selectedCell = null,
  onSelectCell,
}: CorridorLayerProps) {
  const map = useMap()
  const rectangles = useRef<L.Rectangle[]>([])
  const group = useRef<L.LayerGroup | null>(null)
  const hourRef = useRef(hour)
  const visibleRef = useRef(visible)
  const onSelectRef = useRef(onSelectCell)

  useEffect(() => {
    hourRef.current = hour
    visibleRef.current = visible
    onSelectRef.current = onSelectCell
  })

  // Build the cells once per corridor, in their own canvas pane below routes and markers.
  useEffect(() => {
    if (!map.getPane(CORRIDOR_PANE)) {
      const pane = map.createPane(CORRIDOR_PANE)
      pane.style.zIndex = '350'
    }
    const renderer = L.canvas({ pane: CORRIDOR_PANE, padding: 0.3 })
    const layerGroup = L.layerGroup()
    rectangles.current = corridor.cells.map((cell, index) => {
      const rectangle = L.rectangle(cellBounds(cell.lat, cell.lon, corridor.cell_size_deg), {
        ...cellStyle(cell.risk[hourRef.current]),
        renderer,
        pane: CORRIDOR_PANE,
      })
      rectangle.on('click', () => onSelectRef.current?.(index))
      layerGroup.addLayer(rectangle)
      return rectangle
    })
    group.current = layerGroup
    if (visibleRef.current) {
      layerGroup.addTo(map)
    }
    return () => {
      layerGroup.remove()
      rectangles.current = []
      group.current = null
    }
  }, [corridor, map])

  useEffect(() => {
    const layerGroup = group.current
    if (!layerGroup) return
    if (visible && !map.hasLayer(layerGroup)) layerGroup.addTo(map)
    if (!visible && map.hasLayer(layerGroup)) layerGroup.remove()
  }, [visible, map])

  // Slider: restyle existing cells in one animation frame. No layers created, no requests.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      rectangles.current.forEach((rectangle, index) => {
        rectangle.setStyle(cellStyle(corridor.cells[index]?.risk[hour]))
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hour, corridor])

  const selected = selectedCell === null ? undefined : corridor.cells[selectedCell]
  const bounds = useMemo(
    () => (selected ? cellBounds(selected.lat, selected.lon, corridor.cell_size_deg) : null),
    [selected, corridor.cell_size_deg],
  )
  return bounds && visible ? (
    <Rectangle
      bounds={bounds}
      interactive={false}
      pathOptions={{ color: '#0f172a', weight: 2.5, fillOpacity: 0 }}
    />
  ) : null
}
