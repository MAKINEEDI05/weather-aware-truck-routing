# Requirements

Source of truth for **what** the app must do. Rationale for interpretations lives in
[`DECISIONS.md`](DECISIONS.md); the original analysis is in
[`PROJECT_BLUEPRINT.md`](../PROJECT_BLUEPRINT.md) §2–§3.

Labels: **[PDF]** = stated in the assessment (authoritative) · **[DEC-n]** = documented
interpretation · **[ENG]** = engineering requirement not in the PDF.

## 1. Problem statement [PDF]

> Build a React + Django web app that helps a truck driver choose the safest route based on
> weather, load weight, and travel time.

## 2. Functional requirements

| ID | Requirement | Source |
|---|---|---|
| FR-1 | User enters an origin | PDF |
| FR-2 | User enters a destination | PDF |
| FR-3 | User enters a departure date/time | PDF |
| FR-4 | User enters a load weight | PDF |
| FR-5 | Generate 3 route options using a routing API (show the real count if the provider returns fewer; never fabricate) | PDF, DEC-22, DEC-47 |
| FR-6 | Sample weather every 10 / 25 / 50 miles | PDF |
| FR-7 | Use the truck's estimated arrival time at each checkpoint for its forecast | PDF |
| FR-8 | Calculate weather risk with the provided risk and load rules (§3) | PDF |
| FR-9 | Recommend the best route using the priority in §3.3 | PDF |
| FR-10 | Show all routes, checkpoints, risk levels, ETAs and route summaries on a map | PDF |
| FR-11 | Show a weather heatmap along the trip corridor with a 0–48 h forecast slider | PDF |
| FR-12 | User chooses the checkpoint interval: 10, 25 or 50 mi (default 25) | DEC-3 |
| FR-13 | User picks each location from geocoder candidates | DEC-4 |
| FR-14 | Explain which priority criterion decided the recommendation | ENG |
| FR-15 | Clearly flag No Travel segments, unknown weather, and "no route can be recommended" | ENG |
| FR-16 | Landing page, About page and navigation between views | Brief, DEC-29 |
| FR-17 | Loading, validation, error, incomplete-weather and no-eligible-route states, with retry | Brief, ENG |

## 3. Business rules (exact PDF text)

### 3.1 Risk thresholds [PDF]

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind | <25 mph | 25–34 | 35–44 | 45–54 | ≥55 mph |
| Rain | <0.10 in/hr | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | >1.00 |
| Snow | <0.5 in/hr | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | >3.0 |

### 3.2 Load rules [PDF]

- ≥55 mph → **No Travel** for any load
- 45–54 mph + >30,000 lb → **No Travel**
- 35–44 mph + >40,000 lb → **Severe**

### 3.3 Recommendation priority [PDF]

1. Fewest Severe miles
2. Fewest High miles
3. Lowest average risk
4. Shortest travel times

Criteria are compared in this order; the first difference decides. No weighted score exists.

## 4. Rules as implemented

`w` sustained wind (mph), `r` rain (in/hr), `s` snow (in/hr), `L` load (lb). Values are
classified at full precision; rounding is for display only.

**Wind (DEC-7 half-open intervals)**

| Condition | Base level | With load rule |
|---|---|---|
| `w < 25` | LOW | — |
| `25 ≤ w < 35` | MODERATE | — |
| `35 ≤ w < 45` | HIGH | SEVERE if `L > 40,000` |
| `45 ≤ w < 55` | SEVERE | NO_TRAVEL if `L > 30,000` |
| `w ≥ 55` | NO_TRAVEL | NO_TRAVEL (any load) |

Load equality is literal (A-4): exactly 30,000 lb or 40,000 lb does **not** trigger a rule.
With `30,000 < L ≤ 40,000` and `35 ≤ w < 45`, wind stays HIGH (a consequence of the PDF rules).

**Rain** (DEC-8: a shared endpoint belongs to the higher level; A-3: top of Severe is inclusive)

| Condition | Level |
|---|---|
| `r < 0.10` | LOW |
| `0.10 ≤ r < 0.25` | MODERATE |
| `0.25 ≤ r < 0.50` | HIGH |
| `0.50 ≤ r ≤ 1.00` | SEVERE |
| `r > 1.00` | NO_TRAVEL |

**Snow**

