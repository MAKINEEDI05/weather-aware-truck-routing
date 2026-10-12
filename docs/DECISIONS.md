# Decisions, verified facts and open questions

This is the decision register for the project. Decision text that is still current in
[`PROJECT_BLUEPRINT.md`](../PROJECT_BLUEPRINT.md) §18.2 is not repeated here: DEC-1 to DEC-28 are
listed by number and title only, and the blueprint has their full reasoning. Decisions made during
implementation (DEC-29 onwards) are written out in full.

Order of authority (most authoritative first):

1. **Assessment PDF** (`fs-assessment-spotter.pdf`): mandatory requirements.
2. **Approved blueprint** and this register: architecture and implementation decisions.
3. **Design references** (`design/*.png`, kept out of Git): visual direction only. They are not
   business logic, and their numbers are not data.

---

## 1. Assessment requirements (verbatim summary)

From the PDF:

- The user enters origin and destination, departure date/time, and load weight.
- The app generates 3 route options using a routing API.
- It samples weather every 10 / 25 / 50 miles, using the truck's estimated arrival time at each
  checkpoint.
- It calculates weather risk using the provided risk/load rules, and recommends the best route,
  balancing weather risk and travel time.
- It shows all routes, checkpoints, risk levels, ETAs and route summaries on a map, plus a weather
  heatmap along the trip corridor with a 0–48 hour forecast slider.
