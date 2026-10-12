import { routeColor } from '../lib/routes'

const SHIELD_SIZES = {
  sm: 'size-5 rounded-[4px] text-[11px]',
  md: 'size-6 rounded-[5px] text-xs',
  lg: 'size-8 rounded-md text-sm',
}

/**
 * Route identity badge: the route letter on its identity colour, as drawn on the map. Decorative —
 * the route name is always given in text next to it.
 */
export function RouteShield({
  routeId,
  size = 'md',
}: {
  routeId: string
  size?: keyof typeof SHIELD_SIZES
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-mono leading-none font-bold text-white ${SHIELD_SIZES[size]}`}
      style={{ backgroundColor: routeColor(routeId) }}
    >
      <span className="translate-y-px">{routeId}</span>
    </span>
  )
}

/** A short line in the route's colour, for places where a letter would repeat the text. */
export function RouteSwatch({
  routeId,
  className = 'h-1 w-6',
}: {
  routeId: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: routeColor(routeId) }}
    />
  )
}
