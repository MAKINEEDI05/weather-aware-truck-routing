# Test plan

The test matrices extend blueprint §13. "Mocked" tests never touch the network. "Live" tests call
real providers and are opt-in.

## 1. Commands

```bash
# backend/ (venv active)
pytest -m "not live"                                  # all mocked tests
pytest -m live                                        # real providers (TomTom tests skip without a key)
pytest -m "not live" --cov=trips --cov-report=term-missing
ruff check . && ruff format --check .
DJANGO_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(50))')" \
  DJANGO_ALLOWED_HOSTS=api.example.com DJANGO_BEHIND_TLS_PROXY=true \
  DJANGO_SECURE_SSL_REDIRECT=true DJANGO_SECURE_HSTS_SECONDS=31536000 \
  python manage.py check --deploy

# frontend/
npm test -- --run
npm run lint && npm run format:check
npm run build                                         # includes tsc -b type check
```

## 2. Backend unit tests (pure domain, no network)

### 2.1 Risk boundaries — `tests/unit/test_risk.py`

Other components are LOW unless stated.

- **Wind (load 20,000):** 0 → LOW · 24.99 → LOW · 25 → MODERATE · 34 → MODERATE · 34.99 → MODERATE
  · 35 → HIGH · 44.99 → HIGH · 45 → SEVERE · 54.99 → SEVERE · 55 → NO_TRAVEL · 80 → NO_TRAVEL
- **Load rules (wind mph, load lb → level):** 35/40,000 HIGH · 35/40,000.01 SEVERE · 44.99/40,001
  SEVERE · 34.99/50,000 MODERATE · 40/35,000 HIGH · 45/30,000 SEVERE · 45/30,001 NO_TRAVEL ·
  54.99/30,001 NO_TRAVEL · 45/45,000 NO_TRAVEL · 55/0 NO_TRAVEL · 24.99/100,000 LOW. Also checked:
  `load_adjusted` is true exactly when a load rule changed the level.
- **Rain:** 0 LOW · 0.0999 LOW · 0.10 MODERATE · 0.2499 MODERATE · 0.25 HIGH · 0.4999 HIGH ·
  0.50 SEVERE · 1.00 SEVERE · 1.0001 NO_TRAVEL
- **Snow:** 0.49 LOW · 0.5 MODERATE · 0.99 MODERATE · 1.0 HIGH · 1.99 HIGH · 2.0 SEVERE ·
  3.0 SEVERE · 3.01 NO_TRAVEL
- **Combination and missing:** HIGH + SEVERE + LOW → SEVERE · snow NO_TRAVEL → NO_TRAVEL · wind
  missing → UNKNOWN · wind missing + rain 1.5 → NO_TRAVEL · all missing → UNKNOWN · rain −0.1 →
  missing · NaN / inf / string / bool → missing · reasons mention each component and the load rule.

### 2.2 Route profile and ETA — `tests/unit/test_profile.py`

Linear profile → half distance at half time · non-linear profile → piecewise · sparse progress →
interpolated by haversine fraction · first element missing → (0, 0) assumed · last point missing →
`ProviderBadResponse` · decreasing distance or time → error · `locate` at 0 and D → the endpoints ·
zero-length segments handled.

### 2.3 Checkpoints — `tests/unit/test_checkpoints.py`

| D, N | Expected |
|---|---|
| 100, 10 | 11 checkpoints; covered 5, 10 × 9, 5 |
| 103, 25 | miles 0, 25, 50, 75, 100, 103; Σ covered = 103 |
| 100.005, 50 | 0, 50, 100 (destination not duplicated) |
| 8, 10 | 0 and 8; covered 4 + 4 |
| random D ∈ (1, 3000], each N | Σ covered = D within 1e-9 (property test, 200 cases) |
| any | checkpoint lies on the polyline (< 1 m from its segment); ETAs non-decreasing; last ETA = departure + travel time ± 60 s |

### 2.4 Forecast lookup — `tests/unit/test_forecast.py`

