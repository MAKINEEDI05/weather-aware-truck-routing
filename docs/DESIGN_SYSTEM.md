# Design system

The visual design on branch `experiment/independent-frontend` ("route sheet") was created
independently of the reference images in `design/`, which are kept out of Git (§9). It keeps the
application's behaviour, copy and accessible names unchanged. Every number in the app comes from
the API (DEC-41). Tokens are defined once in `frontend/src/index.css` (Tailwind 4 `@theme` plus a
few component classes); map and data colours live in `frontend/src/lib/{risk,routes}.ts`.

## 1. Principles

- **Two colour families that never overlap.** The warm risk ramp (green → yellow → orange → red →
  plum) is data. The cool night-sky family (indigo chrome, iris accent, azure) is the interface:
  actions, selection, focus and brand. No interface element uses a risk hue, so colour on the map
  always means weather.
- **Green means recommended.** The recommended-route bar and verdict use a deep green; nothing else
  in the interface is green.
- **Risk is shown where it occurs, not only how much.** Routes are drawn as strips of their
  checkpoints' levels, origin to destination (`RouteProfile`); mile totals come from the backend.
- **Maps first.** Map pages give the map the full height; panels are docked beside it, the map key is
  a slim bar along the bottom edge, and the basemap is a cool blue-grey so risk colours dominate.
- **Numbers are instruments.** Every measurement is set in a monospace face with tabular figures, and
  units are always shown.
- **Never colour alone.** Every colour has a text label; No Travel also carries barricade stripes and
  Unknown is a dashed outline or hatch.
- **Honest states.** Restored and outdated results are labelled (§6, DEC-56); loading text never
  claims real progress.

## 2. Colour tokens

### Interface (`frontend/src/index.css`)

| Token | Value | Use |
|---|---|---|
| `paper` / `paper-2` | `#f2f1ed` / `#e9e7e1` | Canvas; sunken wells, table headers |
| `surface` | `#ffffff` | Panels, cards, form fields |
| `line` / `line-strong` | `#dcd9d1` / `#bfbbb0` | Hairlines; field borders |
| `ink` / `ink-2` / `ink-3` | `#15171b` / `#454951` / `#62666e` | Text: primary / secondary / labels (≥ 5.1:1 on paper) |
| `asphalt` / `-2` / `-3` | `#14152b` / `#1d1f3a` / `#2e3156` | Night-indigo app bar and tab bar, landing hero |
| `fog` | `#aeb0c8` | Muted text on asphalt (8.4:1) |
| `accent` / `accent-strong` | `#5146e5` / `#3f34c9` | Iris: primary buttons, selection, focus ring, map selection |
| `accent-soft` / `accent-ink` | `#eeedff` / `#3b31b8` | Selected rows, chips; links and kickers |
| `accent-on-dark` | `#a9a4ff` | Active nav marker, focus on dark |
| `sky` | `#1c74d4` | Gradient partner of iris (brand tile, CTA band) |
| `danger`, `caution`, `closed`, `go` (+ `-soft`) | | System states: errors, warnings/outdated, No Travel notes, recommended |

Header bands use a pale dawn gradient (`.header-band`); the landing hero uses `.aurora` (night
indigo with soft iris/azure glows).

### Risk levels (`frontend/src/lib/risk.ts`)

| Level | Colour | Tag text on tint | Extra signal |
|---|---|---|---|
| Low | `#3f9f62` | `#1e6b3b` on `#e6f2e9` | — |
| Moderate | `#e2b024` | `#735400` on `#faf1d3` | — |
| High | `#ea7a2e` | `#953d08` on `#fce9db` | — |
| Severe | `#cd3529` | `#9b231a` on `#f9e0dd` | — |
| No Travel | `#4e1a55` | `#4e1a55` on `#eee3ef` | Barricade stripes; thicker white marker outline |
| Unknown | `#8b9099` | `#4b4f57` on `#efefec` | Dashed outline / hatch; hollow marker; never shown as Low |

From Moderate upwards each level is darker than the last, so severity still reads for colour-blind
users. All tag text pairs are ≥ 5.6:1. Heatmap cells use the level colour at 45 % opacity.

### Route identity (`frontend/src/lib/routes.ts`)

A `#1c74d4` (azure), B `#0f7685` (petrol), C `#23262b` (ink); D–F reserved. Identity is always
carried by the route **letter** too: shields on the map lines, in cards, tabs and the map key.

## 3. Typography

- **Overpass Variable** for text — an open-source descendant of Highway Gothic, the US road-sign
  lettering. **Overpass Mono Variable** for every number, kicker label and form-field label.
- U+00B7 (·) is rendered from a system sans (`Separator Dot` face) because Overpass's middle dot sits
  flush against the next word.
- Scale: landing display 40–68 px / 800; page title 26–32 px / 700; section 16–18 px / 700; body
  15 px; labels (`.kicker`, `.field-label`) 11–12 px mono, upper case, tracked 0.08–0.1 em.

## 4. Spacing, radius, elevation

- 4 px base grid; page gutters 16 px (mobile) and 32 px (desktop).
- Radius: 8 px panels (`.panel`), 6 px buttons/fields, 4–5 px tags and shields.
- Elevation: none on panels (hairline borders); `--shadow-float` only for things above the map
  (`.float`: popups, cell details, map key).
