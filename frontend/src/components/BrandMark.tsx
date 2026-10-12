import { useState } from 'react'
import { BRAND_LOGO_SRC } from '../assets/brand'

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg'
  /** Draw for a light background (ink tile) or a dark one (tile with a hairline edge). */
  tone?: 'dark' | 'light'
}

const SIZES = { sm: 'size-7', md: 'size-9', lg: 'size-12' }

/**
 * Logo mark slot. Until the client's logo is supplied (BRAND_LOGO_SRC), or if it fails to load, a
 * typographic placeholder is drawn: the letter W traced as a route through three checkpoints coloured
 * Low, Moderate and High. It is a stand-in, not a proposed logo.
 */
export function BrandMark({ size = 'md', tone = 'dark' }: BrandMarkProps) {
  const [failed, setFailed] = useState(false)
  const box = SIZES[size]

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
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={`${box} shrink-0`}
      data-testid="brand-fallback"
    >
      <defs>
        <linearGradient id="brand-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5146e5" />
          <stop offset="1" stopColor="#1c74d4" />
        </linearGradient>
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="6.5"
        fill="url(#brand-tile)"
        stroke={tone === 'light' ? '#3f34c9' : '#ffffff33'}
      />
      <path
        d="M6.5 9.5 11 22.5 16 13 21 22.5 25.5 9.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="22.5" r="2.5" fill="#3f9f62" stroke="#ffffff" strokeWidth="1.6" />
      <circle cx="16" cy="13" r="2.5" fill="#e2b024" stroke="#ffffff" strokeWidth="1.6" />
      <circle cx="21" cy="22.5" r="2.5" fill="#ea7a2e" stroke="#ffffff" strokeWidth="1.6" />
    </svg>
  )
}
