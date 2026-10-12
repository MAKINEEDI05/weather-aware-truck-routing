import type { RiskLevel } from '../api/types'
import { RISK } from '../lib/risk'

interface RiskBadgeProps {
  level: RiskLevel
  size?: 'sm' | 'md'
}

/** Risk level as text on a tinted pill, with a coloured dot (never colour alone). */
export function RiskBadge({ level, size = 'sm' }: RiskBadgeProps) {
  const style = RISK[level]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
      style={{ backgroundColor: style.tint, color: style.text }}
    >
      <RiskDot level={level} />
      {style.label}
    </span>
  )
}

export function RiskDot({ level, className = 'size-2' }: { level: RiskLevel; className?: string }) {
  const style = RISK[level]
  const unknown = level === 'UNKNOWN'
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={
        unknown
          ? { border: `1.5px solid ${style.color}`, backgroundColor: 'transparent' }
          : { backgroundColor: style.color }
      }
    />
  )
}