- Ruled stat grids use the gap-as-hairline technique (`gap-px` over a `line` background).

## 5. Layout

- **App bar (≥ 1024 px):** night-indigo bar with the brand, the numbered workflow (01 Plan trip,
  02 Routes, 03 Recommendation, 04 Weather heatmap), About, and the API status pill.
- **Tab bar (< 1024 px):** fixed bottom bar with Plan, Routes, Heatmap, About.
- **Page header:** document pages use a full header (kicker, h1, description, trip strip); map pages
  use one compact row (h1 + trip strip). The trip strip shows origin → destination, departure, load
  and interval, with **Edit trip** and **New trip**.
- **Map pages** (`/routes`, `/heatmap`) fill the viewport height: docked side panel (420 / 340 px)
  plus map; the heatmap's forecast timeline is docked under the map. Below 1024 px the map comes
  first (46–50 vh) and the panel follows.
- **Route details:** title block, route tabs, figures, interactive risk strip, then map beside the
  checkpoint inspector and table.

## 6. Components

| Component | Notes |
|---|---|
| `PageHeader`, `TripStrip` | h1 and document title; Edit trip / New trip; renders `ResultNotice` on results pages |
| `ResultNotice` | Amber "Outdated results" when inputs changed since the plan; iris "Restored after reload" with the calculation time and "Forecasts were not refreshed" (DEC-56) |
| `RouteCard` | One button (select) + "Route details" link. Shield, rank, status, distance, arrival, risk strip, the four ranking criteria in order with the losing criterion filled in iris |
| `RouteProfile` | Checkpoints' overall levels over the miles they cover; optional axis, caret and click-to-select (pointer shortcut; the table is the keyboard path); accessible name lists backend mile totals |
| `RiskBadge`, `RiskDot` | Square chip + label; patterns for No Travel and Unknown |
| `DecisionTrace` | Four-gate tie-break ladder: tie → compare next, decided (iris; plum when a higher-ranked route is ineligible), not needed |
| `ComparisonTable` | Rank-ordered matrix; the cell where each route lost is filled; sticky route column |
| `CheckpointTable` | Filterable; each value shows its own factor's level chip; scrolls only itself to the selection |
| `CheckpointDetail` | ETA, factor values and levels, forecast hours, covered miles, reasons, load-rule note — in map popups and the details inspector |
| `ForecastSlider` | 0–48 h range with prev/next, a per-hour histogram of corridor cells by level (aligned to the thumb), and the selected route's driving window |
| `MapLegend` | Bottom bar: risk chips, endpoint shapes, route shields |
| Map layers | Route lines with white casing and lettered shields (keyboard: Enter/Space); checkpoint circles; origin = ring, destination = square terminal; corridor cells on their own canvas pane, picked by grid position |
| `StateView`, `LoadingState`, `PlanErrorState`, `WarningsBanner` | Left-aligned notices with a tone tile; elapsed-time loader with moving lane dashes |
| Buttons (`lib/ui.ts`) | `primary` (iris), `secondary`, `ghost`, `inverse` / `outline-dark` on dark |

## 7. Accessibility

- Text contrast ≥ 4.5:1 everywhere (checked numerically); risk colours are never the only signal.
- Visible focus ring (iris; light iris on dark) on every interactive element; skip link; the whole
  plan → compare → select flow works by keyboard, including map route shields.
- Status changes use `role="status"` / `aria-live="polite"`; errors use `role="alert"` and
  `aria-describedby` on fields. A planning failure scrolls into view.
- `CheckpointTable` is the non-map equivalent of the markers and the risk strip.
- Motion (loader dashes, transitions) is disabled under `prefers-reduced-motion`.
- No horizontal page scroll at 375, 834 or 1440 px (checked in Chrome on every page).

## 8. Replaceable assets (DEC-40)

| Slot | File / constant | Expected asset | Fallback |
|---|---|---|---|
| Brand logo mark | `frontend/src/assets/brand.ts` → `BRAND_LOGO_SRC` (e.g. `/brand/logo-mark.svg`) | Square SVG, 64 × 64 viewBox, legible on night indigo and on white | Iris-to-azure tile with the letter W traced as a route through three checkpoints (Low, Moderate, High) |
| Product name | `BRAND_NAME` | Text | "Weather-Aware Truck Routing" |
| Landing hero illustration | `HERO_ILLUSTRATION_SRC` (e.g. `/brand/hero.webp`) | 1760 × 1240 px WebP/PNG, ≤ 300 KB | Labelled "Illustration" route-board panel: three routes as risk strips, no numbers |
| Favicon | `frontend/public/favicon.svg` | 32 × 32 SVG | The same W mark |

Each slot has a `TODO(asset)` comment. A missing or failing image falls back silently (`onError`).

## 9. Relationship to the reference images

The original implementation on `master` followed the reference images in `design/`. This branch's
design was produced without opening them, as an independent proposal; it keeps every requirement,
API behaviour, accessible name and tested string of the original. Compare the two with a separate
checkout of `master` (for example `git worktree add ../wat-master master`). The "Sample data · UI mockup"
badge is not reproduced in either (DEC-41).
