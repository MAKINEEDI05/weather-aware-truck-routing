import { Link } from 'react-router'
import { PageHeader } from '../components/PageHeader'
import { buttonClass } from '../lib/ui'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" kicker="Error 404" />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-8 p-4 sm:flex-row sm:items-center lg:p-8">
        {/* A route-marker sign: decorative. */}
        <div
          aria-hidden="true"
          className="flex w-44 shrink-0 flex-col items-center rounded-xl border-[3px] border-white bg-ink px-4 pt-4 pb-5 text-white shadow-[0_0_0_3px_var(--color-ink)]"
        >
          <span className="font-mono text-[11px] tracking-[0.2em] text-white/70">NO ROUTE</span>
          <span className="num mt-1 text-6xl leading-none font-bold">404</span>
          <span className="mt-3 h-0.5 w-16 bg-white/40" />
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl leading-tight font-bold tracking-tight">
            This page does not exist
          </h2>
          <p className="mt-2 text-[15px] text-ink-2">
            Check the address, or start over by planning a trip.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link to="/plan" className={buttonClass('primary')}>
              Plan a trip
            </Link>
            <Link to="/" className={buttonClass('secondary')}>
              Start page
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
