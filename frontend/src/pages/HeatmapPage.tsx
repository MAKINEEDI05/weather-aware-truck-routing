import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { PlanResponse } from '../api/types'
import { NoTripState } from '../components/PlanStates'
import { RiskBadge } from '../components/RiskBadge'
import { TopBar } from '../components/TopBar'
import { ForecastSlider } from '../features/forecast/ForecastSlider'
import {
  CheckpointLayer,
  CorridorLayer,
  EndpointMarkers,
  RouteLayer,
  TripMap,
} from '../features/map'
import { RouteSwatch } from '../features/routes/RouteCard'
import { boundsOf } from '../lib/bounds'
import { hourTime } from '../lib/corridor'
import { formatDateTime, formatLatLonCardinal, formatLoad, formatValue } from '../lib/format'
import { RISK, RISK_ORDER, riskFromCode } from '../lib/risk'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useTrip } from '../state/TripContext'

export function HeatmapPage() {
  const { result } = useTrip()
  return result ? (
    <Heatmap result={result} />
  ) : (
    <>
      <TopBar title="Weather heatmap" />
      <NoTripState />
    </>
  )
}

function Heatmap({ result }: { result: PlanResponse }) {
  const { hour, setHour, selectedRouteId, selectRoute } = useTrip()
  const desktop = useIsDesktop()
  const [showCells, setShowCells] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)
  const [showCheckpoints, setShowCheckpoints] = useState(false)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const bounds = useMemo(() => boundsOf(result.routes), [result])
  const { corridor, request } = result

  return (
    <>
      <TopBar title="Weather heatmap" showTrip />
      <div className="relative flex-1 lg:h-[calc(100dvh-4rem)] lg:flex-none">
        <div className="relative h-[50vh] lg:absolute lg:inset-0 lg:h-auto">
          <TripMap
            bounds={bounds}
            paddingTopLeft={desktop ? [400, 40] : [16, 16]}
            paddingBottomRight={desktop ? [40, 220] : [16, 16]}
            weatherAttribution
            label="Corridor weather heatmap"
          >
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
              result.routes.map((route) => (
                <CheckpointLayer key={route.id} route={route} radius={4} />
              ))}
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

        <div className="p-4 lg:absolute lg:right-4 lg:bottom-4 lg:left-4 lg:z-[500] lg:p-0">
          <ForecastSlider corridor={corridor} hour={hour} onChange={setHour} />
        </div>

        <aside
          aria-label="Heatmap layers"
          className="overlay mx-4 mb-4 lg:absolute lg:top-4 lg:left-4 lg:z-[500] lg:m-0 lg:max-h-[calc(100%-230px)] lg:w-[360px] lg:overflow-y-auto"
        >
          <div className="border-b border-line p-5">
            <h2 className="text-base font-semibold text-ink">Weather heatmap</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
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
            <p className="eyebrow">Cell risk</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink">
              {RISK_ORDER.map((level) => (
                <li key={level} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-3.5 rounded-[3px]"
                    style={
                      level === 'UNKNOWN'
                        ? { border: `1.5px dashed ${RISK.UNKNOWN.color}` }
                        : { backgroundColor: RISK[level].color, opacity: 0.75 }
                    }
                  />
                  {RISK[level].label}
                </li>
              ))}
            </ul>
            <ul className="mt-3 flex gap-4 text-sm text-ink">
              {result.routes.map((route) => (
                <li key={route.id} className="flex items-center gap-1.5">
                  <RouteSwatch routeId={route.id} className="h-1 w-4" />
                  {route.id}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5 p-5 text-sm text-ink-muted">
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
            <p>Select a cell to see its forecast values.</p>
            {result.warnings
              .filter((warning) => warning.code === 'CORRIDOR_WEATHER_PARTIAL')
              .map((warning) => (
                <p key={warning.code} className="rounded-lg bg-amber-50 p-2.5 text-amber-900">
                  {warning.message}
                </p>
              ))}
          </div>
        </aside>
      </div>
    </>
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
      className="overlay absolute top-4 right-14 z-[500] w-72 text-sm"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-semibold text-ink">Corridor cell</p>
          <p className="text-xs text-ink-subtle">{formatLatLonCardinal(cell.lat, cell.lon)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cell details"
          className="rounded-md p-1 text-ink-subtle hover:bg-slate-100"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <dl className="space-y-1.5 px-4 py-3">
        <Row label="Forecast time" value={formatDateTime(hourTime(result.corridor, hour))} />
        <Row label="Wind" value={`${formatValue(cell.wind_mph[hour] ?? null, 1)} mph`} />
        <Row
          label="Rain · Snow"
          value={`${formatValue(cell.rain_in_hr[hour] ?? null, 2)} · ${formatValue(cell.snow_in_hr[hour] ?? null, 2)} in/hr`}
        />
      </dl>
      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <RiskBadge level={level} size="md" />
        <span className="text-xs text-ink-muted">
          for {formatLoad(result.request.load_weight_lb)}
        </span>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold text-ink tabular-nums">{value}</dd>
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
      className="flex w-full items-center justify-between text-sm text-ink"
    >
      {label}
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0 size-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
