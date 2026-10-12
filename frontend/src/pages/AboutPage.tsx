import { useEffect } from 'react'
import { useLocation } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Clock,
  Code,
  CloudRain,
  Database,
  Info,
  Layers,
  LayoutGrid,
  MapPin,
  Route,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { RankingList, RiskRulesTable } from '../components/RulesContent'
import { TopBar } from '../components/TopBar'

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Route,
    title: 'Up to three route options',
    text: 'From the TomTom Routing API in truck mode, with distance, travel time and arrival. The real number returned is always shown.',
  },
  {
    icon: Clock,
    title: 'Forecast at each ETA',
    text: 'Checkpoints every 10, 25 or 50 miles, matched to the forecast hour the truck arrives.',
  },
  {
    icon: ShieldCheck,
    title: 'Rule-based risk',
    text: 'Wind, rain and snow thresholds plus load-dependent wind rules from the assessment.',
  },
  {
    icon: Star,
    title: 'Explainable ranking',
    text: 'Severe miles, then High miles, average risk and travel time — never a hidden score.',
  },
  {
    icon: MapPin,
    title: 'Map of every checkpoint',
    text: 'Routes, risk-coloured checkpoints, ETAs and route summaries in one view.',
  },
  {
    icon: LayoutGrid,
    title: '0–48 h corridor heatmap',
    text: 'Risk across the trip corridor for any hour in the next two days.',
  },
]

const STACK: { icon: LucideIcon; label: string; text: string }[] = [
  {
    icon: Code,
    label: 'Frontend',
    text: 'React 19 · TypeScript · Vite · Tailwind CSS · React Leaflet',
  },
  {
    icon: Database,
    label: 'Backend',
    text: 'Django 5.2 LTS · Django REST Framework · stateless JSON API',
  },
  {
    icon: Route,
    label: 'Routing & geocoding',
    text: 'TomTom Routing API (truck mode) and Geocoding API',
  },
  {
    icon: CloudRain,
    label: 'Weather',
    text: 'Open-Meteo Forecast API · hourly wind, rain, snow · CC BY 4.0',
  },
  { icon: Layers, label: 'Map tiles', text: '© OpenStreetMap contributors' },
]

export function AboutPage() {
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
    }
  }, [hash])

  return (
    <>
      <TopBar title="About" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:gap-6 lg:p-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-4 lg:space-y-6">
          <section className="card p-6 lg:p-8">
            <p className="eyebrow !text-brand">Purpose</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink lg:text-[28px] lg:leading-tight">
              Help a truck driver choose the safest route based on weather, load weight and travel
              time.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
              Enter an origin, destination, departure time and load weight. The app compares the
              routes returned by a real routing service, checks the forecast at each checkpoint for
              the hour the truck is expected to arrive, scores the risk with fixed rules, and
              recommends a route with a plain-language reason.
            </p>
          </section>

          <section className="card p-6" aria-labelledby="features-title">
            <h2 id="features-title" className="text-base font-semibold text-ink">
              Core features
            </h2>
            <ul className="mt-4 grid gap-5 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-ink-muted">
                      {text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6" aria-labelledby="ranking-title">
            <h2 id="ranking-title" className="text-base font-semibold text-ink">
              How routes are ranked
            </h2>
            <div className="mt-2">
              <RankingList />
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              Compared strictly in this order; the first difference decides. App policy: a route
              with any No Travel miles keeps its rank but is never recommended.
            </p>
          </section>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <section id="risk-rules" className="card scroll-mt-20" aria-labelledby="rules-title">
            <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
              <h2 id="rules-title" className="text-base font-semibold text-ink">
                Risk rules
              </h2>
              <span className="text-sm text-ink-subtle">Per checkpoint</span>
            </div>
            <div className="py-3">
              <RiskRulesTable />
            </div>
            <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-ink-subtle">
              Decimal wind speeds use half-open ranges (34.6 mph is Moderate). A value on a shared
              rain or snow boundary belongs to the higher level. Missing forecast data is shown as
              Unknown and is never treated as Low.
            </p>
          </section>

          <section className="card p-6" aria-labelledby="stack-title">
            <h2 id="stack-title" className="text-base font-semibold text-ink">
              Technology &amp; data providers
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {STACK.map(({ icon: Icon, label, text }) => (
                <li key={label} className="flex gap-3 py-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-ink-subtle" aria-hidden="true" />
                  <span>
                    <span className="eyebrow block">{label}</span>
                    <span className="block text-sm text-ink">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex gap-3 rounded-xl border border-blue-200 bg-brand-soft p-5 text-sm leading-relaxed text-blue-900">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              <strong className="font-semibold">Limitations.</strong> ETAs assume continuous driving
              with no rest stops. Forecasts are predictions and can change; risk is only as good as
              the forecast. Forecast values describe the weather model's grid cell, which can be a
              few kilometres from the road. The free weather service is for non-commercial use.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
