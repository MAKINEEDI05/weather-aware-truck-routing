import { useState } from 'react'
import { Route } from 'lucide-react'
import { BRAND_LOGO_SRC } from '../assets/brand'

interface BrandMarkProps {
  size?: 'sm' | 'md'
}

/**
 * Logo mark slot. Until the client's logo is supplied (BRAND_LOGO_SRC), or if it fails to load,
 * a neutral blue tile with a generic route icon is shown — not a custom logo.
 */
export function BrandMark({ size = 'md' }: BrandMarkProps) {
  const [failed, setFailed] = useState(false)
  const box = size === 'sm' ? 'size-8 rounded-lg' : 'size-10 rounded-xl'

  if (BRAND_LOGO_SRC && !failed) {
    return (
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className={`${box} shrink-0 object-contain`}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center bg-brand text-white`}
      data-testid="brand-fallback"
    >
      <Route className={size === 'sm' ? 'size-4' : 'size-5'} strokeWidth={2.25} />
    </span>
  )
}
