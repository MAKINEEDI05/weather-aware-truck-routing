import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import type { CircleMarker as LeafletCircleMarker, Polyline as LeafletPolyline } from 'leaflet'
import { CircleMarker, Marker, Polyline, Popup, Rectangle, useMap } from 'react-leaflet'
import type { Checkpoint, Corridor, Place, Route } from '../../api/types'
import { cellBounds, cellStyle } from '../../lib/corridor'
import { NO_TRAVEL_OUTLINE, RISK } from '../../lib/risk'
import { routeColor } from '../../lib/routes'
import { CheckpointPopup, RouteSummaryPopup } from './popups'

const INK = '#15171b'

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

/** Route lines plus a lettered shield on each line, so routes are named on the map itself. */
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
      {routes.map((route) => (
        <RouteShieldMarker
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
  const weight = selected ? 6 : route.is_recommended ? 4.5 : 4
  const opacity = faded ? 0.3 : selected ? 1 : 0.72

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
        pathOptions={{ color: '#ffffff', weight: weight + 4, opacity: faded ? 0.35 : 0.95 }}
      />
      <Polyline
        ref={lineRef}
        positions={route.geometry}
        pathOptions={{
          color: routeColor(route.id),
          weight,
          opacity,
          lineCap: 'round',
          lineJoin: 'round',
          bubblingMouseEvents: false,
        }}
        eventHandlers={{ click: () => onSelect?.(route.id) }}
      >
        <Popup>
          <RouteSummaryPopup route={route} />
        </Popup>
      </Polyline>
    </>
  )
}

// Shields sit at different fractions of each line so overlapping routes do not stack them.
const SHIELD_POSITION = [0.5, 0.32, 0.68, 0.2, 0.8]

function shieldPosition(route: Route): [number, number] | null {
  const { geometry } = route
  if (!geometry.length) return null
  const fraction = SHIELD_POSITION[route.rank - 1] ?? 0.4
  return geometry[Math.round(fraction * (geometry.length - 1))] ?? null
}

function RouteShieldMarker({ route, selected, faded, onSelect }: RoutePolylineProps) {
  const position = shieldPosition(route)
  const icon = useMemo(() => {
    const size = selected ? 28 : 24
    const letter = route.id.replace(/[^A-Za-z0-9]/g, '')
    return L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html:
        `<div class="map-shield${selected ? ' map-shield--selected' : ''}" ` +
        `style="width:${size}px;height:${size}px;font-size:${selected ? 14 : 12}px;` +
        `background:${routeColor(route.id)};opacity:${faded ? 0.55 : 1}">${letter}</div>`,
    })
  }, [route.id, selected, faded])

  if (!position) return null
  return (
    <Marker
      position={position}
      icon={icon}
      title={`${route.label}, rank ${route.rank}`}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{
        click: () => onSelect?.(route.id),
        // Leaflet makes the shield a focusable role=button but only maps Enter to popups.
        keydown: (event) => {
          const key = (event.originalEvent as KeyboardEvent).key
          if (key === 'Enter' || key === ' ') {
            event.originalEvent.preventDefault()
            onSelect?.(route.id)
          }
        },
      }}
    />
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
  /** Attach popups to markers. Off where an in-page inspector shows the details instead. */
  popups?: boolean
  /** Keep the selected marker in view when it is selected from outside the map. */
  panToSelected?: boolean
  /** Draw lighter (checkpoints of a route that is not selected). */
  muted?: boolean
}

