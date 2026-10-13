# Weather-Aware Truck Routing

A React + Django web app that helps a truck driver choose the safest route based on forecast
weather, load weight and travel time (Spotter full-stack assessment).

> **Status (2026-10-12):** feature-complete and **verified end to end against the live TomTom and
> Open-Meteo APIs**, including in a browser at desktop and mobile widths. The app is **not deployed**
> yet and the Loom walkthrough is not recorded. See [Verification log](#verification-log) and
> [Remaining work](#remaining-work).

## What it does

1. Enter an origin and destination (each picked from geocoder candidates), a departure time
   (within 7 days), a load weight in lb, and a checkpoint interval (10, 25 or 50 mi).
2. The backend requests truck routes with alternatives from **TomTom** and shows the real number
   returned (target 3; routes are never invented).
3. Along each route, checkpoints are placed every N miles plus at the destination. Each gets an
   **ETA** from TomTom's cumulative travel times and the **Open-Meteo** forecast for that hour.
4. Wind, rain and snow are classified with the assessment's thresholds and load rules: Low,
   Moderate, High, Severe, No Travel. A missing forecast is **Unknown**, never Low.
5. Routes are ranked strictly by **fewest Severe miles → fewest High miles → lowest average risk
   → shortest travel time**. A route with any No Travel miles keeps its rank but is not
   recommended (app policy). The explanation names the criterion that decided.
6. A map shows all routes, risk-coloured checkpoints with ETAs and popups, and route summaries. A
   **corridor heatmap** with a **0–48 h slider** recolours instantly from data already loaded.
7. Reloading the page restores the last trip in that browser tab without new requests, labelled
   with when it was calculated; changed inputs mark results outdated; **New trip** clears it.

Pages: landing `/`, planner `/plan`, route comparison `/routes`, route details `/routes/:id`,
recommendation `/recommendation`, heatmap `/heatmap`, about `/about`.

## Documentation

| Document | Contents |
|---|---|
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Requirements, exact rules, validation, traceability |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Components, data flow, integrations, security |
| [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) | Endpoints, schemas, units, errors |
| [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) | Test matrices, mocked vs live |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Tokens, components, reference-image mapping, asset slots |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Verified provider facts, decisions (DEC-n), open questions, blockers |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Milestones and acceptance criteria |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | Loom walkthrough script |
| [`TASKS.md`](TASKS.md) | Progress tracker |
| [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) | Original plan and reasoning (superseded by `docs/` where they differ) |

## Rules as implemented

Thresholds and load rules are the assessment's, quoted in
[`backend/trips/domain/risk.py`](backend/trips/domain/risk.py). Interpretations where the PDF is
ambiguous ([`docs/DECISIONS.md`](docs/DECISIONS.md)):

- Wind uses half-open ranges `[25,35) [35,45) [45,55)`, so 34.6 mph is Moderate (DEC-7).
- A rain or snow value on a shared boundary belongs to the higher level (DEC-8). 1.00 in/hr rain and
  3.0 in/hr snow are Severe; No Travel is strictly above.
- Load thresholds are strict: exactly 30,000 or 40,000 lb does not trigger a rule.
- Sustained 10 m wind, not gusts (DEC-9). Rain = Open-Meteo `rain + showers`; snow = `snowfall`.
- Rain and snow use the hourly total that contains the ETA; wind uses the nearest hour (DEC-24).
- Covered miles run from midpoint to midpoint, so Severe and High miles are real road miles summing
  to the route length (DEC-19). Average risk is distance-weighted over known miles (DEC-14).
- No Travel miles are not counted as Severe miles (DEC-13). They make a route ineligible for
  recommendation without changing its rank (DEC-12).
- ETAs assume continuous driving with no rest breaks.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 8, Leaflet 1.9 + React Leaflet 5, lucide icons, Inter |
| Backend | Python ≥ 3.12, Django 5.2 LTS, Django REST Framework 3.18, requests, gunicorn |
| Providers | TomTom Routing v1 + Geocoding (key, server-side only), Open-Meteo Forecast (no key), OpenStreetMap tiles |
| Tests | pytest + pytest-django + responses (backend), Vitest + React Testing Library (frontend) |

There is no database and no authentication. The backend is stateless.

## Local setup (Linux)

Requirements: Python ≥ 3.12 and Node.js ≥ 22.22.2 (developed with Python 3.14.7 and Node 22.23.1),
plus a [TomTom developer key](https://developer.tomtom.com) for routing and geocoding.

```bash
# Terminal 1 — backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env          # set DJANGO_DEBUG=true and TOMTOM_API_KEY=<your key>
python manage.py runserver 127.0.0.1:8000
```

```bash
# Terminal 2 — frontend
cd frontend
npm ci
cp .env.example .env          # optional in development (defaults to http://127.0.0.1:8000/api/v1)
npm run dev                   # http://localhost:5173
```

Without `TOMTOM_API_KEY`, location search and planning return `503 ROUTING_NOT_CONFIGURED`, and the
UI says so.

## Tests and checks

```bash
# backend/ (venv active)
pytest -m "not live"                         # mocked: no network
pytest -m "not live" --cov=trips --cov-report=term-missing
pytest -m live -s                            # real providers; TomTom tests skip without a key
ruff check . && ruff format --check .
DJANGO_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(50))')" \
  DJANGO_ALLOWED_HOSTS=api.example.com DJANGO_BEHIND_TLS_PROXY=true \
  DJANGO_SECURE_SSL_REDIRECT=true DJANGO_SECURE_HSTS_SECONDS=31536000 \
  python manage.py check --deploy

# frontend/
npm test -- --run
npm run lint && npm run format:check
npm run build                                # includes the TypeScript check
```

**Mocked vs live.** Unit, service, planner and API tests never touch the network. In them, TomTom
uses **synthetic** responses shaped like the live format
([`backend/trips/tests/synthetic_tomtom.py`](backend/trips/tests/synthetic_tomtom.py)), and Open-Meteo
uses a response **recorded live**. Frontend tests mock `fetch` and the Leaflet map. Live tests are
opt-in (`-m live`) and need `TOMTOM_API_KEY`. Open-Meteo counts every location against a 600/min
limit, so space live runs about a minute apart.

## Verification log

**Verified against live services (2026-10-12)**

| Check | Result |
|---|---|
| `pytest -m live -s` | **8 passed**: Open-Meteo 3 points × 49 h; TomTom geocode; routes for 5 trips; full plan |
| TomTom route count, departure ≈ now + 3 h | **3 routes** for each of Chicago → Denver, Dallas → Atlanta, Seattle → Salt Lake City, Los Angeles → Phoenix, Kansas City → Minneapolis |
| TomTom route count, Chicago → Denver, departure ≈ now + 30 h | **2 routes** (warning shown); the count varies with departure time |
| Route data | 4.5k–15k geometry points per route; sparse `progress[]` (86 entries for 10,649 points), ending exactly at the summary length and travel time |
| Full plan Chicago → Denver (25 mi, 42,000 lb) | 6.7–7.0 s; 293 weather locations; 154 heatmap cells (1.0°); response 1.2 MB raw / 265 KB gzipped |
| Same trip after DEC-57 (2026-10-12, 38,000 lb) | 9.0 s; 273 weather locations; 130 heatmap cells (0.5°, route band) |
| 10-mile interval, same trip | full weather on 218 checkpoints |
| Real geocoding | Springfield → MO, IL, MA, VA, OR candidates; "Denvr, CA" → Denver CO/NC/MI/NY (state-level results dropped) |
| Unroutable trip (Honolulu → Denver) | TomTom 400 → 422 `NO_ROUTE_FOUND` → "No truck route found" in the UI |
| Browser run (headless Chrome, real data), 1440 × 900 and 375 × 812 | landing → search/pick → validation → loading → routes → details + checkpoint popup → recommendation + trace + "why not" → heatmap → error state; no app console errors; no horizontal scroll on any page |
| Heatmap slider, 24 steps | **0** network requests |
| Requests made by the browser | only the backend, the dev server and OSM tiles — never TomTom |
| Backend without a key | `503 ROUTING_NOT_CONFIGURED`; no key in logs |
| Secret scan | key prefix absent from all 152 committable files and the built bundle; `backend/.env` ignored |

**Verified with mocked tests**

| Check | Result |
|---|---|
| `pytest -m "not live"` | 250 passed, coverage 98% (domain modules 95–100%) |
| `npm test -- --run` | 127 passed |
| ruff, ESLint, Prettier, `tsc -b`, `npm run build`, `manage.py check --deploy` (production env) | clean |
| States that live weather did not produce today (No Travel, Severe, no-eligible-route, rate-limited weather) | covered by unit, planner and component tests |

**Implemented but not verified live:** TomTom 401/403/429/5xx error bodies (tested against the
documented formats), and real No Travel or Severe weather (today's forecasts were calm).

## Deployment

Not deployed. Hosts are a decision for the owner (OPEN-9). The steps below are for a Python web
service (e.g. Render, Railway, Fly.io) plus a static host (e.g. Vercel, Netlify).

**Backend** (root directory `backend/`):

```bash
# build
pip install -r requirements.txt
# start
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120
```

Use one worker with threads, so the in-memory weather cache and throttles are shared (DEC-26). The
120 s timeout covers a routing timeout and its retry (DEC-55). Set these environment variables on the
host:

| Variable | Production value |
|---|---|
| `DJANGO_SECRET_KEY` | a long random value |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_ALLOWED_HOSTS` | your backend host, e.g. `api.example.com` |
| `CORS_ALLOWED_ORIGINS` | your frontend origin, e.g. `https://app.example.com` (exact, no trailing slash) |
| `DJANGO_BEHIND_TLS_PROXY` | `true` |
| `DJANGO_SECURE_SSL_REDIRECT` | `true` if the host does not already redirect HTTP |
| `DJANGO_SECURE_HSTS_SECONDS` | e.g. `31536000` once HTTPS works |
| `DRF_NUM_PROXIES` | `1` behind a single proxy (client IP for throttling) |
| `TOMTOM_API_KEY` | your key |
| `PYTHON_VERSION` (Render) | e.g. `3.12.8` or newer |

Health check path: `/api/v1/health/`. Run `python manage.py check --deploy` with the production
variables first. No migrations or database are needed.

**Frontend** (root directory `frontend/`): build with `npm ci && npm run build`, publish `dist/`,
and set `VITE_API_BASE_URL=https://<backend-host>/api/v1` at build time. SPA rewrites are included
(`public/_redirects` for Netlify, `vercel.json` for Vercel).

**After deploying:**
1. `curl https://<backend>/api/v1/health/` → 200.
2. `curl "https://<backend>/api/v1/geocode/?q=Chicago"` → results.
3. Plan Chicago → Denver in the hosted app.
4. Check the browser console for CORS errors and the Network tab for TomTom calls (there should be
   none).

## Providers, licences and attribution

- **TomTom** Routing and Geocoding APIs. Freemium: 2,500 non-tile requests/day. Each plan uses 1
  routing request; each search uses 1 geocode request. TomTom results are not cached; the terms are
  still to be read by the owner (OPEN-10).
- **Open-Meteo** Forecast API: free for **non-commercial** use, < 10,000 calls/day, data under
  **CC BY 4.0**. Attribution appears on every map and in the footer. How multi-location requests
  are counted is undocumented (OPEN-7); batching, a 30-minute cache and the corridor cell cap bound
  usage.
- **OpenStreetMap** tiles: attribution is shown on every map, and only visible tiles are loaded.

## Known limitations

- **Weather on the hosted backend (2026-10-13):** Open-Meteo refuses every forecast request from the
  Render deployment with HTTP 429, even for a two-request trip, while the same requests work
  locally (VF-17). Open-Meteo's free limits are per IP and Render's outbound IPs are shared by all
  services in a region, so the quota is most likely used up by other tenants. The app degrades as
  designed (routes shown, checkpoints Unknown, no recommendation). After deploying DEC-58, the
  warning and the Render log quote Open-Meteo's exact reason; the fix depends on which limit it names.
- ETAs assume continuous driving, so ETAs on long trips are optimistic.
- Forecasts are predictions for a model grid cell, which can be a few km from the road.
- When TomTom returns fewer than 3 routes, only those are shown, with a warning. The live evidence
  (3 routes for all 5 test trips) did not justify a via-point fallback (DEC-47).
- Open-Meteo's free tier counts every location (600/min, 10,000/day). A plan uses ≈ 150–500
  locations, so planning several new trips within a minute can leave some points Unknown. The app
  says so and a re-plan a minute later fills the gaps from cache (DEC-52, DEC-53).
- Road names ("via I-80") are not shown (DEC-39).
- The last trip survives a page reload in the same browser tab (12 h, `sessionStorage`) and is
  labelled with when it was calculated — reloading never fetches new forecasts. Closing the tab or
  **New trip** clears it (DEC-56).
- Long trips use a coarser heatmap grid (0.5° or 1.0°) to bound weather requests; a ~1,000-mile
  trip gets a 0.5° band along the routes rather than a wider 1.0° block (DEC-34, DEC-57).
- Plan responses for long trips are large (≈ 1.2 MB raw, ≈ 265 KB gzipped) because route geometry is
  sent at full provider detail (DEC-28).

## Remaining work

1. Commit the work (the owner commits; see `git status`), add a GitHub remote and push.
2. Read the TomTom terms (OPEN-10).
3. Deploy (see above), then run the post-deploy checks and record the Loom walkthrough
   ([`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)).
4. Supply brand assets: logo mark and landing illustration
   ([`frontend/src/assets/brand.ts`](frontend/src/assets/brand.ts)).
