import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { CircleAlert, CircleX, LoaderCircle, MapPin, Search } from 'lucide-react'
import { ApiError, geocode } from '../../api/client'
import type { GeocodeResult } from '../../api/types'
import { formatCoordinate } from '../../lib/format'
import { buttonClass } from '../../lib/ui'

const VISIBLE_RESULTS = 3

interface LocationSearchProps {
  id: string
  label: string
  value: GeocodeResult | null
  onChange: (place: GeocodeResult | null) => void
  /** Validation message from the form. */
  error?: string
  tone?: 'origin' | 'destination'
  disabled?: boolean
}

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; results: GeocodeResult[] }
  | { kind: 'error'; message: string }

function describeError(error: unknown, query: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'LOCATION_NOT_FOUND') {
      return `No US location found for "${query}". Check the spelling or try a nearby city.`
    }
    if (error.code === 'ROUTING_NOT_CONFIGURED') {
      return 'Location search is unavailable: the server has no TomTom API key configured.'
    }
    if (error.code === 'TOO_MANY_REQUESTS' || error.code === 'RATE_LIMITED') {
      return 'Too many searches right now. Wait a moment and try again.'
    }
    return error.message
  }
  return 'Location search failed. Try again.'
}

/**
 * Geocode on Enter or "Find" (TomTom's geocoder is not meant for per-keystroke input), then the
 * user must pick one candidate (DEC-4).
 */
export function LocationSearch({
  id,
  label,
  value,
  onChange,
  error,
  tone = 'origin',
  disabled = false,
}: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  const [showAll, setShowAll] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const controller = useRef<AbortController | null>(null)
  const focusInput = useRef(false)

  useEffect(() => () => controller.current?.abort(), [])

  useEffect(() => {
    if (!value && focusInput.current) {
      focusInput.current = false
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [value])

  const inputId = `${id}-input`
  const messageId = `${id}-message`
  const errorId = `${id}-error`

  async function find() {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setState({ kind: 'error', message: 'Type at least 2 characters, then select Find.' })
      return
    }
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setState({ kind: 'loading' })
    setShowAll(false)
    try {
      const results = await geocode(trimmed, current.signal)
      setState(
        results.length
          ? { kind: 'results', results }
          : {
              kind: 'error',
              message: describeError(new ApiError('', 404, 'LOCATION_NOT_FOUND'), trimmed),
            },
      )
    } catch (caught) {
      if (current.signal.aborted) return
      setState({ kind: 'error', message: describeError(caught, trimmed) })
    }
  }

  function select(place: GeocodeResult) {
    onChange(place)
    setState({ kind: 'idle' })
  }

  function change() {
    if (value) {
      setQuery(value.label)
    }
    focusInput.current = true
    onChange(null)
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void find()
    } else if (event.key === 'ArrowDown' && state.kind === 'results') {
      event.preventDefault()
      listRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowUp' && index <= 0) {
      inputRef.current?.focus()
      return
    }
    buttons[Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))]?.focus()
  }

  const pinClass = tone === 'destination' ? 'text-brand' : 'text-ink'

  if (value) {
    return (
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink" id={`${id}-label`}>
          {label}
        </p>
        <div
          className="flex items-center gap-3 rounded-[10px] border border-line bg-slate-50 px-3 py-2.5"
          aria-labelledby={`${id}-label`}
          role="group"
        >
          <MapPin className={`size-4 shrink-0 ${pinClass}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{value.label}</p>
            <p className="truncate text-xs text-ink-subtle tabular-nums">
              {value.detail ? `${value.detail} · ` : ''}
              {formatCoordinate(value.lat, value.lon)}
            </p>
          </div>
          <button
            type="button"
            onClick={change}
            disabled={disabled}
            className="rounded-md px-2 py-1 text-sm font-semibold text-brand hover:bg-brand-soft disabled:text-ink-subtle"
            aria-label={`Change ${label.toLowerCase()}`}
            id={inputId}
          >
            Change
          </button>
        </div>
        {error && <FieldError id={errorId} message={error} />}
      </div>
    )
  }

  const results = state.kind === 'results' ? state.results : []
  const visible = showAll ? results : results.slice(0, VISIBLE_RESULTS)
  const describedBy = [
    state.kind === 'error' || state.kind === 'results' ? messageId : '',
    error ? errorId : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <div
        className={`flex items-center gap-2 rounded-[10px] border bg-white py-1 pr-1 pl-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
          error || state.kind === 'error' ? 'border-red-400' : 'border-slate-300'
        }`}
      >
        <Search className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          placeholder="City, address or place"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          disabled={disabled}
          aria-invalid={Boolean(error) || state.kind === 'error'}
          aria-describedby={describedBy || undefined}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-ink-subtle"
        />
        <button
          type="button"
          onClick={() => void find()}
          disabled={disabled || state.kind === 'loading'}
          aria-label={`Find ${label.toLowerCase()}`}
          className={buttonClass('secondary', 'sm')}
        >
          {state.kind === 'loading' ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Find
        </button>
      </div>

      {state.kind === 'loading' && (
        <p className="mt-2 text-sm text-ink-muted" role="status">
          Searching…
        </p>
      )}
      {state.kind === 'error' && (
        <p
          id={messageId}
          className="mt-2 flex items-start gap-1.5 text-sm text-red-700"
          role="alert"
        >
          <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
      {state.kind === 'results' && (
        <>
          <p
            id={messageId}
            className="mt-2 flex items-start gap-1.5 text-sm text-amber-700"
            role="status"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {results.length === 1
              ? '1 place matches. Select it to continue.'
              : `${results.length} places match. Select one to continue.`}
          </p>
          <div className="mt-2 rounded-xl border border-line bg-white p-1.5 shadow-sm">
            <ul
              ref={listRef}
              aria-label={`Matching places for ${label.toLowerCase()}`}
              onKeyDown={onListKeyDown}
            >
              {visible.map((place) => (
                <li key={`${place.label}-${place.lat}-${place.lon}`}>
                  <button
                    type="button"
                    onClick={() => select(place)}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-brand-soft focus-visible:bg-brand-soft"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{place.label}</span>
                      {place.detail && (
                        <span className="block text-xs text-ink-subtle">{place.detail}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!showAll && results.length > VISIBLE_RESULTS && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="ml-10 py-1.5 text-sm font-semibold text-brand hover:underline"
              >
                Show {results.length - VISIBLE_RESULTS} more
              </button>
            )}
          </div>
        </>
      )}
      {error && <FieldError id={errorId} message={error} />}
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
      <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}