export function CheckpointLayer({
  route,
  selectedIndex = null,
  onSelect,
  radius = 5,
  openSelected = false,
  popups = true,
  panToSelected = false,
  muted = false,
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
          popups={popups}
          panToSelected={panToSelected}
          muted={muted}
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
  popups: boolean
  panToSelected: boolean
  muted: boolean
  onSelect?: (index: number) => void
}

function markerStyle(checkpoint: Checkpoint, selected: boolean, muted: boolean) {
  const level = checkpoint.risk.overall
  const base =
    level === 'UNKNOWN'
      ? { color: RISK.UNKNOWN.color, weight: 2, fillColor: '#ffffff', fillOpacity: 1 }
      : level === 'NO_TRAVEL'
        ? { color: NO_TRAVEL_OUTLINE, weight: 2.5, fillColor: RISK.NO_TRAVEL.color, fillOpacity: 1 }
        : { color: '#ffffff', weight: 1.5, fillColor: RISK[level].color, fillOpacity: 1 }
  if (selected) return { ...base, color: INK, weight: 3, opacity: 1 }
  return muted ? { ...base, opacity: 0.7, fillOpacity: base.fillOpacity * 0.7 } : base
}

function CheckpointMarker({
  route,
  checkpoint,
  radius,
  selected,
  openSelected,
  popups,
  panToSelected,
  muted,
  onSelect,
}: CheckpointMarkerProps) {
  const ref = useRef<LeafletCircleMarker>(null)
  const map = useMap()

  useEffect(() => {
    if (!selected) return
    ref.current?.bringToFront()
    if (openSelected) {
      ref.current?.openPopup()
    }
    if (panToSelected) {
      map.panInside([checkpoint.lat, checkpoint.lon], { padding: [48, 48] })
    }
  }, [selected, openSelected, panToSelected, map, checkpoint.lat, checkpoint.lon])

  return (
    <CircleMarker
      ref={ref}
      center={[checkpoint.lat, checkpoint.lon]}
      radius={selected ? radius + 3 : checkpoint.risk.overall === 'NO_TRAVEL' ? radius + 1 : radius}
      pathOptions={markerStyle(checkpoint, selected, muted)}
      bubblingMouseEvents={false}
      eventHandlers={{ click: () => onSelect?.(checkpoint.index) }}
    >
      {popups && (
        <Popup>
          <CheckpointPopup route={route} checkpoint={checkpoint} />
        </Popup>
      )}
    </CircleMarker>
  )
}

// ---------------------------------------------------------------------------------------------
// Origin and destination: a ring for the start, a square terminal for the end
// ---------------------------------------------------------------------------------------------

const ORIGIN_ICON = L.divIcon({
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: '<div class="map-endpoint map-endpoint--origin"></div>',
})

const DESTINATION_ICON = L.divIcon({
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: '<div class="map-endpoint map-endpoint--destination"></div>',
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
        <Marker
          position={[origin.lat, origin.lon]}
          icon={ORIGIN_ICON}
          title={`Origin: ${origin.label}`}
          zIndexOffset={2000}
        >
          <Popup>
            <EndpointPopup kind="Origin" place={origin} />
          </Popup>
        </Marker>
      )}
      {destination && (
        <Marker
          position={[destination.lat, destination.lon]}
          icon={DESTINATION_ICON}
          title={`Destination: ${destination.label}`}
          zIndexOffset={2000}
        >
          <Popup>
            <EndpointPopup kind="Destination" place={destination} />
          </Popup>
        </Marker>
      )}
    </>
  )
}

function EndpointPopup({ kind, place }: { kind: string; place: Place }) {
  return (
    <div className="py-3 pr-9 pl-4 text-sm">
      <p className="kicker">{kind}</p>
      <p className="font-semibold text-ink">{place.label}</p>
    </div>
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
    rectangles.current = corridor.cells.map((cell) => {
      const rectangle = L.rectangle(cellBounds(cell.lat, cell.lon, corridor.cell_size_deg), {
        ...cellStyle(cell.risk[hourRef.current]),
        renderer,
        pane: CORRIDOR_PANE,
        interactive: false,
      })
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

  // Cell picking. The overlay pane's canvas (routes, checkpoints) sits above this pane and takes
  // every pointer event, so cells are found from the clicked position on the grid instead.
  useEffect(() => {
    const half = corridor.cell_size_deg / 2
    const onClick = (event: L.LeafletMouseEvent) => {
      if (!visibleRef.current) return
      const { lat, lng } = event.latlng
      const index = corridor.cells.findIndex(
        (cell) => Math.abs(cell.lat - lat) <= half && Math.abs(cell.lon - lng) <= half,
      )
      if (index !== -1) onSelectRef.current?.(index)
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
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
      pathOptions={{ color: INK, weight: 2.5, fillOpacity: 0, dashArray: undefined }}
    />
  ) : null
}
