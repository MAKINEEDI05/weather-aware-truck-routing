import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { CloudOff, Info, Layers, MapPinned, Route } from 'lucide-react'
import { useApiHealth } from '../api/useApiHealth'
import { ApiStatus } from '../components/ApiStatus'
import { BrandMark } from '../components/BrandMark'

interface NavItem {
  to: string
  label: string
  mobileLabel?: string
  icon: LucideIcon
}

// The workflow, in order. About sits apart from the numbered steps.
const STEPS: NavItem[] = [
  { to: '/plan', label: 'Plan trip', mobileLabel: 'Plan', icon: MapPinned },
  { to: '/routes', label: 'Routes', mobileLabel: 'Routes', icon: Route },
  { to: '/recommendation', label: 'Recommendation', icon: Route },
  { to: '/heatmap', label: 'Weather heatmap', mobileLabel: 'Heatmap', icon: Layers },
]
const ABOUT: NavItem = { to: '/about', label: 'About', mobileLabel: 'About', icon: Info }

/**
 * Workspace shell: a dark dispatch bar with the numbered workflow (≥ 1024 px) or a dark bottom tab
 * bar (< 1024 px). Pages render their own title block below it.
 */
export function AppLayout() {
  const { health, retry } = useApiHealth()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[1000] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <header className="on-dark sticky top-0 z-[600] h-14 shrink-0 bg-asphalt text-white">
        <div className="flex h-full items-center gap-4 px-4 lg:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark size="sm" />
            <span className="truncate text-[15px] leading-none font-bold tracking-tight">
              Weather-Aware <span className="font-normal text-fog">Truck Routing</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="ml-4 hidden h-full items-stretch lg:flex">
            {STEPS.map((item, index) => (
              <BarLink key={item.to} item={item} step={index + 1} />
            ))}
            <span aria-hidden="true" className="mx-2 my-4 w-px bg-asphalt-3" />
            <BarLink item={ABOUT} />
          </nav>

          <div className="ml-auto">
            <ApiStatus health={health} onRetry={retry} />
          </div>
        </div>
      </header>

      {health.state === 'offline' && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border-b border-[#e9b9b3] bg-danger-soft px-4 py-2.5 text-sm text-danger lg:px-6"
        >
          <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Backend unavailable.</span> {health.message} Make sure
            the Django server is running, then select Retry.
          </p>
        </div>
      )}

      <main id="main" tabIndex={-1} className="flex flex-1 flex-col pb-16 outline-none lg:pb-0">
        <Outlet />
      </main>

      <nav
        aria-label="Primary mobile"
        className="on-dark fixed inset-x-0 bottom-0 z-[600] grid h-16 grid-cols-4 border-t border-asphalt-3 bg-asphalt pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {[...STEPS, ABOUT]
          .filter((item) => item.mobileLabel)
          .map(({ to, mobileLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide ${
                  isActive ? 'text-white' : 'text-fog hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-6 top-0 h-[3px] rounded-b bg-accent-on-dark"
                    />
                  )}
                  <Icon className="size-5" aria-hidden="true" />
                  {mobileLabel}
                </>
              )}
            </NavLink>
          ))}
      </nav>
    </div>
  )
}

function BarLink({ item, step }: { item: NavItem; step?: number }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `relative flex items-center gap-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
          isActive ? 'text-white' : 'text-fog hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {step !== undefined && (
            <span
              aria-hidden="true"
              className={`font-mono text-[11px] ${isActive ? 'text-accent-on-dark' : 'text-fog/60'}`}
            >
              {String(step).padStart(2, '0')}
            </span>
          )}
          {item.label}
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-accent-on-dark"
            />
          )}
        </>
      )}
    </NavLink>
  )
}
