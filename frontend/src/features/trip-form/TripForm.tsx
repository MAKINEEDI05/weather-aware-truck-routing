import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ArrowUpDown, LoaderCircle } from 'lucide-react'
import type { CheckpointInterval } from '../../api/types'
import { timeZoneName } from '../../lib/format'
import { buttonClass } from '../../lib/ui'
import { useTrip } from '../../state/TripContext'
import { FieldError, LocationSearch } from './LocationSearch'
import {
  FIELD_ORDER,
  INTERVALS,
  MAX_DEPARTURE_DAYS,
  defaultDepartureLocal,
  draftMatchesResult,
  parseLoad,
  parseLocalDateTime,
  serverErrorsToFields,
  toLocalInputValue,
  validateDraft,
} from './validation'
import type { FieldErrors, FieldName } from './validation'

const FOCUS_TARGET: Record<FieldName, string> = {
  origin: 'origin-input',
  destination: 'destination-input',
  departure: 'departure',
  load: 'load',
  interval: 'interval-25',
}

const DEPARTURE_SHIFTS = [1, 3, 6]

interface TripFormProps {
  onPlanned?: () => void
}

export function TripForm({ onPlanned }: TripFormProps) {
  const { draft, updateDraft, status, error, result, submitPlan } = useTrip()
  const [submitted, setSubmitted] = useState(false)
  const loading = status === 'loading'

  const serverErrors: FieldErrors =
    status === 'error' && error?.status === 400 ? serverErrorsToFields(error.details) : {}
  const errors: FieldErrors = submitted
    ? { ...validateDraft(draft), ...serverErrors }
    : serverErrors
  const errorCount = Object.keys(errors).length
  const bothPlaces = Boolean(draft.origin && draft.destination)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    const found = validateDraft(draft)
    const first = FIELD_ORDER.find((field) => found[field])
    if (first) {
      document.getElementById(FOCUS_TARGET[first])?.focus()
      return
    }
    if (await submitPlan()) {
      setSubmitted(false)
      onPlanned?.()
    }
  }

  function shiftDeparture(hours: number) {
    const base =
      parseLocalDateTime(draft.departureLocal) ?? parseLocalDateTime(defaultDepartureLocal())
    if (!base) return
    updateDraft({ departureLocal: toLocalInputValue(new Date(base.getTime() + hours * 3_600_000)) })
  }

  const now = new Date()
  const zone = timeZoneName()
  const inputsChanged = result !== null && !draftMatchesResult(draft, result)

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Trip details"
      className="@container flex flex-col"
    >
      <Section number={1} title="Where">
        <div className="relative space-y-4">
          <LocationSearch
            id="origin"
            label="Origin"
            value={draft.origin}
            onChange={(origin) => updateDraft({ origin })}
            error={errors.origin}
            disabled={loading}
          />
          <div className="absolute top-[-6px] right-0 z-10 translate-y-0">
            <button
              type="button"
              onClick={() => updateDraft({ origin: draft.destination, destination: draft.origin })}
              disabled={loading || (!draft.origin && !draft.destination)}
              aria-label="Swap origin and destination"
              title="Swap origin and destination"
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-ink-2 hover:bg-paper-2 hover:text-ink disabled:opacity-40"
            >
              <ArrowUpDown className="size-3.5" aria-hidden="true" />
              <span aria-hidden="true">Swap</span>
            </button>
          </div>
          <LocationSearch
            id="destination"
            label="Destination"
            tone="destination"
            value={draft.destination}
            onChange={(destination) => updateDraft({ destination })}
            error={errors.destination}
            disabled={loading}
          />
        </div>
      </Section>

      <Section number={2} title="When and what">
        <div className="grid gap-x-4 gap-y-5 @md:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="departure" className="field-label">
                Departure date &amp; time
              </label>
              <span className="num text-[11px] text-ink-3">{zone}</span>
            </div>
            <div className="field" data-invalid={Boolean(errors.departure)}>
              <input
                id="departure"
                type="datetime-local"
                value={draft.departureLocal}
                min={toLocalInputValue(now)}
                max={toLocalInputValue(new Date(now.getTime() + MAX_DEPARTURE_DAYS * 86_400_000))}
                onChange={(event) => updateDraft({ departureLocal: event.target.value })}
                disabled={loading}
                aria-invalid={Boolean(errors.departure)}
                aria-describedby={errors.departure ? 'departure-error' : 'departure-hint'}
                className="num min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none"
              />
            </div>
            {errors.departure ? (
              <FieldError id="departure-error" message={errors.departure} />
            ) : (
              <p id="departure-hint" className="mt-1.5 text-xs text-ink-3">
                Local time{zone ? ` (${zone})` : ''}, within the next {MAX_DEPARTURE_DAYS} days.
              </p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="kicker mr-0.5">Later</span>
              {DEPARTURE_SHIFTS.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => shiftDeparture(hours)}
                  disabled={loading}
                  aria-label={`Move departure ${hours} ${hours === 1 ? 'hour' : 'hours'} later`}
                  className="num h-7 rounded-md border border-line-strong px-2 text-xs font-medium whitespace-nowrap text-ink hover:bg-paper disabled:opacity-40"
                >
                  +{hours} h
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="load" className="field-label">
                Load weight
              </label>
              <span className="num text-[11px] text-ink-3">pounds</span>
            </div>
            <div className="field" data-invalid={Boolean(errors.load)}>
              <input
                id="load"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 38,000"
                value={draft.loadText}
                onChange={(event) => updateDraft({ loadText: event.target.value })}
                disabled={loading}
                aria-invalid={Boolean(errors.load)}
                aria-describedby={errors.load ? 'load-error' : 'load-hint'}
                className="num min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-3"
              />
              <span className="num text-sm text-ink-3" aria-hidden="true">
                lb
              </span>
            </div>
            {errors.load ? (
              <FieldError id="load-error" message={errors.load} />
            ) : (
              <p id="load-hint" className="mt-1.5 text-xs text-ink-3">
                Wind limits tighten above 30,000 lb and 40,000 lb.
              </p>
            )}
            <LoadBands load={parseLoad(draft.loadText)} />
          </div>
        </div>
      </Section>

      <Section number={3} title="How often to check">
        <fieldset>
          <legend className="field-label mb-1.5">Checkpoint interval</legend>
          <div className="grid grid-cols-3 gap-2">
            {INTERVALS.map((interval) => (
              <IntervalOption
                key={interval}
                interval={interval}
                checked={draft.interval === interval}
                disabled={loading}
                onSelect={() => updateDraft({ interval })}
              />
            ))}
          </div>
          {errors.interval ? (
            <FieldError id="interval-error" message={errors.interval} />
          ) : (
            <p className="mt-1.5 text-xs text-ink-3">
              Weather is checked every {draft.interval} miles, for the hour the truck reaches each
              checkpoint.
            </p>
          )}
        </fieldset>
      </Section>

      <div className="border-t border-line pt-5">
        {result && !loading && (
          <p className="mb-3 text-sm text-ink-2">
            {inputsChanged ? (
              <>Inputs changed — plan again to update the results.</>
            ) : (
              <>
                These inputs match the current results.{' '}
                <Link
                  to="/routes"
                  className="font-semibold text-accent-ink underline underline-offset-2"
                >
                  View routes
                </Link>
              </>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !bothPlaces}
          className={buttonClass('primary', 'lg', 'w-full')}
        >
          {loading ? (
            <>
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> Planning…
            </>
          ) : (
            <>
              Plan routes <ArrowRight className="size-5" aria-hidden="true" />
            </>
          )}
        </button>
        <p className="mt-2 min-h-5 text-sm" aria-live="polite">
          {!bothPlaces && !loading ? (
            <span className="text-ink-3">Select both locations to continue.</span>
          ) : errorCount > 0 ? (
            <span className="font-medium text-danger">
              {errorCount === 1
                ? '1 field needs attention before planning.'
                : `${errorCount} fields need attention before planning.`}
            </span>
          ) : null}
        </p>
      </div>
    </form>
  )
}

function Section({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <div className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink" aria-hidden="true">
        <span className="num flex size-5 items-center justify-center rounded-[4px] bg-accent text-[11px] text-white">
          {number}
        </span>
        {title}
      </p>
      {children}
    </div>
  )
}

// Display of the assessment's load rules (docs/REQUIREMENTS.md §3); the backend applies them.
const LOAD_BANDS = [
  { label: '≤ 30,000', note: 'Standard wind limits', test: (lb: number) => lb <= 30_000 },
  {
    label: '30,001–40,000',
    note: 'Wind 45–54 mph becomes No Travel',
    test: (lb: number) => lb > 30_000 && lb <= 40_000,
  },
  {
    label: '> 40,000',
    note: 'Also: wind 35–44 mph becomes Severe',
    test: (lb: number) => lb > 40_000,
  },
]

function LoadBands({ load }: { load: number | null }) {
  const active = load === null ? -1 : LOAD_BANDS.findIndex((band) => band.test(load))
  return (
    <div className="mt-2" aria-hidden="true">
      <div className="grid grid-cols-3 gap-0.5">
        {LOAD_BANDS.map((band, index) => (
          <span
            key={band.label}
            className={`h-1.5 first:rounded-l-full last:rounded-r-full ${
              index === active ? 'bg-accent' : 'bg-paper-2'
            }`}
          />
        ))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-0.5">
        {LOAD_BANDS.map((band, index) => (
          <span
            key={band.label}
            className={`num text-[10px] leading-tight ${index === active ? 'font-semibold text-ink' : 'text-ink-3'}`}
          >
            {band.label}
          </span>
        ))}
      </div>
      {active >= 0 && <p className="mt-1 text-xs text-ink-2">{LOAD_BANDS[active]?.note}</p>}
    </div>
  )
}

interface IntervalOptionProps {
  interval: CheckpointInterval
  checked: boolean
  disabled: boolean
  onSelect: () => void
}

// Tick count across a 100-mile ruler, to show how dense the sampling is.
const TICKS: Record<CheckpointInterval, number> = { 10: 11, 25: 5, 50: 3 }

function IntervalOption({ interval, checked, disabled, onSelect }: IntervalOptionProps) {
  const id = `interval-${interval}`
  return (
    <div>
      <input
        id={id}
        type="radio"
        name="checkpoint-interval"
        value={interval}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className="flex h-16 cursor-pointer flex-col justify-between rounded-md border border-line-strong bg-surface px-3 pt-2 pb-2.5 text-ink-2 transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal peer-disabled:cursor-not-allowed hover:border-accent"
      >
        <span className="num text-sm font-semibold">{interval} mi</span>
        <span aria-hidden="true" className="flex items-end justify-between">
          {Array.from({ length: TICKS[interval] }, (_, index) => (
            <span key={index} className="h-2 w-px bg-current opacity-70" />
          ))}
        </span>
      </label>
    </div>
  )
}