| ETA | Rain/snow record | Wind record |
|---|---|---|
| 14:00:00 | 14:00 | 14:00 |
| 14:20 | 15:00 | 14:00 |
| 14:30 | 15:00 | 15:00 |
| 14:45 | 15:00 | 15:00 |
| 14:00:01 | 15:00 | 14:00 |
| missing hour | component `None` | component `None` |

Also: rain = rain + showers; either missing → rain missing (DEC-35); no series → `weather=None`.

### 2.5 Metrics — `tests/unit/test_metrics.py`

Miles per level sum to D · NO_TRAVEL not counted as Severe (K10) · average over known miles only ·
all unknown → `average_risk is None` · rounding to 2 dp.

### 2.6 Ranking, eligibility, status — `tests/unit/test_recommend.py`

Tuple = (Severe mi, High mi, avg risk, time s, No Travel mi).

| Case | Routes | Expected |
|---|---|---|
| K1 | A(10,0,0.5,100,0) B(0,50,1.0,200,0) | rank B,A; recommend B; `severe_miles` |
| K2 | A(0,40,0.3,100,0) B(0,10,0.9,300,0) | B; `high_miles` |
| K3 | A(0,0,0.40,100,0) B(0,0,0.20,200,0) | B; `average_risk` |
| K4 | A(0,0,0.2,300,0) B(0,0,0.2,200,0) | B; `travel_time` |
| K5 | identical | provider order; `provider_order` |
| K6 | A(0,5,0.3,180000,0) B(0,6,0.3,18000,0) | A (time never overrides risk) |
| K7 | High 10.004 vs 10.001 | tie at High → next criterion |
| K8 | A avg null, B avg 0.5, both 0 Severe/High | B above A |
| K9 | A(0,0,0.1,100,NT 5) B(0,20,1.0,200,0) | ranking A,B; A ineligible; recommend B |
| K10 | A has 30 NT mi, 0 Severe | `severe_mi` = 0 |
| K11 | every route has NT | `NO_ELIGIBLE_ROUTE`; `route_id` null; ranking unchanged |
| K12 | every checkpoint UNKNOWN | `NO_WEATHER_DATA` |
| K13 | B recommended, A has unknown miles | `RECOMMENDED` + `INCOMPLETE_WEATHER_DATA` |
| K14 | single route | `RECOMMENDED` if eligible |
| K15 | shuffled input | same ranking |
| K16 | K9 | explanation names A's No Travel miles and the deciding criterion against the others |
| K17 | 1-dp-equal miles that differ at 2 dp | explanation shows 2 decimals (DEC-49) |

### 2.7 Corridor — `tests/unit/test_corridor.py`

Cells include every 5-mi sample's cell plus 8 neighbours · centres at `(i + 0.5) × size` ·
> 200 cells → 0.5°, then 0.5° without buffer (DEC-57), then 1.0°, then 1.0° without buffer (regression for VF-11) · hour series length 49 · missing hour → −1 · cell risk uses the
user's load (45 mph: 30,000 → SEVERE, 30,001 → NO_TRAVEL).

## 3. Backend service tests (mocked HTTP) — `tests/services/`

| Test | Expected |
|---|---|
| `test_http`: timeout then success | one retry, success |
| `test_http`: 5xx twice | `ProviderUnavailable` |
| `test_http`: 429 with `Retry-After` | `ProviderRateLimited(retry_after=…)` |
| `test_http`: 403 with XML body | `ProviderAuthError`; message has no key |
| `test_http`: invalid JSON | `ProviderBadResponse` |
| `test_http`: log records | no `key=` value appears (`caplog`), including urllib3-style records |
| `test_tomtom`: synthetic 3-route fixture | 3 `ProviderRoute`s; points and progress parsed; ids in provider order |
| `test_tomtom`: 2 routes | 2 routes (no fabrication) |
| `test_tomtom`: 400 "not connected" | `NoRouteFound` |
| `test_tomtom`: missing key | `ProviderNotConfigured`, no HTTP call |
| `test_tomtom`: malformed route (no progress) | `ProviderBadResponse` |
| `test_tomtom`: departAt rule | future → `…Z`; < 2 min → `now` |
| `test_tomtom`: geocode | label/detail/lat/lon; duplicates removed; query URL-encoded |
| `test_open_meteo`: recorded fixture (3 locations) | 3 series; rain = rain + showers |
| `test_open_meteo`: single-location dict response | parsed |
| `test_open_meteo`: batching 250 locations / batch 100 | 3 requests; order preserved |
| `test_open_meteo`: one batch 500 (twice) | those locations missing; `failed_locations` counted |
| `test_open_meteo`: wrong units | batch missing |
| `test_open_meteo`: cache | second call makes no HTTP request |
| `test_open_meteo`: 400 | no retry; batch missing |
| `test_open_meteo`: 429 | **no retry**; `rate_limited` set (regression, VF-11) |
| `test_tomtom`: state/country geocode results | dropped (regression, VF-14) |
| `test_tomtom`: sparse `progress[]` like the live API | parsed; ETAs end at the summary travel time (VF-12) |