| Condition | Level |
|---|---|
| `s < 0.5` | LOW |
| `0.5 ≤ s < 1.0` | MODERATE |
| `1.0 ≤ s < 2.0` | HIGH |
| `2.0 ≤ s ≤ 3.0` | SEVERE |
| `s > 3.0` | NO_TRAVEL |

**Overall level (DEC-17)**

1. `overall = max(wind, rain, snow)` with LOW < MODERATE < HIGH < SEVERE < NO_TRAVEL.
2. If any component is missing: if a known component is NO_TRAVEL → NO_TRAVEL; otherwise
   **UNKNOWN**. Missing data is never treated as Low.
3. Negative, non-finite or non-numeric values are treated as missing.

**Scores (DEC-14):** LOW 0 · MODERATE 1 · HIGH 2 · SEVERE 3 · NO_TRAVEL 4 · UNKNOWN excluded.

### 4.1 Checkpoints and miles (DEC-18, DEC-19, DEC-37)

- Checkpoints at mile 0, every N miles (N ∈ {10, 25, 50}) and at the destination D. The
  destination is not added if the last regular checkpoint is within 0.01 mi of D.
- Coordinates are interpolated on the route polyline; they are not snapped.
- Each checkpoint covers the road from the midpoint with the previous checkpoint to the midpoint
  with the next one; Σ covered = D.
- `severe_mi`, `high_mi`, … = Σ covered miles of checkpoints at that overall level.
  `known_mi = D − unknown_mi`.
- `average_risk = Σ(score × covered) / known_mi`; `null` when `known_mi = 0`.

### 4.2 Time (DEC-23, DEC-24, DEC-33)

- `ETA(m) = departure + T(m)`; T is interpolated by distance from TomTom's cumulative travel times.
  Continuous driving, no rest breaks (A-1).
- Rain/snow use the hourly record stamped `ceil_to_hour(ETA)` (the ETA itself if exactly on the
  hour). Wind uses the nearest hour (half past rounds up). No interpolation.
- All times are timezone-aware UTC internally; the browser shows local time with a zone abbreviation.

### 4.3 Ranking, eligibility and status (DEC-12, DEC-20, DEC-21)

- **Ranking [PDF]:** key = (severe_mi, high_mi, average_risk, travel_time_s, provider_index).
  Miles are compared at 0.01-mi precision and average risk at 4 decimals. A `null` average sorts
  last. Provider order is the final, deterministic tie-break.
- **Eligibility [DEC-12]:** a route with `no_travel_mi > 0` keeps its rank but cannot be
  recommended. No Travel miles are not Severe miles (DEC-13).
- **Status (evaluated in order):** `NO_WEATHER_DATA` (every checkpoint on every route is
  UNKNOWN) → `NO_ELIGIBLE_ROUTE` (every route has No Travel miles) → `RECOMMENDED` (the
  best-ranked eligible route; warning `INCOMPLETE_WEATHER_DATA` if any route has unknown miles).

### 4.4 Corridor heatmap (DEC-15, DEC-16, DEC-34)

- Hour k ∈ [0, 48] = `floor_to_hour(departure) + k h`.
- Cells: 0.25° grid touched by any route (sampled every 5 mi) plus a one-cell buffer; while there
  are more than 200 cells: 0.5° with the buffer, 0.5° without it (only cells the routes pass
  through), 1.0° with the buffer, and as a last resort 1.0° without it (DEC-34, DEC-57).
- Cell colour = overall risk at that hour using the same classifier and the user's load. For hour
  T, wind, rain and snow all use the record stamped T (the same rule as an ETA exactly on the hour).
- The heatmap never changes checkpoint colours. Checkpoints show conditions at the truck's ETA.

## 5. Input validation

Backend validation is authoritative; the frontend mirrors it for immediate feedback.

| Field | Rule | Error code |
|---|---|---|
| `origin`, `destination` | Required objects; `label` 1–200 chars; `lat` ∈ [−90, 90]; `lon` ∈ [−180, 180] | `INVALID_INPUT` |
| origin vs destination | ≥ 1 mi apart (straight line) | `SAME_LOCATION` |
| `departure_time` | ISO 8601 **with** UTC offset; `now − 15 min ≤ t ≤ now + 7 days` (DEC-31) | `INVALID_INPUT` / `DEPARTURE_OUT_OF_RANGE` |
| `load_weight_lb` | Number, 0–100,000 (DEC-6) | `INVALID_INPUT` |
| `checkpoint_interval_mi` | 10, 25 or 50 | `INVALID_INPUT` |
| geocode `q` | 2–120 characters after trimming | `INVALID_INPUT` |

