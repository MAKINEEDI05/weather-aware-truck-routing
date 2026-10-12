import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { PageHeader } from '../components/PageHeader'
import { RankingList, RiskRulesTable } from '../components/RulesContent'

const SECTIONS = [
  { id: 'purpose', label: 'Purpose' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'risk-rules', label: 'Risk rules' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'data', label: 'Data & technology' },
  { id: 'limitations', label: 'Limitations' },
]

const PIPELINE: { title: string; text: string }[] = [
  {
    title: 'Pick both places',
    text: 'Each search returns candidates from the TomTom geocoder; you choose the exact place. Continental US only.',
  },
  {
    title: 'Request truck routes',
    text: 'The TomTom Routing API in truck mode returns up to three options. The real number returned is shown — routes are never invented.',
  },
  {
    title: 'Place checkpoints',
    text: 'Every 10, 25 or 50 miles along each route, each with the time the truck is expected to arrive there.',
  },
  {
    title: 'Look up the forecast at each ETA',
    text: 'Open-Meteo hourly wind, rain and snow for the hour the truck reaches each checkpoint — not the weather now.',
  },
  {
    title: 'Score each checkpoint',
    text: 'Fixed thresholds per factor; the worst factor sets the level. Load weight tightens the wind limits.',
  },
  {
    title: 'Rank and explain',
    text: 'Routes are compared criterion by criterion, and the page states which criterion decided.',
  },
]

const STACK: { label: string; text: string }[] = [
  { label: 'Frontend', text: 'React 19 · TypeScript · Vite · Tailwind CSS · React Leaflet' },
  { label: 'Backend', text: 'Django 5.2 LTS · Django REST Framework · stateless JSON API' },
  { label: 'Routing & geocoding', text: 'TomTom Routing API (truck mode) and Geocoding API' },
  { label: 'Weather', text: 'Open-Meteo Forecast API · hourly wind, rain, snow · CC BY 4.0' },
  { label: 'Map tiles', text: '© OpenStreetMap contributors' },
  { label: 'Type', text: 'Overpass and Overpass Mono, after the US Highway Gothic sign lettering' },
]

const LIMITATIONS = [
  'ETAs assume continuous driving with no rest stops.',
  'Forecasts are predictions and can change; the risk is only as good as the forecast.',
  "Forecast values describe the weather model's grid cell, which can be a few kilometres from the road.",
  'Missing forecast data is shown as Unknown and is never treated as Low.',
  'The free weather service is for non-commercial use.',
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
      <PageHeader
        title="About"
        kicker="Field manual"
        description="What the planner does, the rules it applies and where its data comes from."
      />
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-8 p-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:p-8">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-20 space-y-0.5 border-l border-line">
            {SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="-ml-px flex gap-2.5 border-l-2 border-transparent py-1.5 pl-3 text-sm text-ink-2 hover:border-accent hover:text-accent-ink"
                >
                  <span className="num text-xs text-ink-3">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="max-w-4xl min-w-0 space-y-6">
          <section
            id="purpose"
            className="panel scroll-mt-20 p-6 lg:p-8"
            aria-labelledby="purpose-title"
          >
            <p className="kicker !text-accent-ink">01 · Purpose</p>
            <h2
              id="purpose-title"
              className="mt-2 text-2xl leading-tight font-bold tracking-tight lg:text-[30px]"
            >
              Help a truck driver choose the safest route based on weather, load weight and travel
              time.
            </h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink-2">
              Enter an origin, destination, departure time and load weight. The app compares the
              routes returned by a real routing service, checks the forecast at each checkpoint for
              the hour the truck is expected to arrive, scores the risk with fixed rules, and
              recommends a route with a plain-language reason.
            </p>
          </section>

          <Section id="how-it-works" number="02" title="How it works">
            <ol className="relative mt-4 space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-accent/30">
              {PIPELINE.map((step, index) => (
                <li key={step.title} className="relative flex gap-4">
                  <span className="num relative flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-accent text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold text-ink">{step.title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-ink-2">
                      {step.text}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="risk-rules" number="03" title="Risk rules" note="Per checkpoint">
            <div className="mt-3 -mx-3">
              <RiskRulesTable />
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
              Decimal wind speeds use half-open ranges (34.6 mph is Moderate). A value on a shared
              rain or snow boundary belongs to the higher level. Missing forecast data is shown as
              Unknown and is never treated as Low.
            </p>
          </Section>

          <Section id="ranking" number="04" title="How routes are ranked">
            <div className="mt-2 max-w-md">
              <RankingList />
            </div>
            <p className="mt-3 text-sm text-ink-2">
              Compared strictly in this order; the first difference decides. App policy: a route
              with any No Travel miles keeps its rank but is never recommended.
            </p>
          </Section>

          <Section id="data" number="05" title="Data & technology">
            <dl className="mt-3 divide-y divide-line">
              {STACK.map(({ label, text }) => (
                <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <dt className="kicker pt-0.5">{label}</dt>
                  <dd className="text-sm text-ink">{text}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section id="limitations" number="06" title="Limitations">
            <ul className="mt-3 space-y-2">
              {LIMITATIONS.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                  <span aria-hidden="true" className="mt-2 h-px w-3 shrink-0 bg-ink-3" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </>
  )
}

function Section({
  id,
  number,
  title,
  note,
  children,
}: {
  id: string
  number: string
  title: string
  note?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="panel scroll-mt-20 p-6" aria-labelledby={`${id}-title`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-title`} className="flex items-baseline gap-3 text-lg font-bold">
          <span aria-hidden="true" className="kicker !text-accent-ink">
            {number}
          </span>
          {title}
        </h2>
        {note && <span className="kicker">{note}</span>}
      </div>
      {children}
    </section>
  )
}
