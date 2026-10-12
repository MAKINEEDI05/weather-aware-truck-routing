import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { PlanResponse } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { NoTripState } from '../components/PlanStates'
import { RiskBadge } from '../components/RiskBadge'
import { RouteShield } from '../components/RouteShield'
import { ForecastSlider } from '../features/forecast/ForecastSlider'
import type { DriveWindow } from '../features/forecast/ForecastSlider'
import {
  CheckpointLayer,
  CorridorLayer,
  EndpointMarkers,
  RouteLayer,
  TripMap,
} from '../features/map'
import { boundsOf } from '../lib/bounds'
import { HOUR_MS, hourTime } from '../lib/corridor'
import { formatDateTime, formatLatLonCardinal, formatLoad, formatValue } from '../lib/format'
import { RISK, RISK_ORDER, riskFromCode, riskPatternClass } from '../lib/risk'
import { findRoute, routesByRank } from '../lib/routes'
import { useTrip } from '../state/TripContext'

export function HeatmapPage() {
  const { result } = useTrip()
  return result ? (
    <Heatmap result={result} />
  ) : (
    <>
      <PageHeader title="Weather heatmap" kicker="Step 4" />
      <NoTripState />
    </>
  )
}

function Heatmap({ result }: { result: PlanResponse }) {
  const { hour, setHour, selectedRouteId, selectRoute } = useTrip()
  const [showCells, setShowCells] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)
  const [showCheckpoints, setShowCheckpoints] = useState(false)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const bounds = useMemo(() => boundsOf(result.routes), [result])
  const { corridor, request } = result

  const route = findRoute(result, selectedRouteId)
  const drive = useMemo<DriveWindow | null>(() => {
    if (!route) return null
    const start = new Date(corridor.start_time).getTime()
    return {
      label: route.label,
      start: (new Date(route.departure_time).getTime() - start) / HOUR_MS,
      end: (new Date(route.arrival_time).getTime() - start) / HOUR_MS,
      arrival: route.arrival_time,
    }
  }, [route, corridor.start_time])

  return (
    <div className="flex flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-none">
      <PageHeader title="Weather heatmap" trip compact />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="order-1 flex min-h-0 flex-col lg:order-2">
          <div className="relative h-[50vh] min-h-[300px] lg:h-auto lg:min-h-0 lg:flex-1">
            <TripMap bounds={bounds} weatherAttribution label="Corridor weather heatmap">
              <CorridorLayer
                corridor={corridor}
                hour={hour}
                visible={showCells}
                selectedCell={selectedCell}
                onSelectCell={setSelectedCell}
              />
              {showRoutes && (
                <RouteLayer
                  routes={result.routes}
                  selectedId={selectedRouteId}
                  onSelect={selectRoute}
                />
              )}
              {showCheckpoints &&
                result.routes.map((r) => <CheckpointLayer key={r.id} route={r} radius={4} />)}
              <EndpointMarkers origin={request.origin} destination={request.destination} />
            </TripMap>
            {selectedCell !== null && corridor.cells[selectedCell] && (
              <CellInfo
                result={result}
                index={selectedCell}
                hour={hour}
                onClose={() => setSelectedCell(null)}
              />
            )}
          </div>
          <div className="shrink-0 border-t border-line bg-surface">
            <ForecastSlider corridor={corridor} hour={hour} onChange={setHour} drive={drive} />
          </div>
        </div>

        <aside
          aria-label="Heatmap layers"
          className="order-2 min-h-0 border-t border-line bg-surface lg:order-1 lg:overflow-y-auto lg:border-t-0 lg:border-r"
        >
          <div className="border-b border-line p-5">
            <h2 className="text-base font-bold">Layers &amp; key</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              Each cell shows the risk level for a {formatLoad(request.load_weight_lb)} load at the{' '}
              <strong className="font-semibold text-ink">selected hour</strong>, using the same
              wind, rain and snow thresholds as the checkpoints.
            </p>
          </div>
          <div className="space-y-3 border-b border-line p-5">
            <Toggle label="Heatmap cells" checked={showCells} onChange={setShowCells} />
            <Toggle label="Routes" checked={showRoutes} onChange={setShowRoutes} />
            <Toggle
              label="Checkpoints (at ETA)"
              checked={showCheckpoints}
              onChange={setShowCheckpoints}
            />
          </div>
          <div className="border-b border-line p-5">
            <p className="kicker">Cell risk</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink">
              {RISK_ORDER.map((level) => (
                <li key={level} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-3.5 rounded-[3px] ${level === 'NO_TRAVEL' ? '' : riskPatternClass(level)}`}
                    style={
                      level === 'UNKNOWN'
                        ? { border: `1.5px dashed ${RISK.UNKNOWN.color}` }
                        : { backgroundColor: RISK[level].color, opacity: 0.6 }
                    }
                  />
                  {RISK[level].label}
                </li>
              ))}
            </ul>
            <p className="kicker mt-4">Route for the timeline</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {routesByRank(result).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={r.id === selectedRouteId}
                  onClick={() => selectRoute(r.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[13px] font-semibold ${
                    r.id === selectedRouteId
                      ? 'border-accent bg-accent text-white'
                      : 'border-line-strong text-ink hover:bg-paper'
                  }`}
                >
                  <RouteShield routeId={r.id} size="sm" />
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 p-5 text-[13px] leading-relaxed text-ink-2">
            <p>
              Heatmap = whole corridor at one clock hour. Checkpoint dots = each point at the
              truck's ETA.
            </p>
            <p>
              Cells are {corridor.cell_size_deg}° × {corridor.cell_size_deg}° (
              {corridor.cells.length} cells).
              {corridor.cell_size_deg > 0.25 &&
                ' A coarser grid is used because this corridor is large.'}
            </p>
            <p>Select a cell on the map to see its forecast values.</p>
            {result.warnings
              .filter((warning) => warning.code === 'CORRIDOR_WEATHER_PARTIAL')
              .map((warning) => (
                <p
                  key={warning.code}
                  className="rounded-r-md border-l-[3px] border-l-[#e2b024] bg-caution-soft px-3 py-2 text-ink"
                >
                  {warning.message}
                </p>
              ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

function CellInfo({
  result,
  index,
  hour,
  onClose,
}: {
  result: PlanResponse
  index: number
  hour: number
  onClose: () => void
}) {
  const cell = result.corridor.cells[index]
  if (!cell) return null
  const level = riskFromCode(cell.risk[hour] ?? -1)
  return (
    <section
      aria-label="Selected corridor cell"
      className="float absolute top-3 right-14 left-3 z-[500] text-sm sm:left-auto sm:w-72"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="kicker">Corridor cell</p>
          <p className="num mt-0.5 text-[13px] font-semibold text-ink">
            {formatLatLonCardinal(cell.lat, cell.lon)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cell details"
          className="rounded-md p-1 text-ink-3 hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <dl className="divide-y divide-line px-4">
        <Row label="Forecast time" value={formatDateTime(hourTime(result.corridor, hour))} />
        <Row label="Wind" value={`${formatValue(cell.wind_mph[hour] ?? null, 1)} mph`} />
        <Row
          label="Rain · Snow"
          value={`${formatValue(cell.rain_in_hr[hour] ?? null, 2)} · ${formatValue(cell.snow_in_hr[hour] ?? null, 2)} in/hr`}
        />
      </dl>
      <div className="flex items-center gap-2 border-t border-line bg-paper px-4 py-2.5">
        <RiskBadge level={level} size="md" />
        <span className="text-xs text-ink-2">for {formatLoad(result.request.load_weight_lb)}</span>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-ink-2">{label}</dt>
      <dd className="num text-[13px] font-medium text-ink">{value}</dd>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between text-sm font-medium text-ink"
    >
      {label}
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 rounded-[5px] border transition-colors ${
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-paper-2'
        }`}
      >
        <span
          className={`absolute top-[1px] left-0 size-4 rounded-[3px] bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-[17px]' : 'translate-x-[1px]'
          }`}
        />
      </span>
    </button>
  )
}
