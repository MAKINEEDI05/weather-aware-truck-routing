# Design system

The visual direction comes from the reference images in `design/`, which are kept out of Git.
They define layout, spacing, typography, colour and hierarchy, but **not data**: every number in
the app comes from the API (DEC-41). Tokens are defined once in `frontend/src/index.css`
(Tailwind 4 `@theme`, plus `.card`, `.overlay` and `.eyebrow` component classes) and in `frontend/src/lib/{risk,routes}.ts` for map colours.

## 1. Principles

- A calm, professional logistics tool: white surfaces on a cool grey canvas, one blue accent, and a
  dark navy navigation rail.
- Colour carries meaning (risk, route identity). Every colour has a text label next to it.
- No gradients, glows, decorative charts or gratuitous animation. Motion is limited to
  hover/focus transitions and a spinner, and is disabled under `prefers-reduced-motion`.
- Numbers are tabular (`font-variant-numeric: tabular-nums`) and units are always shown.

## 2. Colour tokens

| Token | Value | Use |
|---|---|---|
| `canvas` | `#f4f6fa` | Page background |
| `surface` | `#ffffff` | Cards, panels, top bar |
| `border` | `#e2e8f0` | Card and table borders |
| `ink` | `#0f172a` | Primary text |
| `ink-muted` | `#475569` | Secondary text |
| `ink-subtle` | `#64748b` | Captions, overlines |
| `navy-950` | `#0b1730` | Sidebar and mobile header |
| `navy-800` | `#1a2b52` | Active nav item |
| `navy-300` | `#a9b6d3` | Inactive nav text |
| `brand` | `#2563eb` | Primary buttons, links, focus ring, selected states |
| `brand-strong` | `#1d4ed8` | Primary hover |

**Risk levels** (`lib/risk.ts`) — always paired with the text label:

| Level | Colour | Tint (badge background) | Text on tint |
|---|---|---|---|
| Low | `#16a34a` | `#ecfdf3` | `#15803d` |
| Moderate | `#eab308` | `#fefce8` | `#a16207` |
| High | `#f97316` | `#fff7ed` | `#c2410c` |
| Severe | `#dc2626` | `#fef2f2` | `#b91c1c` |
| No Travel | `#c026d3` | `#fdf4ff` | `#a21caf` |
| Unknown | `#94a3b8` (hollow on the map) | `#f8fafc` | `#475569` |

**Routes** (DEC-30): A `#2563eb` · B `#334155` · C `#0891b2`. Route colours never reuse a risk colour.

**Status surfaces:** success (green tint) for Recommended, warning (amber tint) for degraded
weather, danger (red tint) for errors, No Travel (fuchsia tint) for blocked/ineligible, info (blue
tint) for neutral notes.

## 3. Typography

Inter Variable (self-hosted, DEC-46); fallback `ui-sans-serif, system-ui`.

| Role | Size / line height | Weight | Notes |
|---|---|---|---|
| Landing display | 48–60 / 1.05 | 800 | `tracking-tight`; 36 on mobile |
| Page title (top bar) | 20 / 28 | 600 | |
| Section title | 16 / 24 | 600 | |
| Body | 14 / 20 | 400 | Landing body 18 / 30 |
| Small / caption | 12–13 / 16–18 | 400–500 | |
| Overline | 11–12 / 16 | 600 | Uppercase, `tracking-wider`, `ink-subtle` |
| Big figures | 24–28 / 32 | 600 | Stat cards |

## 4. Spacing, radius, elevation

- 4-px base scale. Card padding 20–24 px (desktop) / 16 px (mobile). Page gutter 24 px (desktop) /
  16 px (mobile).
- Radius: cards and panels 12 px · inputs and buttons 10 px · badges and chips fully rounded.
- Elevation: cards `0 1px 2px rgb(15 23 42 / 0.06)` with a 1-px border. Map overlays (panels,
  legend, popups) `0 4px 16px rgb(15 23 42 / 0.10)`.

## 5. Layout

| Breakpoint | Shell |
|---|---|
| ≥ 1024 px (`lg`) | Fixed 264-px navy sidebar (brand, "Workspace" nav, provider credits, API status) + 64-px white top bar (page title, trip summary chips, "Edit trip") + content |
| < 1024 px | Navy top header (brand mark, page title, API status) + content + fixed bottom tab bar (Plan, Routes, Heatmap, About) |

Landing page: its own top navigation (How it works, Risk rules, About, "Plan your trip"), no sidebar.

Map pages (`/routes`, `/heatmap`) fill the viewport height on desktop with floating overlay panels.
On mobile, the map is 45–55 vh with the content stacked below it.

## 6. Components

