import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ArrowUpDown, CalendarDays, Info, LoaderCircle } from 'lucide-react'
import type { CheckpointInterval } from '../../api/types'
import { timeZoneName } from '../../lib/format'
import { buttonClass } from '../../lib/ui'
import { useTrip } from '../../state/TripContext'
import { FieldError, LocationSearch } from './LocationSearch'
import {
  FIELD_ORDER,
  INTERVALS,
  MAX_DEPARTURE_DAYS,
  draftMatchesResult,
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

  const now = new Date()
  const zone = timeZoneName()
  const inputsChanged = result !== null && !draftMatchesResult(draft, result)

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Trip details" className="flex flex-col gap-5">
      <LocationSearch
        id="origin"
        label="Origin"
        value={draft.origin}
        onChange={(origin) => updateDraft({ origin })}
        error={errors.origin}
        disabled={loading}
      />

      <div className="-my-2 flex justify-center">
        <button
          type="button"
          onClick={() => updateDraft({ origin: draft.destination, destination: draft.origin })}
          disabled={loading || (!draft.origin && !draft.destination)}
          aria-label="Swap origin and destination"
          className="flex size-9 items-center justify-center rounded-full border border-line bg-white text-ink-muted hover:bg-slate-50 disabled:opacity-40"
        >
          <ArrowUpDown className="size-4" aria-hidden="true" />
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

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="departure" className="text-sm font-semibold text-ink">
            Departure date &amp; time
          </label>
          <span className="text-xs text-ink-subtle">Local time{zone ? ` (${zone})` : ''}</span>
        </div>
        <div
          className={`flex items-center gap-2 rounded-[10px] border bg-white px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
            errors.departure ? 'border-red-400' : 'border-slate-300'
          }`}
        >
          <CalendarDays className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
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
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none"
          />
        </div>
        {errors.departure ? (
          <FieldError id="departure-error" message={errors.departure} />
        ) : (
          <p id="departure-hint" className="mt-1.5 text-xs text-ink-subtle">
            Within the next {MAX_DEPARTURE_DAYS} days.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="load" className="text-sm font-semibold text-ink">
            Load weight
          </label>
          <span className="text-xs text-ink-subtle">pounds</span>
        </div>
        <div
          className={`flex items-center gap-2 rounded-[10px] border bg-white px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
            errors.load ? 'border-red-400' : 'border-slate-300'
          }`}
        >
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
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink tabular-nums outline-none placeholder:text-ink-subtle"
          />
          <span className="text-sm text-ink-subtle" aria-hidden="true">
            lb
          </span>
        </div>
        {errors.load ? (
          <FieldError id="load-error" message={errors.load} />
        ) : (
          <p id="load-hint" className="mt-1.5 text-xs text-ink-subtle">
            Wind rules tighten above 30,000 lb and 40,000 lb.
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-ink">Checkpoint interval</legend>
        <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-slate-100 p-1">
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
        {errors.interval && <FieldError id="interval-error" message={errors.interval} />}
      </fieldset>

      <p className="flex gap-2 rounded-xl border border-blue-200 bg-brand-soft p-3 text-sm text-blue-900 lg:hidden">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Weather is checked at each checkpoint for the hour the truck is expected to arrive.
      </p>

      <div className="pt-2">
        {result && !loading && (
          <p className="mb-3 text-center text-sm text-ink-muted">
            {inputsChanged ? (
              <>Inputs changed — plan again to update the results.</>
            ) : (
              <>
                These inputs match the current results.{' '}
                <Link to="/routes" className="font-semibold text-brand hover:underline">
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
        <p className="mt-2 min-h-5 text-center text-sm" aria-live="polite">
          {!bothPlaces && !loading ? (
            <span className="text-ink-subtle">Select both locations to continue.</span>
          ) : errorCount > 0 ? (
            <span className="text-red-700">
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

interface IntervalOptionProps {
  interval: CheckpointInterval
  checked: boolean
  disabled: boolean
  onSelect: () => void
}

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
        className="flex h-10 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-ink-muted transition-colors peer-checked:bg-white peer-checked:text-brand peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-disabled:cursor-not-allowed"
      >
        {interval} mi
      </label>
    </div>
  )
}
