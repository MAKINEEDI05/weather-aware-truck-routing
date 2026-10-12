const number = (digits: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function formatNumber(value: number, digits = 1): string {
  return number(digits).format(value)
}

export function formatMiles(value: number, digits = 1): string {
  return `${formatNumber(value, digits)} mi`
}

export function formatLoad(pounds: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(pounds)} lb`
}

export function formatAverage(value: number | null): string {
  return value === null ? '—' : value.toFixed(2)
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes} min`
  }
  return `${hours} h ${String(minutes).padStart(2, '0')} m`
}

export function formatValue(value: number | null, digits: number): string {
  return value === null ? '—' : value.toFixed(digits)
}

type Parts = Record<string, string>

function parts(iso: string, options: Intl.DateTimeFormatOptions): Parts {
  const formatter = new Intl.DateTimeFormat('en-US', { ...options, hourCycle: 'h23' })
  const result: Parts = {}
  for (const part of formatter.formatToParts(new Date(iso))) {
    result[part.type] = part.value
  }
  return result
}

/** "Tue 14 Oct, 08:00 CDT" in the browser's time zone. */
export function formatDateTime(iso: string): string {
  const p = parts(iso, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute} ${p.timeZoneName}`
}

/** "Tue 18:46" in the browser's time zone. */
export function formatDayTime(iso: string): string {
  const p = parts(iso, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return `${p.weekday} ${p.hour}:${p.minute}`
}

/** "Tue 18:46 CDT" — compact, for figures and cards. */
export function formatDayTimeZone(iso: string): string {
  const p = parts(iso, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return `${p.weekday} ${p.hour}:${p.minute} ${p.timeZoneName}`
}

/** "18:46". */
export function formatClock(iso: string): string {
  const p = parts(iso, { hour: '2-digit', minute: '2-digit' })
  return `${p.hour}:${p.minute}`
}

/** Short zone name of the browser for a given instant, e.g. "CDT". */
export function timeZoneName(iso: string = new Date().toISOString()): string {
  return parts(iso, { timeZoneName: 'short' }).timeZoneName ?? ''
}

export function formatCoordinate(lat: number, lon: number, digits = 3): string {
  return `${lat.toFixed(digits)}, ${lon.toFixed(digits)}`
}

export function formatLatLonCardinal(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`
}

/** Checkpoint milepost: "725" for whole miles, "12.5" otherwise. */
export function formatMilepost(mile: number): string {
  return formatValue(mile, mile % 1 === 0 ? 0 : 1)
}
