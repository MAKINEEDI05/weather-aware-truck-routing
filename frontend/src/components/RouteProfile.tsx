import type { RiskLevel, Route } from '../api/types'
import { formatDayTime, formatNumber } from '../lib/format'
import { RISK, milesSummary, riskPatternClass } from '../lib/risk'
import { RiskMilesBar } from './RiskMilesBar'

interface RouteProfileProps {
  route: Route
  /** Strip height and extra classes. */
  className?: string
  /** Width as a share of the container, to draw several routes to scale. */
  scale?: number
  selectedIndex?: number | null
  /** Pointer shortcut for selecting a checkpoint. The checkpoint table is the keyboard path. */
  onSelect?: (index: number) => void
  /** Mile ticks under the strip. */
  axis?: boolean
}

interface Run {
  level: RiskLevel
  miles: number
}

/**
 * Risk along the route, origin to destination: each checkpoint's overall level drawn over the miles
 * it covers. It shows *where* risk sits; the accessible name gives the backend's mile totals.
 */
export function RouteProfile({
  route,
  className = 'h-2.5',
  scale = 1,
  selectedIndex = null,
  onSelect,
  axis = false,
}: RouteProfileProps) {
  const checkpoints = route.checkpoints.filter((checkpoint) => checkpoint.covered_mi > 0)
  const total = checkpoints.reduce((sum, checkpoint) => sum + checkpoint.covered_mi, 0)
  const width = { width: `${Math.max(0, Math.min(1, scale)) * 100}%` }

  if (total <= 0) {
    return (
      <div style={width}>
        <RiskMilesBar metrics={route.metrics} distance={route.distance_mi} className={className} />
      </div>
    )
  }

  const runs: Run[] = []
  let covered = 0
  let caret: number | null = null
  for (const checkpoint of checkpoints) {
    const level = checkpoint.risk.overall
    const last = runs.at(-1)
    if (last && last.level === level) {
      last.miles += checkpoint.covered_mi
    } else {
      runs.push({ level, miles: checkpoint.covered_mi })
    }
    if (checkpoint.index === selectedIndex) {
      caret = (covered + checkpoint.covered_mi / 2) / total
    }
    covered += checkpoint.covered_mi
  }

  return (
    <div style={width}>
      <div className="relative">
        <div
          role="img"
          aria-label={`Risk along ${route.label}. Miles by risk level: ${milesSummary(route.metrics)}`}
          className={`flex w-full gap-px overflow-hidden rounded-[3px] bg-paper-2 ${className}`}
        >
          {runs.map((run, index) => (
            <span
              key={index}
              className={`h-full ${riskPatternClass(run.level)}`}
              style={{ flexGrow: run.miles, flexBasis: 0, backgroundColor: RISK[run.level].color }}
            />
          ))}
        </div>
        {onSelect && (
          <div aria-hidden="true" className="absolute inset-0 flex">
            {checkpoints.map((checkpoint) => (
              <span
                key={checkpoint.index}
                title={`Mile ${formatNumber(checkpoint.mile, checkpoint.mile % 1 === 0 ? 0 : 1)} · ${formatDayTime(checkpoint.eta)} · ${RISK[checkpoint.risk.overall].label}`}
                onClick={() => onSelect(checkpoint.index)}
                className="h-full cursor-pointer hover:bg-ink/20"
                style={{ flexGrow: checkpoint.covered_mi, flexBasis: 0 }}
              />
            ))}
          </div>
        )}
        {caret !== null && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-2 -bottom-1 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${caret * 100}%` }}
          >
            <span className="size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-accent" />
            <span className="w-0.5 flex-1 bg-accent" />
          </span>
        )}
      </div>
      {axis && <MileAxis distance={route.distance_mi} />}
    </div>
  )
}

const TICKS = [0, 0.25, 0.5, 0.75, 1]

function MileAxis({ distance }: { distance: number }) {
  return (
    <div aria-hidden="true" className="relative mt-1.5 h-4 text-[11px] text-ink-3">
      {TICKS.map((tick) => (
        <span
          key={tick}
          className={`num absolute top-0 whitespace-nowrap ${
            tick === 0 ? '' : tick === 1 ? '-translate-x-full' : '-translate-x-1/2'
          }`}
          style={{ left: `${tick * 100}%` }}
        >
          {formatNumber(distance * tick, 0)}
          {tick === 1 ? ' mi' : ''}
        </span>
      ))}
    </div>
  )
}
