import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer } from 'react-leaflet'

const CONTINENTAL_US_CENTER: [number, number] = [39.5, -98.35]
const CONTINENTAL_US_ZOOM = 4

/** Base map of the continental US (DEC-1). Route, checkpoint and corridor layers come later. */
export function TripMap() {
  return (
    <MapContainer
      center={CONTINENTAL_US_CENTER}
      zoom={CONTINENTAL_US_ZOOM}
      preferCanvas
      className="size-full"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
    </MapContainer>
  )
}
