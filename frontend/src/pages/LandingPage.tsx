import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Clock, Layers, ListOrdered, MapPinned, Route, Weight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RiskLevel } from '../api/types'
import { BRAND_NAME, HERO_ILLUSTRATION_ALT, HERO_ILLUSTRATION_SRC } from '../assets/brand'
import { BrandMark } from '../components/BrandMark'
import { RiskDot } from '../components/RiskBadge'
import { RouteShield } from '../components/RouteShield'
import { RISK, riskPatternClass } from '../lib/risk'
import { LOAD_RULES, RANKING_CRITERIA, RULE_LEVELS } from '../lib/rulesCopy'
import { buttonClass } from '../lib/ui'

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MapPinned,
    title: 'Enter the trip',
    text: 'Origin, destination, departure time, load weight and how often to check the weather.',
  },
  {
    icon: Clock,
    title: 'Score every checkpoint at its ETA',
    text: 'Wind, rain and snow are read for the hour the truck reaches each point, then rated Low to No Travel.',
  },
  {
    icon: ListOrdered,
    title: 'Rank the routes in a fixed order',
    text: 'Fewest Severe miles, then High miles, average risk and travel time. The first difference decides.',
  },
  {
    icon: Layers,
    title: 'Check it on the map',
    text: 'Routes, checkpoints, a written explanation and a 0–48 h corridor heatmap.',
  },
]

const VIEWS: { title: string; text: string }[] = [
  {
    title: 'Route comparison',
    text: 'Every route the routing service returned, side by side, with its risk drawn along the road.',
  },
  {
    title: 'Recommendation',
    text: 'The chosen route, the criterion that decided it, and why each other route was not chosen.',
  },
  {
    title: 'Route details',
    text: 'Each checkpoint with its ETA, forecast values, risk level and the rule behind it.',
  },
  {
    title: 'Weather heatmap',
    text: 'Risk across the whole corridor for any hour from departure to 48 hours later.',
  },
]

