import { useSyncExternalStore } from 'react'

/** Live result of a CSS media query (false where matchMedia is unavailable, e.g. jsdom). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  )
}

/** Matches the `lg` breakpoint where map pages show floating side panels. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