- Risk thresholds, load rules and recommendation priority: see
  [`REQUIREMENTS.md` §3](REQUIREMENTS.md#3-business-rules-exact-pdf-text).
- Deliverables: GitHub repository, hosted application, 5–10 min Loom walkthrough.
- Evaluation weights: 40 / 35 / 10 / 5 (these total 90%; see OPEN-1).
- The PDF also says: "Prioritize correctness and clarity over extra features."

## 2. Verified provider facts

| ID | Fact | How verified | Date |
|---|---|---|---|
| VF-1 | Open-Meteo multi-location requests (comma-separated `latitude`/`longitude`) return a JSON **list** in request order. A single location returns an **object**. | Live call | 2026-10-12 |
| VF-2 | Open-Meteo `hourly_units` with `wind_speed_unit=mph&precipitation_unit=inch`: `wind_speed_10m` = `"mp/h"`; `rain`, `showers`, `snowfall` = `"inch"`. | Live call | 2026-10-12 |
| VF-3 | Open-Meteo `start_hour`/`end_hour` are **inclusive**: 06:00 to 06:00 two days later gives 49 hourly records. With `timeformat=unixtime`, times are epoch seconds (UTC). | Live call | 2026-10-12 |
| VF-4 | Open-Meteo returns the grid-cell centre it used (`latitude`/`longitude`), a few km from the requested point. | Live call | 2026-10-12 |
| VF-5 | Open-Meteo batch of 100 locations × 49 h × 4 variables: URL ≈ 2.4 KB, response ≈ 200 KB, ≈ 1.8 s. A batch of 200 also works (URL 4.5 KB, ≈ 2.9 s). | Live call | 2026-10-12 |
| VF-6 | Open-Meteo `end_hour` is accepted up to ≈ 15 days ahead; beyond that it returns HTTP 400 `{"error":true,"reason":"Parameter 'end_hour' is out of allowed range …"}`. | Live call | 2026-10-12 |
| VF-7 | Open-Meteo free tier: < 600 calls/min, 5,000/hour, 10,000/day, 300,000/month; non-commercial use only; CC BY 4.0; no uptime guarantee. A call is "typically one HTTP request"; more than 10 variables or more than 2 weeks per location counts fractionally more. **Multi-location counting is not stated** (OPEN-7). | Official terms and pricing pages | 2026-10-12 |
| VF-8 | TomTom Calculate Route: `maxAlternatives` is 0–5, and "fewer alternative routes may be returned"; `extendedRouteRepresentation=distance,travelTime` requires JSON + polyline; `progress[]` elements carry `pointIndex`, `distanceInMeters`, `travelTimeInSeconds` (cumulative). The docs **do not say** whether intermediate progress elements can be omitted. `departAt` is RFC 3339 or `now`. | Official docs | 2026-10-12 |
| VF-9 | TomTom Geocode: `results[].address.{freeformAddress, municipality, countrySubdivision, countrySubdivisionName, countrySecondarySubdivision, countryCode}`, `results[].position.{lat, lon}`, `type`, `entityType`; `countrySet`, `limit` (default 10, max 100); errors 400/403/429/5xx. | Official docs | 2026-10-12 |
| VF-10 | TomTom terms and conditions text could not be retrieved, so caching and display restrictions are unknown (OPEN-10). | Attempted | 2026-10-12 |
| VF-11 | **Open-Meteo counts every location of a multi-location request against its per-minute limit.** After ≈ 800 locations in about a minute (a live test plan of 508, then batches of 100), further batches returned **HTTP 429**. At most 13 HTTP requests were made in that minute, so per-request counting could not explain it. Resolves OPEN-7. | Live calls | 2026-10-12 |
| VF-12 | TomTom `progress[]` is **sparse**: 86 elements for 10,649 points on Chicago → Denver (largest index gap 614), always including the last point. The last element equals `summary.lengthInMeters` and `travelTimeInSeconds` exactly. | Live call | 2026-10-12 |
| VF-13 | TomTom route counts with `maxAlternatives=2`, truck mode, departure ≈ now + 3 h: **3 routes** for each of Chicago → Denver, Dallas → Atlanta, Seattle → Salt Lake City, Los Angeles → Phoenix and Kansas City → Minneapolis. Chicago → Denver departing ≈ now + 30 h returned **2 routes**. The count varies with departure time. Geometry is dense: 4.5k–15k points per route. | Live calls | 2026-10-12 |
| VF-14 | TomTom Geocode is fuzzy and can return **state-level** results: "Denvr, CA" → "California" (`entityType` `CountrySubdivision`, highest score), then Denver CO/NC/MI/NY; gibberish still returns neighbourhood matches. Postcodes return `PostalCodeArea` and street results. | Live calls | 2026-10-12 |
| VF-15 | TomTom returns HTTP 400 for an unroutable pair (Honolulu, HI → Denver, CO), which the app maps to 422 `NO_ROUTE_FOUND`. | Live call via the UI | 2026-10-12 |
| VF-16 | TomTom response caching headers (live, 2026-10-12): **calculateRoute → `Cache-Control: no-cache, no-transform`, `Pragma: no-cache`**; geocode → no caching directive. The full terms text still could not be retrieved (the legal page renders client-side). Secondary summaries say TomTom permits caching only as response headers allow and not to serve multiple users. This bears on DEC-56, which keeps a result in the same user's tab for up to 12 h. | Live call; web search | 2026-10-12 |

**Live verification status (2026-10-12):** TomTom geocoding and truck routing are **verified
against the live API** (`pytest -m live`, 8 passed; plus manual API and browser runs). Unit and
service tests still use **synthetic** TomTom fixtures (`backend/trips/tests/synthetic_tomtom.py`)
because real responses are 100–350 KB per route. Error bodies for 401/403/429/5xx have not been
observed live; they are tested against the documented formats only.

## 3. Decisions carried over from the blueprint (still current)

DEC-1 Continental US · DEC-2 Stateless, no DB models · DEC-3 Interval 10/25/50, default 25 ·
DEC-4 Pick locations from geocoder candidates · DEC-5 Departure window (amended by DEC-31) ·
DEC-6 Load 0–100,000 lb · DEC-7 Wind half-open intervals · DEC-8 Shared rain/snow endpoints go
to the higher level · DEC-9 Sustained 10 m wind · DEC-10 Rain = rain + showers (refined by DEC-35) ·
DEC-11 Load rules use the entered value; weight not sent to routing · DEC-12 No Travel routes are not
eligible (ranking unchanged) · DEC-13 No Travel not counted as Severe miles · DEC-14 Average risk =
distance-weighted mean over known miles · DEC-15 Slider hour k = departure hour + k · DEC-16 Heatmap
colour = risk with the user's load · DEC-17 Overall = max; missing → UNKNOWN unless a known component
is No Travel · DEC-18 Checkpoints at 0, N, 2N … and destination · DEC-19 Covered miles by midpoints ·
DEC-20 Comparison precision, null average last, provider order final · DEC-21 Statuses
NO_WEATHER_DATA → NO_ELIGIBLE_ROUTE → RECOMMENDED · DEC-22 Provider alternatives first, fallback
only on evidence, never fabricate · DEC-23 ETA from the provider progress profile, continuous driving
(refined by DEC-37) · DEC-24 Rain/snow from the hour containing the ETA, wind from the nearest hour ·
DEC-25 Corridor grid 0.25° (amended by DEC-34) · DEC-26 One gunicorn process with threads,
in-memory cache · DEC-27 API throttle 10/min plan, 30/min geocode · DEC-28 No geometry simplification
unless measured size requires it.

## 4. Decisions made during implementation

| ID | Decision | Reason |
|---|---|---|
| DEC-29 | **Multi-page SPA with client-side routing** (`react-router`): `/` landing, `/plan`, `/routes`, `/routes/:routeId`, `/recommendation`, `/heatmap`, `/about`. Supersedes blueprint §6.1 "single page, no router". | The design references and the brief require a landing page, an About page and navigation between views. One in-memory trip result is shared by all pages (React context). |
| DEC-30 | **Route colours:** A blue `#2563eb`, B slate `#334155`, C cyan `#0891b2`. **No Travel colour:** fuchsia `#c026d3`, with a dark outline on map markers. Supersedes the blueprint's "blue/violet/teal" and "black/dark purple". | Matches the design references. Violet would be confused with the No Travel colour. |
| DEC-31 | **Departure window:** `now − 15 min ≤ t ≤ now + MAX_DEPARTURE_DAYS_AHEAD days` (default 7). Amends DEC-5. | A user who picks "now" would otherwise be rejected because of form and network latency. 15 minutes cannot change which forecast hour is used meaningfully. |
| DEC-32 | **Missing `TOMTOM_API_KEY`:** geocode and plan return **503 `ROUTING_NOT_CONFIGURED`**. The key value is never echoed. | Makes a misconfigured deployment obvious instead of a generic 500. |
| DEC-33 | **`departAt`:** the departure is sent to TomTom as UTC `…Z` only when it is at least 2 minutes in the future; otherwise `departAt=now`. ETAs are always computed from the **user's** departure plus TomTom's cumulative travel times. | TomTom's behaviour for past times is unverified (VF-8). |
| DEC-34 | **Corridor grid coarsening tiers:** 0.25°, 0.5°, then 1.0° (each with a one-cell buffer), then 1.0° without the buffer as a last resort; the first tier with **≤ 200 cells** is used. Routes are sampled every 5 mi. Any tier other than 0.25° adds warning `CORRIDOR_COARSENED`. Amends DEC-25. *(Revised 2026-10-12 from ≤ 400 cells after VF-11.)* | Open-Meteo counts every location against 600/min (VF-11). Real Chicago → Denver needed 369 cells at 0.5°, so with 143 checkpoints one plan used ≈ 512 locations and a 10-mi plan ≈ 721, which always exceeded the limit. At ≤ 200 it is 297 / 506. |
| DEC-35 | **Rain = `rain + showers`. If either is missing, rain is missing** (then UNKNOWN unless another component is No Travel). Refines DEC-10. | Partial liquid precipitation must never under-report risk. |
| DEC-36 | **Responses are gzip-compressed** (`GZipMiddleware`). | Plan responses carry geometry and a 49-hour corridor grid. No secrets or cookies are in responses, so BREACH-style attacks do not apply. |
| DEC-37 | **Route profile:** mile markers and times come from TomTom `progress[]`. If intermediate progress elements are absent, distance and time between two progress anchors are spread by the haversine fraction of the polyline. Route length `D` = the last progress distance. Refines DEC-23. | VF-8: the docs do not guarantee one progress element per point. |
| DEC-38 | **Explanation:** the recommended route is compared with every other route (the first differing criterion and both values). The UI "decision trace" compares it with the **runner-up**: the best-ranked other route, which can rank above it only when that route is ineligible. | Matches the design and FR-14 with no extra rules. |
| DEC-39 | **Road names ("via I-80") are not shown.** Routes are labelled Route A/B/C (provider order) with distance, time and arrival. | Road names need TomTom guidance instructions, which are not requested and cannot be verified without a key. |
| DEC-40 | **Brand assets are placeholders:** the logo and landing illustration use clearly named slots (`frontend/src/assets/brand.ts`) with restrained generic fallbacks. | The client will supply the brand assets later. |
| DEC-41 | **No "Sample data" badge and no mockup numbers in the app.** Every number shown comes from an API response. | The mockup values are illustrative only. |
| DEC-42 | ~~**Trip state lives in memory only**~~ — **superseded by DEC-56** (2026-10-12). | DEC-2; avoids showing stale forecasts. |
| DEC-43 | **Health check on two paths:** `/api/v1/health/` (contract) and `/api/health/` (alias requested in Phase 1). Every path ends with `/`. | Phase 1 request plus blueprint contract. |
| DEC-44 | **Versions:** React 19 + React Leaflet 5, TypeScript 6.0, Vite 8, Tailwind 4, Django 5.2 LTS, DRF 3.18. | Verified compatible in Phase 1; React Leaflet 5 requires React 19. |
| DEC-45 | **No database configured** (`DATABASES = {}`). | Nothing persists; Django needs neither SQLite nor `migrate`. |
| DEC-46 | **Typography and icons:** Overpass + Overpass Mono (self-hosted via `@fontsource-variable/*`; Inter before the independent redesign, `docs/DESIGN_SYSTEM.md`) and `lucide-react` outline icons. | Overpass descends from Highway Gothic, the US road-sign lettering; mono figures align as tables. No runtime font CDN. |
| DEC-47 | **No via-point fallback routes.** The evidence gate (DEC-22) was run on 2026-10-12: TomTom returned 3 routes for all 5 evidence trips (VF-13), so a fallback is not needed for typical trips. When fewer are returned (seen once: 2 routes at +30 h), the app shows the real count and warning `FEWER_THAN_THREE_ROUTES`. | Never fabricate routes; the evidence does not justify the extra complexity. |
| DEC-48 | **Weather cache:** each location's hourly series is cached for `WEATHER_CACHE_TTL_S` (default 1,800 s), keyed by the exact coordinates and the UTC window. Only successful series are cached. | Reduces Open-Meteo calls on re-plans (VF-7). |
| DEC-49 | **Decimal formatting in explanations:** miles are shown to 1 decimal, or 2 decimals when the 1-decimal values look equal but differ at the 0.01-mi ranking precision (DEC-20). | Explanations must never say "25.0 vs 25.0 → more". |
| DEC-50 | **Retry** repeats the last request; when the page started from an existing result (no request in memory), it repeats `result.request`. | "Retry weather" must work from the recommendation page. |
| DEC-51 | **Vendor code splitting** (`react`, `map` chunks) instead of route-level lazy loading. | Removes the > 500 KB chunk warning and improves caching without suspense boundaries around the map. |
| DEC-52 | **Checkpoint weather is fetched before corridor cells** (two calls sharing one time window), with separate warnings: `WEATHER_UNAVAILABLE` / `WEATHER_PARTIAL` describe checkpoints only, and the new `CORRIDOR_WEATHER_PARTIAL` describes heatmap cells. | If the per-minute limit is hit, the heatmap degrades instead of the recommendation (VF-11). A real run before this fix returned `NO_WEATHER_DATA` labelled only "partial". |
| DEC-53 | **Open-Meteo 429 is not retried**; batches that hit it set `rate_limited`, and the warning says to wait about a minute and plan again. The cache means the retry fetches only the missing points. | The limit is per minute, so an immediate retry only spends another call. |
| DEC-54 | **Geocode drops `Country` and `CountrySubdivision` results.** | A whole state is not a trip endpoint; routing would go to its centroid (VF-14). |
| DEC-55 | **gunicorn `--timeout 120`** (amends DEC-26's 60 s). | Worst case: routing read timeout 30 s + one retry, plus weather batches, can exceed 60 s. 120 s matches the frontend's client timeout. |
| DEC-56 | **The last successful trip survives a reload** (supersedes DEC-42). The result is saved to `sessionStorage` once per plan and the UI state (form inputs, selected route and checkpoint, slider hour) as it changes, under a schema version; records are validated on load and discarded when malformed, versioned out or older than 12 h. A restore makes no routing or weather request; results pages say "Restored after reload" with the calculation time, and "Outdated" once an input changes. **New trip** clears everything. | Users lost their results on every refresh. `sessionStorage` (per tab, cleared when the tab closes) avoids cross-tab overwrites and keeps provider results out of long-term storage while OPEN-10 is open; the labels address DEC-42's stale-forecast concern. |
| DEC-57 | **A route-only 0.5° band comes before a buffered 1.0° grid** (amends DEC-34): tiers are 0.25°+buffer, 0.5°+buffer, **0.5° without buffer**, 1.0°+buffer, 1.0° without buffer; the first with ≤ 200 cells is used. | Same weather budget, more accuracy where the truck drives: live Chicago → Denver went from 154 cells at 1.0° (cell centres up to ~50 mi from the road) to 130 cells at 0.5° (within ~20 mi), 273 instead of 297 Open-Meteo locations. Trade-off: the heatmap is a band along the routes rather than a regional block. |

## 5. Contradictions found and how they were resolved

| # | Contradiction | Resolution |
|---|---|---|
| C-1 | Blueprint §6.1 says "single page, no router", but the design and brief require landing, About and navigation. | DEC-29 |
| C-2 | Blueprint route colours (blue/violet/teal) differ from the design's (blue/slate/teal). | DEC-30 |
| C-3 | The design's About page says "React 18 · Django 5"; the code uses React 19 · Django 5.2. | The app's About page states the real versions (DEC-44). |
| C-4 | The design shows road names ("via I-55 / I-70"). | Not implemented (DEC-39). |
| C-5 | The design says "Compare three truck routes"; the provider may return fewer (VF-8). | Copy says "up to three"; the real count is always shown (DEC-47). |
| C-6 | The Phase 1 request said `/api/health/`; the blueprint contract says `/api/v1/health`. | Both are served (DEC-43). |
| C-7 | The PDF evaluation weights total 90%. | Not resolvable (OPEN-1). |
| C-8 | The design's mobile navigation has four tabs and no Recommendation tab. | Recommendation is reached from the Routes view on mobile (banner and link) and from the top app bar on desktop. |

## 6. Assumptions

| ID | Assumption |
|---|---|
| A-1 | Continuous driving with no rest breaks (OPEN-6), so ETAs on long trips are optimistic. |
| A-2 | An assessment demo counts as non-commercial use of Open-Meteo (OPEN-8). |
| A-3 | The hourly rain/snow total for the hour containing the ETA is used as the in/hr rate (DEC-24). |
| A-4 | Forecast values describe the Open-Meteo grid cell, not the exact road point (VF-4). |

## 7. Open questions

| ID | Question | Current handling |
|---|---|---|
| OPEN-1 | What is the unallocated 10% of the evaluation? | None |
| OPEN-2 | Should all three intervals be computed at once? | DEC-3 |
| OPEN-3 | Sustained wind or gusts? | DEC-9 |
| OPEN-4 | Is load weight cargo or gross? | DEC-11 |
| OPEN-5 | Is slider hour relative to now or to departure? | DEC-15 |
| OPEN-6 | Should ETAs include rest breaks? | No (A-1) |
| OPEN-7 | How does Open-Meteo count multi-location requests? | **Resolved 2026-10-12:** per location (VF-11) → DEC-34 revised, DEC-52, DEC-53 |
| OPEN-8 | Does an assessment demo count as non-commercial use of Open-Meteo? | Assumed yes (A-2) |
| OPEN-9 | Which hosts for deployment? | README gives instructions for Render + Vercel/Netlify; not deployed |
| OPEN-10 | Do TomTom's terms restrict caching or display on OSM tiles? | No server-side TomTom caching; DEC-56 keeps the last result in the user's own tab (`sessionStorage`, ≤ 12 h) although routing responses say `no-cache` (VF-16). **User to read the terms**; if they forbid this, persist only the form inputs. |
| OPEN-11 | Should No Travel miles count toward "Severe miles"? | DEC-13 (no) + DEC-12 |
| OPEN-12 | Does TomTom return 3 routes for typical US truck trips? | **Resolved 2026-10-12:** yes for all 5 evidence trips; occasionally fewer (VF-13, DEC-47) |

## 8. Blockers

| ID | Blocker | Effect | Needed from user |
|---|---|---|---|
| ~~B-1~~ | ~~No TomTom API key~~ — **resolved 2026-10-12** (key in `backend/.env`; live tests pass) | — | Set the same variable on the production host |
| B-2 | TomTom terms not readable by the agent | OPEN-10 | Read the terms |
| B-3 | No deployment authorisation | App not hosted | Choose hosts and deploy (README §Deployment) |