export function LandingPage() {
  useEffect(() => {
    document.title = `${BRAND_NAME} — choose the safest truck route`
  }, [])

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="on-dark bg-asphalt text-white">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark size="md" />
            <span className="hidden text-base leading-none font-bold tracking-tight sm:inline">
              Weather-Aware <span className="font-normal text-fog">Truck Routing</span>
            </span>
          </Link>
          <nav
            aria-label="Site"
            className="ml-auto hidden items-center gap-7 text-sm font-semibold text-fog md:flex"
          >
            <a href="#how-it-works" className="hover:text-white">
              How it works
            </a>
            <Link to="/about#risk-rules" className="hover:text-white">
              Risk rules
            </Link>
            <Link to="/about" className="hover:text-white">
              About
            </Link>
          </nav>
          <Link to="/plan" className={buttonClass('inverse', 'md', 'ml-auto md:ml-0')}>
            Plan your trip
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className="on-dark relative overflow-hidden bg-asphalt text-white">
          <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pt-20 lg:pb-24">
            <div>
              <p className="font-mono text-xs tracking-[0.14em] text-fog uppercase">
                Truck route planning · Continental US
              </p>
              <h1 className="mt-5 text-[40px] leading-[1.02] font-extrabold tracking-tight sm:text-6xl lg:text-[68px]">
                Know the weather at every mile.{' '}
                <span className="text-fog">Choose the safest route.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
                Compare the truck routes a real routing service returns. Every checkpoint is scored
                against the forecast for the hour your truck gets there, and the recommendation
                shows exactly which rule decided it.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/plan" className={buttonClass('inverse', 'lg')}>
                  Plan your trip
                  <ArrowRight className="size-5" aria-hidden="true" />
                </Link>
                <Link to="/about#risk-rules" className={buttonClass('outline-dark', 'lg')}>
                  How risk is scored
                </Link>
              </div>
              <RiskRamp />
            </div>
            <HeroVisual />
          </div>
          <div aria-hidden="true" className="lane-dashes h-1 opacity-40 [--color-ink:#ffffff]" />
        </section>

        <section
          id="how-it-works"
          className="mx-auto max-w-[1280px] scroll-mt-4 px-4 py-16 sm:px-6 lg:py-24"
          aria-labelledby="how-title"
        >
          <p className="kicker">How a route is judged</p>
          <h2
            id="how-title"
            className="mt-2 max-w-3xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl"
          >
            The same rules, in the same order, every time.
          </h2>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="num text-sm font-semibold text-ink-3">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Icon className="size-5 text-ink" aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-lg leading-snug font-bold">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-line bg-surface" aria-labelledby="rules-title">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div>
              <p className="kicker">The tie-break ladder</p>
              <h2
                id="rules-title"
                className="mt-2 text-2xl leading-tight font-bold tracking-tight sm:text-3xl"
              >
                Risk first. Time only breaks a tie.
              </h2>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-2">
                Routes are compared one criterion at a time. A faster route never wins over a safer
                one, and a route with any No Travel miles is never recommended.
              </p>
              <ol className="mt-6 space-y-2">
                {RANKING_CRITERIA.map((criterion, index) => (
                  <li
                    key={criterion}
                    className="flex items-center gap-4 rounded-md border border-line bg-paper px-4 py-3"
                  >
                    <span className="num flex size-7 shrink-0 items-center justify-center rounded-[5px] bg-ink text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="font-semibold">{criterion}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="kicker">Load-aware wind limits</p>
              <h3 className="mt-2 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
                The same wind can be fine for one load and No Travel for another.
              </h3>
              <ul className="mt-6 space-y-2">
                {LOAD_RULES.map((rule) => (
                  <li
                    key={rule.when}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-line px-4 py-3"
                  >
                    <span>
                      <span className="num block text-[15px] font-semibold">{rule.when}</span>
                      <span className="flex items-center gap-1.5 text-sm text-ink-2">
                        <Weight className="size-3.5" aria-hidden="true" />
                        {rule.load}
                      </span>
                    </span>
                    <span
                      className="rounded-[4px] px-2 py-1 font-mono text-xs font-semibold tracking-wider text-white uppercase"
                      style={{
                        backgroundColor:
                          rule.result === 'No Travel' ? RISK.NO_TRAVEL.color : RISK.SEVERE.color,
                      }}
                    >
                      {rule.result}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/about#risk-rules"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-2"
              >
                All wind, rain and snow thresholds
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:py-20"
          aria-labelledby="views-title"
        >
          <p className="kicker">After you plan</p>
          <h2
            id="views-title"
            className="mt-2 text-2xl leading-tight font-bold tracking-tight sm:text-3xl"
          >
            Four views of the same trip
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VIEWS.map((view, index) => (
              <li key={view.title} className="border-t-2 border-ink pt-4">
                <p className="num text-xs text-ink-3">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="mt-1 text-lg font-bold">{view.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{view.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-col items-start gap-4 rounded-lg bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <p className="text-xl font-bold">Start with an origin and a destination.</p>
            <Link to="/plan" className={buttonClass('inverse', 'lg')}>
              <Route className="size-5" aria-hidden="true" />
              Plan a route
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-6 text-sm text-ink-3 sm:px-6">
          <p>
            Routing: TomTom · Weather:{' '}
            <a
              href="https://open-meteo.com/"
              className="underline underline-offset-2 hover:text-ink"
              target="_blank"
              rel="noreferrer"
            >
              Open-Meteo
            </a>{' '}
            (CC BY 4.0) · Map: ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="underline underline-offset-2 hover:text-ink"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap
            </a>{' '}
            contributors
          </p>
          <nav aria-label="Footer" className="flex gap-5 sm:ml-auto">
            <Link to="/about" className="hover:text-ink">
              About
            </Link>
            <Link to="/about#risk-rules" className="hover:text-ink">
              Risk rules
            </Link>
            <Link to="/plan" className="hover:text-ink">
              Plan a trip
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

/** The five risk levels as a ramp, darkening with severity. */
function RiskRamp() {
  return (
    <div className="mt-10 max-w-md">
      <ul className="grid grid-cols-5 gap-1" aria-label="Risk levels">
        {RULE_LEVELS.map((level) => (
          <li key={level} className="text-xs text-fog">
            <span
              aria-hidden="true"
              className={`mb-1.5 block h-1.5 rounded-[2px] ${riskPatternClass(level)}`}
              style={{ backgroundColor: RISK[level].color }}
            />
            {RISK[level].label}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-fog">
        <RiskDot level="UNKNOWN" className="size-2.5" />
        Missing forecasts are Unknown — never treated as Low.
      </p>
    </div>
  )
}

// A fixed, illustrative sequence — not data. Weights are relative lengths of each stretch.
const SCHEMATIC: {
  id: string
  rank: number
  tag: string
  tone: string
  runs: [RiskLevel, number][]
}[] = [
  {
    id: 'C',
    rank: 1,
    tag: 'Recommended',
    tone: 'bg-[#3f9f62] text-white',
    runs: [
      ['LOW', 34],
      ['MODERATE', 12],
      ['LOW', 30],
      ['MODERATE', 8],
      ['LOW', 22],
    ],
  },
  {
    id: 'A',
    rank: 2,
    tag: 'Eligible',
    tone: 'border border-asphalt-3 text-fog',
    runs: [
      ['LOW', 26],
      ['MODERATE', 10],
      ['HIGH', 9],
      ['MODERATE', 8],
      ['LOW', 45],
    ],
  },
  {
    id: 'B',
    rank: 3,
    tag: 'No Travel',
    tone: 'bg-[#4e1a55] text-white',
    runs: [
      ['LOW', 18],
      ['HIGH', 10],
      ['SEVERE', 8],
      ['NO_TRAVEL', 7],
      ['SEVERE', 6],
      ['MODERATE', 9],
      ['LOW', 46],
    ],
  },
]

/**
 * TODO(asset): replace with the client's hero illustration (assets/brand.ts → HERO_ILLUSTRATION_SRC).
 * Until then, a labelled schematic of the route board — three routes with risk drawn along each —
 * keeps the page complete without inventing brand imagery or showing numbers.
 */
function HeroVisual() {
  const [failed, setFailed] = useState(false)
  if (HERO_ILLUSTRATION_SRC && !failed) {
    return (
      <img
        src={HERO_ILLUSTRATION_SRC}
        alt={HERO_ILLUSTRATION_ALT}
        width={1760}
        height={1240}
        className="w-full rounded-xl object-cover"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <figure
      className="rounded-xl border border-asphalt-3 bg-asphalt-2 p-5 shadow-[0_24px_60px_rgb(0_0_0/0.35)] sm:p-6"
      data-testid="hero-fallback"
    >
      <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.12em] text-fog uppercase">
        <span>Route board</span>
        <span className="rounded-[3px] border border-asphalt-3 px-1.5 py-0.5">Illustration</span>
      </div>
      <div
        role="img"
        aria-label="Illustration: three routes, each drawn as a strip coloured by the risk at each checkpoint. The top route is recommended; the bottom one has a No Travel stretch."
        className="mt-5"
      >
        <div className="mb-3 flex justify-between text-xs text-fog">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-[3px] border-white" /> Origin
          </span>
          <span className="flex items-center gap-1.5">
            Destination <span className="size-2.5 rounded-[2px] bg-white" />
          </span>
        </div>
        <ul className="space-y-4">
          {SCHEMATIC.map((row) => (
            <li
              key={row.id}
              className={`rounded-lg p-3 ${row.rank === 1 ? 'bg-white/[0.06] ring-1 ring-white/25' : ''}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <RouteShield routeId={row.id} size="sm" />
                <span className="text-sm font-semibold">Route {row.id}</span>
                <span className="num text-xs text-fog">#{row.rank}</span>
                <span
                  className={`ml-auto rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${row.tone}`}
                >
                  {row.tag}
                </span>
              </div>
              <div className="flex h-3 gap-px overflow-hidden rounded-[3px]">
                {row.runs.map(([level, weight], index) => (
                  <span
                    key={index}
                    className={riskPatternClass(level)}
                    style={{ flexGrow: weight, flexBasis: 0, backgroundColor: RISK[level].color }}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-3 font-mono text-[11px] text-fog">
          <span>Departure</span>
          <span className="h-px flex-1 bg-asphalt-3" />
          <span>Arrival</span>
        </div>
      </div>
      <figcaption className="mt-4 border-t border-asphalt-3 pt-3 text-[13px] text-fog">
        Each stretch is a checkpoint scored for the hour the truck gets there. Your plan uses live
        routing and forecasts.
      </figcaption>
    </figure>
  )
}