## 4. Planner integration — `tests/test_planner.py`

Services monkeypatched with the synthetic routes and generated series:

- happy path: 3 routes, checkpoints per interval, Σ covered = D, recommendation consistent with
  metrics, corridor cells have 49 hours
- 2 routes → `FEWER_THAN_THREE_ROUTES`
- weather partially missing → `WEATHER_PARTIAL` and UNKNOWN checkpoints
- weather entirely missing → `WEATHER_UNAVAILABLE` and `NO_WEATHER_DATA`
- checkpoints fetched before cells; heatmap-only failure → only `CORRIDOR_WEATHER_PARTIAL`, still
  `RECOMMENDED`; rate-limited failure → "wait about a minute" hint, given once (regressions, VF-11)
- weather window covers the latest arrival
- deterministic output for the same input

## 5. API contract — `tests/api/`

- Health (existing 6 tests).
- Geocode: 200 shape; `q` too short/long → 400; 0 results → 404; provider errors → 502/503/504;
  not configured → 503.
- Plan validation: missing field · lat 91 · same location · naive datetime · past (> 15 min) ·
  8 days ahead · load −1 / "abc" / 100,001 · interval 15 · malformed JSON → 400 with the right code.
- Plan errors: `NoRouteFound` → 422; auth → 502; rate limited → 503 + `Retry-After`; timeout → 504;
  unexpected → 500 without a stack trace.
- Contract: every key in API_CONTRACT §3.2 is present with the right type; corridor arrays have
  length 49; every error matches §5.
- Throttle: requests over the limit → 429 `TOO_MANY_REQUESTS`.
- Unknown path → 404 JSON `NOT_FOUND`.

## 6. Live tests — `tests/live/test_live.py` (`-m live`)

| Test | Needs | Records |
|---|---|---|
| Open-Meteo 3 points, 49-hour window: list length, units, array lengths | network | pass/fail, duration |
| TomTom geocode "Chicago, IL" within 30 km of 41.88, −87.63 | `TOMTOM_API_KEY` | — |
| TomTom routes for the 5 evidence trips (blueprint §13.7): route count, response size | key | count per trip (OPEN-12) |
| Full plan Chicago → Denver | key | duration |

Results go in the README verification log with dates. Without a key, the TomTom tests are
**skipped** and reported as unverified. **2026-10-12: 8 passed with a real key** (3 routes for each
evidence trip; full plan 6.7 s). Open-Meteo's per-minute limit (VF-11) means live runs should be
spaced about a minute apart.

## 7. Frontend tests (Vitest + RTL, mocked `fetch`, map mocked)

