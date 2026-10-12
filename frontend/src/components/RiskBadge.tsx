import type { RiskLevel } from '../api/types'
import { RISK, riskPatternClass } from '../lib/risk'

interface RiskBadgeProps {
  level: RiskLevel
  size?: 'sm' | 'md'
}

/** Risk level as a sign-like tag: colour chip plus the level in text (never colour alone). */
export function RiskBadge({ level, size = 'sm' }: RiskBadgeProps) {
  const style = RISK[level]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] font-semibold whitespace-nowrap ${
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
      }`}
      style={{ backgroundColor: style.tint, color: style.text }}
    >
      <RiskDot level={level} className={size === 'sm' ? 'size-2.5' : 'size-3'} />
      {style.label}
    </span>
  )
}

/** Square risk chip. Unknown is an outline; No Travel carries barricade stripes. */
export function RiskDot({
  level,
  className = 'size-2.5',
}: {
  level: RiskLevel
  className?: string
}) {
  const style = RISK[level]
  const unknown = level === 'UNKNOWN'
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-[2px] ${riskPatternClass(level)} ${className}`}
      style={
        unknown
          ? { border: `1.5px dashed ${style.color}`, backgroundColor: 'transparent' }
          : { backgroundColor: style.color }
      }
    />
  )
}
