import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { CircleAlert, CircleX, LoaderCircle } from 'lucide-react'
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

/** The map marker shape for each end of the trip: a ring for the origin, a square for the end. */
export function EndpointGlyph({ tone }: { tone: 'origin' | 'destination' }) {
  return tone === 'origin' ? (
    <span aria-hidden="true" className="size-3 shrink-0 rounded-full border-[3px] border-ink" />
  ) : (
    <span aria-hidden="true" className="size-3 shrink-0 rounded-[2px] bg-ink" />
  )
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

  if (value) {
    return (
      <div>
        <p className="field-label mb-1.5" id={`${id}-label`}>
          {label}
        </p>
        <div
          className="flex min-h-11 items-center gap-3 rounded-md border border-accent/60 bg-accent-soft/50 py-2 pr-1.5 pl-3"
          aria-labelledby={`${id}-label`}
          role="group"
        >
          <EndpointGlyph tone={tone} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] leading-snug font-semibold text-ink">
              {value.label}
            </p>
            <p className="num truncate text-xs text-ink-3">
              {value.detail ? `${value.detail} · ` : ''}
              {formatCoordinate(value.lat, value.lon)}
            </p>
          </div>
          <button
            type="button"
            onClick={change}
            disabled={disabled}
            className={buttonClass('ghost', 'sm', '!text-accent-ink underline underline-offset-2')}
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
      <label htmlFor={inputId} className="field-label mb-1.5 block">
        {label}
      </label>
      <div className="field pr-1" data-invalid={Boolean(error) || state.kind === 'error'}>
        <EndpointGlyph tone={tone} />
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
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={() => void find()}
          disabled={disabled || state.kind === 'loading'}
          aria-label={`Find ${label.toLowerCase()}`}
          className={buttonClass('primary', 'sm')}
        >
          {state.kind === 'loading' ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Find
        </button>
      </div>

      {state.kind === 'loading' && (
        <p className="mt-2 text-sm text-ink-2" role="status">
          Searching…
        </p>
      )}
      {state.kind === 'error' && (
        <p
          id={messageId}
          className="mt-2 flex items-start gap-1.5 text-sm text-danger"
          role="alert"
        >
          <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}
      {state.kind === 'results' && (
        <div className="mt-2 overflow-hidden rounded-md border border-line-strong bg-surface">
          <p
            id={messageId}
            className="flex items-start gap-1.5 border-b border-line bg-caution-soft px-3 py-2 text-[13px] font-medium text-caution"
            role="status"
          >
            <CircleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
            {results.length === 1
              ? '1 place matches. Select it to continue.'
              : `${results.length} places match. Select one to continue.`}
          </p>
          <ul
            ref={listRef}
            aria-label={`Matching places for ${label.toLowerCase()}`}
            onKeyDown={onListKeyDown}
            className="divide-y divide-line"
          >
            {visible.map((place) => (
              <li key={`${place.label}-${place.lat}-${place.lon}`}>
                <button
                  type="button"
                  onClick={() => select(place)}
                  className="flex w-full items-baseline gap-3 px-3 py-2.5 text-left hover:bg-paper focus-visible:bg-paper focus-visible:outline-offset-[-2px]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{place.label}</span>
                    {place.detail && (
                      <span className="block text-xs text-ink-3">{place.detail}</span>
                    )}
                  </span>
                  <span className="num shrink-0 text-[11px] text-ink-3">
                    {formatCoordinate(place.lat, place.lon, 2)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!showAll && results.length > VISIBLE_RESULTS && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full border-t border-line px-3 py-2 text-left text-[13px] font-semibold text-accent-ink underline underline-offset-2 hover:bg-paper"
            >
              Show {results.length - VISIBLE_RESULTS} more
            </button>
          )}
        </div>
      )}
      {error && <FieldError id={errorId} message={error} />}
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger">
      <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}