## 6. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | Correct risk and ranking logic | [`TEST_PLAN.md`](TEST_PLAN.md) §2 boundary and ranking matrices pass |
| NFR-2 | Smooth map, heatmap and slider | Slider makes zero network requests; only cell styles change |
| NFR-3 | Readable, tested code | Pure domain functions; typed frontend; lint and format clean |
| NFR-4 | Documentation | README, `docs/`, Loom script |
| NFR-5 | Security | Keys server-side only; validated input; exact CORS allowlist; throttling |
| NFR-6 | Reliability | Timeouts on every external call; typed errors; degraded weather becomes UNKNOWN, never Low |
| NFR-7 | Accessibility | Keyboard-operable form, lists, tabs and slider; risk always shown as text as well as colour |
| NFR-8 | Responsive | Usable at 375 px and 1440 px |
| NFR-9 | Deterministic | Same inputs and provider data → same ranking |

## 7. Out of scope

Hours-of-service and rest breaks; accounts, persistence and payments; turn-by-turn navigation and
live traffic display; non-US routing and metric UI; weather variables not in the PDF (ice, fog,
visibility, gusts, temperature).

## 8. Traceability

Implementation paths are relative to `backend/trips/` (BE) or `frontend/src/` (FE).

| Req | Implementation | Tests |
|---|---|---|
| FR-1, FR-2, FR-13 | BE `services/tomtom.py::geocode`, `api/views.py::GeocodeView`; FE `features/trip-form/LocationSearch.tsx` | `tests/services/test_tomtom.py`, `tests/api/test_geocode_api.py`; FE `PlanPage.test.tsx` |
| FR-3, FR-4, FR-12 | BE `api/serializers.py`; FE `features/trip-form/{TripForm.tsx, validation.ts}` | `tests/api/test_plan_api.py`; FE `validation.test.ts`, `PlanPage.test.tsx` |
| FR-5 | BE `services/tomtom.py::calculate_routes`, `planner.py` | `tests/services/test_tomtom.py`, `tests/test_planner.py`; live `tests/live/test_live.py` (needs key) |
| FR-6 | BE `domain/checkpoints.py` | `tests/unit/test_checkpoints.py` |
| FR-7 | BE `domain/profile.py`, `domain/forecast.py`, `services/open_meteo.py` | `tests/unit/test_profile.py`, `tests/unit/test_forecast.py`, `tests/services/test_open_meteo.py` |
| FR-8 | BE `domain/risk.py` | `tests/unit/test_risk.py` |
| FR-9, FR-14 | BE `domain/metrics.py`, `domain/recommend.py` | `tests/unit/test_metrics.py`, `tests/unit/test_recommend.py` |
| FR-10 | FE `features/map/*` (route summary and checkpoint popups), `pages/RoutesPage.tsx`, `pages/RouteDetailsPage.tsx`, `features/routes/*` | FE `RoutesPage.test.tsx`, `RouteDetailsPage.test.tsx`; headless-Chrome screenshots |
| FR-11 | BE `domain/corridor.py`; FE `features/map/CorridorLayer.tsx`, `features/forecast/ForecastSlider.tsx`, `pages/HeatmapPage.tsx` | `tests/unit/test_corridor.py`; FE `HeatmapPage.test.tsx`; browser check (slider makes 0 requests) |
| FR-15, FR-17 | BE `domain/recommend.py`, `planner.py` warnings, `api/exceptions.py`; FE `components/{StateViews,PlanStates,WarningsBanner}.tsx`, `pages/RecommendationPage.tsx` | `tests/unit/test_recommend.py`, `tests/api/test_plan_api.py`; FE `PlanPage.test.tsx`, `RecommendationPage.test.tsx` |
| FR-16 | FE `App.tsx`, `layouts/*`, `pages/LandingPage.tsx`, `pages/AboutPage.tsx` | FE `App.test.tsx` |
| NFR-5 | BE `config/settings.py`, `services/http.py` (redaction), throttles | `tests/services/test_http.py`, `tests/api/test_plan_api.py` |
| NFR-6 | BE `services/http.py`, `services/open_meteo.py`, `api/exceptions.py` | `tests/services/*`, `tests/api/*` |
