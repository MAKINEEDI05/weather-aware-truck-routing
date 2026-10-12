import { useApiHealth } from './api/useApiHealth'
import { ApiStatus } from './components/ApiStatus'
import { TripMap } from './features/map/TripMap'

// Recommendation priority, quoted from the assessment (blueprint §3.3).
const RANKING_CRITERIA = [
  'Fewest Severe miles',
  'Fewest High miles',
  'Lowest average risk',
  'Shortest travel time',
]

export default function App() {
  const { health, retry } = useApiHealth()

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100 text-slate-900 lg:h-dvh">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-7" />
          <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
            Weather-Aware Truck Routing
          </h1>
        </div>
        <ApiStatus health={health} onRetry={retry} />
      </header>

      <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <aside
          aria-label="Trip planner"
          className="shrink-0 space-y-4 border-slate-200 bg-white p-4 lg:w-100 lg:overflow-y-auto lg:border-r"
        >
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Plan a trip</h2>
            <p className="mt-1 text-sm text-slate-600">Enter a trip to compare routes.</p>
          </section>

          {health.state === 'offline' && (
            <section
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <p className="font-medium">Backend unavailable</p>
              <p className="mt-1">{health.message}</p>
              <p className="mt-1 text-red-700">
                Make sure the Django server is running, then select Retry.
              </p>
            </section>
          )}

          <section className="rounded-lg border border-slate-200 p-3">
            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              How routes are ranked
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {RANKING_CRITERIA.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ol>
          </section>
        </aside>

        <section aria-label="Map" className="relative h-[60vh] lg:h-auto lg:flex-1">
          <TripMap />
        </section>
      </main>
    </div>
  )
}