| Component | Spec |
|---|---|
| `buttonClass()` (`lib/ui.ts`) | Variants: primary (brand fill), secondary (white, border), ghost, danger. Sizes sm (32 px), md (40 px), lg (48 px). Visible 2-px focus ring in brand colour. Disabled = 50% opacity. |
| `RiskBadge` | Pill with a 8-px dot in the risk colour plus the label, on the tint background. |
| `RiskMilesBar` | Stacked horizontal bar of miles per level (Low → No Travel, then Unknown hatched grey), with numeric labels nearby. |
| `RouteCard` | Rank chip `#n`, route colour swatch, label, Recommended / Not recommended badge, distance · time · arrival, miles bar, Severe / High / Avg risk figures, No Travel warning line. Selected = 2-px brand border. |
| Stat card | Overline label, big figure, caption. |
| `CheckpointTable` | Sticky header; columns Mile, ETA, Wind mph, Rain in/hr, Snow in/hr, Risk; numeric right-aligned; selected row tinted blue; level filter select. |
| `ForecastSlider` | Overline "Corridor forecast", clock time + "departure + k h" (brand colour), native range input, prev/next buttons, ticks every 12 h. |
| `MapLegend` | White overlay card: checkpoint risk levels, origin/destination, route swatches. |
| `StateView` / `NoTripState` / `PlanErrorState` / `LoadingState` | Centered icon in a tinted tile, title, sentence, actions; one error view per API error code. The loading state shows time-based text and skeleton cards. |
| `WarningsBanner` | Tinted banner with icon, bold lead-in and a sentence per warning. |
| Trip summary chips | Rounded pills: route `A → B`, departure, load, interval. |
| `LocationSearch` | Input with search icon + "Find" button → candidate list (label + detail) → selected chip with coordinates and "Change". |
| Segmented control | 10 / 25 / 50 mi; radio-group semantics. |

## 7. Accessibility

- Text contrast ≥ 4.5:1 for body text. Risk colours are never the only signal.
- All interactive elements are reachable by keyboard with a visible focus ring. Tabs and the
  segmented control use radio/tab semantics with arrow-key support where native.
- Status changes are announced via `role="status"` / `aria-live="polite"`. Errors use
  `role="alert"` and `aria-describedby` on fields.
- `CheckpointTable` is the non-map equivalent of the checkpoint markers.

## 8. Replaceable assets (DEC-40)

| Slot | File / constant | Expected asset | Fallback |
|---|---|---|---|
| Brand logo mark | `frontend/src/assets/brand.ts` → `BRAND_LOGO_SRC` (set to e.g. `/brand/logo-mark.svg`) | Square SVG, 64 × 64 viewBox, works on navy and white | Blue rounded square with a generic `lucide` route icon |
| Product name | `BRAND_NAME` | Text | "Weather-Aware Truck Routing" |
| Landing hero illustration | `HERO_ILLUSTRATION_SRC` (e.g. `/brand/hero.webp`) | 1760 × 1240 px WebP/PNG, ≤ 300 KB, light background | Restrained schematic panel (route line with risk-coloured checkpoints, no data) |
| Favicon | `frontend/public/favicon.svg` | 32 × 32 SVG | Current generic route glyph |

Each slot has a `TODO(asset)` comment. A missing or failing image falls back silently (`onError`).

## 9. Reference image mapping

| Reference | Implemented as | Differences (and why) |
|---|---|---|
| `01-landing-page.png` | `pages/LandingPage.tsx` | Hero illustration is a placeholder slot (DEC-40); no sample route card or numbers (DEC-41); "up to three routes" copy (C-5) |
| `02-trip-planner.png` | `pages/PlanPage.tsx` + `features/trip-form/*` | Map preview shows the real OSM map with the picked points |
| `03-route-comparison-map.png` | `pages/RoutesPage.tsx` | No road names (DEC-39); route count is the real count |
| `04-route-details.png` | `pages/RouteDetailsPage.tsx` | "Showing: Kansas – Colorado" region chip omitted (no region data) |
| `05-weather-heatmap.png` | `pages/HeatmapPage.tsx` | Cell info card is docked in the panel/map corner rather than pointing at the cell |
| `06-route-recommendation.png` | `pages/RecommendationPage.tsx` | "Why not" text is generated from the API comparisons |
| `07-about.png` | `pages/AboutPage.tsx` | Real versions (React 19, Django 5.2) (C-3) |
| `08-error-and-empty-states.png` | `components/{StateViews,PlanStates,WarningsBanner}.tsx`, form errors in `features/trip-form/*`, blocked/degraded cards in `pages/RecommendationPage.tsx` | Shown where they occur, not as a gallery page |
| `09a-mobile-trip-form.png`, `09b-mobile-route-map.png` | Responsive `AppLayout`, `PlanPage`, `RoutesPage` | Route cards scroll horizontally on mobile |

The "Sample data · UI mockup" badge in every reference is not reproduced (DEC-41).
