import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { Info, LayoutGrid, MapPin, Route, Star } from 'lucide-react'
import { useApiHealth } from '../api/useApiHealth'
import { BrandMark } from '../components/BrandMark'
import type { LayoutContext } from '../components/TopBar'

interface NavItem {
  to: string
  label: string
  mobileLabel?: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { to: '/plan', label: 'Plan trip', mobileLabel: 'Plan', icon: MapPin },
  { to: '/routes', label: 'Routes', mobileLabel: 'Routes', icon: Route },
  { to: '/recommendation', label: 'Recommendation', icon: Star },
  { to: '/heatmap', label: 'Weather heatmap', mobileLabel: 'Heatmap', icon: LayoutGrid },
  { to: '/about', label: 'About', mobileLabel: 'About', icon: Info },
]

/** Workspace shell: navy sidebar (≥ 1024 px) or bottom tab bar (< 1024 px). */
export function AppLayout() {
  const { health, retry } = useApiHealth()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const context: LayoutContext = { health, retryHealth: retry }

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-66 flex-col bg-navy-950 text-white lg:flex">
        <Link to="/" className="flex items-center gap-3 px-5 pt-6 pb-8">
          <BrandMark />
          <span className="text-[15px] leading-tight font-semibold">
            Weather-Aware
            <br />
            Truck Routing
          </span>
        </Link>
        <p className="eyebrow px-6 !text-navy-300/80">Workspace</p>
        <nav aria-label="Primary" className="mt-2 flex flex-col gap-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
                  isActive
                    ? 'bg-navy-800 text-white'
                    : 'text-navy-300 hover:bg-navy-900 hover:text-white'
                }`
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 px-6 py-5 text-[13px] leading-6 text-navy-300">
          <p>Routing: TomTom</p>
          <p>Weather: Open-Meteo</p>
          <p>Map: © OpenStreetMap</p>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col pb-16 lg:pb-0 lg:pl-66" id="main" tabIndex={-1}>
        <Outlet context={context} />
      </div>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 border-t border-line bg-white lg:hidden"
      >
        {NAV.filter((item) => item.mobileLabel).map(({ to, mobileLabel, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                isActive ? 'text-brand' : 'text-ink-subtle'
              }`
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {mobileLabel}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
