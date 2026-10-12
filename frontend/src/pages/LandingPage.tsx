import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Clock, LayoutGrid, Package, Route, ShieldCheck } from 'lucide-react'
import { BRAND_NAME, HERO_ILLUSTRATION_ALT, HERO_ILLUSTRATION_SRC } from '../assets/brand'
import { BrandMark } from '../components/BrandMark'
import { RiskDot } from '../components/RiskBadge'
import { RISK } from '../lib/risk'
import { buttonClass } from '../lib/ui'
import type { RiskLevel } from '../api/types'

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Route,
    title: 'Real routes, compared',
    text: 'Up to three truck route options from a real routing API, each with distance, travel time and arrival.',
  },
  {
    icon: Clock,
    title: 'Forecast at your arrival time',
    text: 'Weather is checked every 10, 25 or 50 miles for the hour the truck is expected to reach each checkpoint.',
  },
  {
    icon: Package,
    title: 'Load-aware wind rules',
    text: 'Wind limits tighten above 30,000 lb and 40,000 lb, so the same wind can be fine for one load and No Travel for another.',
  },
  {
    icon: LayoutGrid,
    title: '0–48 h corridor heatmap',
    text: 'Slide through the next two days of forecast risk along the whole corridor, not just the route line.',
  },
]

const STEPS = [
  {
    title: 'Enter the trip',
    text: 'Origin, destination, departure time, load weight and checkpoint interval.',
  },
  {
    title: 'Score every checkpoint',
    text: 'Wind, rain and snow at each ETA are classified Low to No Travel.',
  },
  {
    title: 'Rank the routes',
    text: 'Fewest Severe miles, then High miles, average risk and travel time.',
  },
  { title: 'Review on the map', text: 'Routes, checkpoints, summaries and the corridor heatmap.' },
]

const LEGEND: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL']

export function LandingPage() {
  useEffect(() => {
    document.title = `${BRAND_NAME} — choose the safest truck route`
  }, [])

  return (
    <div className="min-h-dvh bg-white text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-base font-semibold tracking-tight sm:text-lg">{BRAND_NAME}</span>
          </Link>
          <nav
            aria-label="Site"
            className="ml-auto hidden items-center gap-8 text-[15px] text-ink-muted md:flex"
          >
            <a href="#how-it-works" className="hover:text-ink">
              How it works
            </a>
            <Link to="/about#risk-rules" className="hover:text-ink">
              Risk rules
            </Link>
            <Link to="/about" className="hover:text-ink">
              About
            </Link>
          </nav>
          <Link to="/plan" className={buttonClass('primary', 'md', 'ml-auto md:ml-0')}>
            Plan your trip
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-line bg-canvas">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm text-ink-muted">
                <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
                Route planning for commercial trucks
              </p>
              <h1 className="mt-6 text-4xl leading-[1.05] font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Choose the safest route before the weather chooses for you.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-ink-muted">
                Compare up to three truck routes, check the forecast for the hour you reach each
                checkpoint, and get a recommendation you can explain — ranked by Severe miles, High
                miles, average risk and travel time.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/plan" className={buttonClass('primary', 'lg')}>
                  Plan your trip
                  <ArrowRight className="size-5" aria-hidden="true" />
                </Link>
                <Link to="/about#risk-rules" className={buttonClass('secondary', 'lg')}>
                  See how risk is scored
                </Link>
              </div>
              <ul
                className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted"
                aria-label="Risk levels"
              >
                {LEGEND.map((level) => (
                  <li key={level} className="flex items-center gap-2">
                    <RiskDot level={level} className="size-2.5" />
                    {RISK[level].label}
                  </li>
                ))}
              </ul>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20"
          aria-labelledby="features-title"
        >
          <p className="eyebrow !text-brand">What you get</p>
          <h2
            id="features-title"
            className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl"
          >
            Weather, load and time — weighed in a fixed, explainable order
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="card p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{text}</p>
              </li>
            ))}
          </ul>

          <ol
            id="how-it-works"
            className="card mt-10 grid scroll-mt-6 gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4 lg:p-8"
          >
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-semibold text-ink">{step.title}</span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-ink-muted">
                    {step.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-ink-subtle sm:px-6">
          <p>
            Routing: TomTom · Weather:{' '}
            <a
              href="https://open-meteo.com/"
              className="hover:text-ink"
              target="_blank"
              rel="noreferrer"
            >
              Open-Meteo
            </a>{' '}
            (CC BY 4.0) · Map: ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="hover:text-ink"
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

// Checkpoint colours for the schematic below: a fixed illustrative sequence, not data.
const SCHEMATIC_POINTS: [number, number, RiskLevel][] = [
  [60, 300, 'LOW'],
  [100, 275, 'LOW'],
  [140, 250, 'LOW'],
  [180, 240, 'MODERATE'],
  [220, 230, 'LOW'],
  [260, 205, 'LOW'],
  [300, 180, 'HIGH'],
  [340, 175, 'MODERATE'],
  [380, 170, 'LOW'],
  [415, 140, 'LOW'],
  [450, 110, 'LOW'],
]

/**
 * TODO(asset): replace with the client's hero illustration (assets/brand.ts → HERO_ILLUSTRATION_SRC,
 * 1760 × 1240 px). Until then, a restrained schematic — a route with risk-coloured checkpoints —
 * keeps the page complete without inventing brand imagery or showing fake numbers.
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
        className="w-full rounded-2xl border border-line object-cover"
        onError={() => setFailed(true)}
      />
    )
  }
  const points = SCHEMATIC_POINTS.map(([x, y]) => `${x},${y}`).join(' ') + ' 500,80'
  return (
    <figure
      className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-overlay)]"
      data-testid="hero-fallback"
    >
      <svg
        viewBox="0 0 560 380"
        role="img"
        aria-label="Schematic: a truck route with checkpoints coloured by risk"
        className="block w-full"
      >
        <defs>
          <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="#eef2f7" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="560" height="380" fill="url(#grid)" />
        <polyline
          points="60,300 170,330 320,290 440,200 500,80"
          fill="none"
          stroke="#334155"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.25"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#ffffff"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#0891b2"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {SCHEMATIC_POINTS.slice(1).map(([x, y, level]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r="6.5"
            fill={RISK[level].color}
            stroke="#ffffff"
            strokeWidth="2"
          />
        ))}
        <circle cx="60" cy="300" r="10" fill="#ffffff" stroke="#0f172a" strokeWidth="5" />
        <path
          d="M500 50c-11 0-20 8.6-20 19.3C480 84 500 104 500 104s20-20 20-34.7C520 58.6 511 50 500 50z"
          fill="#2563eb"
          stroke="#ffffff"
          strokeWidth="3"
        />
        <circle cx="500" cy="69" r="6" fill="#ffffff" />
      </svg>
      <figcaption className="flex items-center gap-2 border-t border-line px-5 py-3 text-sm text-ink-muted">
        <Clock className="size-4 text-brand" aria-hidden="true" />
        Each checkpoint is scored for the hour the truck gets there.
      </figcaption>
    </figure>
  )
}
