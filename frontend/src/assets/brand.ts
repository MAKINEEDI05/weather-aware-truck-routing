// Replaceable brand asset slots (docs/DESIGN_SYSTEM.md §8, DEC-40).
// The client supplies the final brand assets. Until then, each slot is `null` and the UI renders
// a restrained, generic fallback — no invented logo or imagery.

export const BRAND_NAME = 'Weather-Aware Truck Routing'

/**
 * TODO(asset): brand logo mark.
 * Expected: square SVG, 64 × 64 viewBox, legible on navy (#0b1730) and on white.
 * Place it at `frontend/public/brand/logo-mark.svg` and set this to '/brand/logo-mark.svg'.
 */
export const BRAND_LOGO_SRC: string | null = null

/**
 * TODO(asset): landing page hero illustration.
 * Expected: 1760 × 1240 px WebP or PNG (≤ 300 KB), light background, no text baked in.
 * Place it at `frontend/public/brand/hero.webp` and set this to '/brand/hero.webp'.
 */
export const HERO_ILLUSTRATION_SRC: string | null = null

/** Alt text for the hero illustration once supplied. */
export const HERO_ILLUSTRATION_ALT = 'A truck on a highway under changing weather'