| File | Covers |
|---|---|
| `api/client.test.ts` | Base URL, health parsing, geocode/plan requests, error body → `ApiError` (code, details, retry-after), network failure, contract check, aborts |
| `App.test.tsx` | API status (checking/ok/unreachable/HTTP error/retry/timeout — Phase 1 tests kept); landing → planner; app-bar navigation; mobile tab bar; empty state; 404 page; About rules |
| `features/trip-form/validation.test.ts` | Missing places, < 1 mi apart, departure window incl. 15-min grace, load bounds/format, ISO-with-offset conversion, next-hour default, backend 400 → fields, inputs-changed detection |
| `pages/PlanPage.test.tsx` | Trip form: Find → candidates → "Show 1 more" → select → chip → Change; no-results message; submit disabled until both places; field errors, summary and focus; swap; interval. Planning: request body, loading text, navigate to routes; NO_ROUTE_FOUND with Edit/Retry; RATE_LIMITED with retry hint and preserved inputs; ROUTING_NOT_CONFIGURED; backend 400 on fields; unreachable backend; "inputs changed" hint |
| `pages/RoutesPage.test.tsx` | Cards in rank order with badges, figures, No Travel/Unknown lines and accessible miles bar; recommendation line; warnings; card and map route selection; no-eligible-route; fewer than three routes |
| `pages/RouteDetailsPage.test.tsx` | Stats; checkpoint rows (ETA, values, text risk); level filter incl. Unknown; table ↔ map selection; tabs; unknown route id |
| `pages/RecommendationPage.test.tsx` | RECOMMENDED explanation and decision trace; comparison table in rank order; "why not" texts; NO_ELIGIBLE_ROUTE with "Try a later departure" focusing the departure; NO_WEATHER_DATA with "Retry weather" |
| `pages/HeatmapPage.test.tsx` | Slider label (clock time + "departure + k h"), prev/next, bounds 0–48, **no network requests while sliding**, cell details per hour, layer toggles, explanatory text |
| `state/tripStorage.test.ts` | Saved-trip records: empty storage, round trip, stored keys (no secrets), malformed JSON / wrong version / expired / future time / invalid result shapes discarded, orphaned UI record, UI fallback to the result's inputs, out-of-range selection and hour, failed save (quota) removes the older trip |
| `state/persistence.test.tsx` | Reload = unmount + render with the same storage: empty start saves nothing; successful plan saved with inputs and selection; restore without new requests and with the calculation time; map selection, slider and navigation after restore; slider hour and selection restored; corrupted/incompatible/expired storage ignored; outdated after an input change (also after reload) until re-planned; New trip from results and from the planner; repeated reloads make no requests |
| `lib/lib.test.ts` | Formatting (durations, miles, CDT/CST), risk codes (unknown never Low), rank order, bounds, cell styles, slider hour times, criteria pair formatting, runner-up, "why not" for a higher-ranked ineligible route |

jsdom has no layout engine, so the Leaflet module (`features/map/index.ts`) is replaced in
`src/test/setup.ts` by stand-ins exposing the same callbacks. jsdom also does not step range inputs
with arrow keys, so slider keyboard use is verified in Chrome (§8).

**Responsive behaviour** is checked with headless Chrome screenshots at 375 × 812 and
1440 × 900 for each page (§8). jsdom has no layout engine.

## 8. Manual / E2E checklist (real backend)

1. Routes visible with distinct styles; recommended route highlighted.
2. Every route shows checkpoints; colours match the legend; UNKNOWN distinguishable without colour.
3. Checkpoint popup shows ETA, values, forecast hours, levels and reason.
4. Route click / card click selects the route and shows its summary.
5. A route card's miles per level equal the sums in the checkpoint table.
6. The explanation matches ranking and eligibility.
7. Interval 10/25/50 changes checkpoint counts.
8. The slider recolours the heatmap; the Network panel shows no requests.
9. Usable at 375 px; keyboard-only flow works.
10. With the backend stopped: error state with Retry; with no TomTom key: `ROUTING_NOT_CONFIGURED` message.
11. Plan a trip, reload any results page: the trip returns with "Restored after reload" and the calculation time, and the Network panel shows no plan request. New trip clears it; closing the tab clears it.

## 9. Fixture policy

- Open-Meteo: `fixtures/open_meteo_3_locations.json`, **recorded** live on 2026-10-12 (no key
  involved).
- TomTom: `tests/synthetic_tomtom.py`, **synthetic** — built from the documented schema (VF-8,
  VF-9) and checked against the live format on 2026-10-12 (VF-12 – VF-15), including sparse
  `progress[]`. Real responses (100–350 KB of geometry per route) are not committed; live
  behaviour is covered by `pytest -m live`.
- Frontend fixtures (`src/test/fixtures.ts`) are hand-made and used only in tests; they are never
  rendered in the app.
