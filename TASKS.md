# TASKS — Weather-Aware Truck Routing

Progress tracker. Specifications live in [`docs/`](docs/); milestones and acceptance criteria in
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md). An item is checked only when it was
run and its result observed.

| Milestone | Blueprint phase | Status |
|---|---|---|
| M0 Project foundation | Phase 3 | Done (2026-10-12) |
| M1 Documentation set | — | Done (2026-10-12) |
| M2 Risk engine | Phase 6 | Done (2026-10-12) |
| M3 Domain calculations | Phases 5–6 | Done (2026-10-12) |
| M4 TomTom integration | Phase 4 | Done — live-verified 2026-10-12 |
| M5 Open-Meteo integration | Phase 5 | Done — live-verified |
| M6 Planner + API | Phases 4–6 | Done (2026-10-12) |
| M7 Frontend shell, landing, About | Phases 7–8 | Done (2026-10-12) |
| M8 Frontend features | Phases 7–8 | Done (2026-10-12) |
| M9 QA | Phase 9 | Done (2026-10-12) |
| M10 Deployment | Phase 10 | Done — deployed 2026-10-13 (Vercel + Render Virginia) |
| M11 Final integration verification | — | Done (2026-10-12) |

## M0 — Project foundation (done 2026-10-12)

- [x] `.gitignore`, `.editorconfig`; Django project `config`, app `trips`; env-based settings; CORS
- [x] `GET /api/v1/health/` (+ `/api/health/` alias); frontend connection status with retry and timeout
- [x] React + TS + Vite + Tailwind + Leaflet shell; ruff, ESLint, Prettier, pytest, Vitest
- [x] Backend 6 tests, frontend 13 tests, lint and build clean (observed 2026-10-12)

## M1 — Documentation (done 2026-10-12)

- [x] `docs/REQUIREMENTS.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `API_CONTRACT.md`,
      `TEST_PLAN.md`, `DESIGN_SYSTEM.md`, `DECISIONS.md`
- [x] Blueprint v1.2: points to `docs/` and lists the superseded sections
- [x] Open-Meteo facts verified live (VF-1 – VF-6); TomTom facts from docs only (VF-8, VF-9)
- [x] Contradictions recorded (`DECISIONS.md` §5)

## M2–M6 — Backend (done 2026-10-12)

- [x] `domain/risk.py`: PDF thresholds + load rules; full boundary matrix (57 tests)
- [x] `domain/{profile,checkpoints,forecast,metrics,recommend,corridor}.py` + tests (K1–K17, Σ covered = D property test)
- [x] `services/http.py` (timeouts, one retry, key redaction), `services/tomtom.py`, `services/open_meteo.py` (batching, cache, unit check)
- [x] `planner.py`; API: `GET /api/v1/geocode/`, `POST /api/v1/trips/plan/`, error handler, throttles, gzip
- [x] `pytest -m "not live"`: 241 passed; coverage 97% overall (domain ≥ 95% per module)
- [x] `pytest -m live`: Open-Meteo passed; 7 TomTom tests skipped (no key)
- [x] `ruff check`, `ruff format --check`, `manage.py check --deploy` (production env) clean
- [x] TomTom live verification and route-count evidence — done in M11

## M7–M8 — Frontend (done 2026-10-12)

- [x] Router + app shell (navy sidebar, mobile tab bar, top bar with trip chips and API status) — DEC-29
- [x] Landing, Plan, Routes, Route details, Recommendation, Heatmap (0–48 h slider), About, 404
- [x] Location search with candidate picking; client validation mirroring the backend; backend 400s mapped to fields
- [x] Loading, validation, error (per API code), incomplete-weather, no-weather and no-eligible-route states with retry
- [x] Leaflet map: route lines + summary popups, risk-coloured checkpoints + popups, canvas corridor heatmap restyled in place
- [x] Brand asset slots with restrained fallbacks (`frontend/src/assets/brand.ts`) — DEC-40
- [x] Vitest: 95 passed (Phase 1 status tests kept); ESLint, Prettier, `tsc -b`, build clean; vendor chunks split

## M9 — QA (done 2026-10-12)

- [x] Backend 241 mocked tests, coverage 97%; live Open-Meteo passed; 7 TomTom live tests skipped (no key)
- [x] Headless-Chrome run of the full flow (real backend, live weather, synthetic routes): no console errors; slider made 0 requests over 24 steps
- [x] Layout reviewed at 1440 × 900 and 375 × 812 for every page; no horizontal page scroll
- [x] Bugs found and fixed during QA: `.overline` class clash, mobile grid overflow, mobile map padding, toggle knob, long arrival text, identical "Find" button names, accessible-name spacing, retry without a stored request
- [x] Secret checks: no key or TomTom URL in the bundle; only `.env.example` files tracked; no key in logs or responses
- [x] TomTom live verification and route-count evidence — done in M11

## M10 — Deployment (readiness 2026-10-12, deployed 2026-10-13)

- [x] README (setup, tests, verification log, deployment, attribution, limitations), `docs/DEMO_SCRIPT.md`
- [x] Production settings (TLS proxy, HSTS, SSL redirect, X-Frame-Options); `check --deploy` clean with production env
- [x] `.env.example` files complete; SPA rewrites (`public/_redirects`, `vercel.json`); gunicorn start command
- [x] Docs reconciled with the code (architecture, test plan, traceability, decisions)
- [x] Deployed: frontend https://weather-routing-planner.vercel.app, backend https://weather-routing-api-va.onrender.com
- [ ] Record the Loom walkthrough (`docs/DEMO_SCRIPT.md`)

## M11 — Final integration verification (done 2026-10-12)

Verified against live services:
- [x] `backend/.env` loaded (DEBUG true locally; key 32 chars, read only by the backend; file Git-ignored)
- [x] `pytest -m live -s`: 8 passed — **3 TomTom routes for each of the 5 evidence trips** (VF-13)
- [x] Real API through the running server: geocode, plan (25 mi and 10 mi), unroutable trip → 422
- [x] Headless-Chrome runs with real data at 1440 × 900 and 375 × 812: every workflow; slider 0 requests; browser never calls TomTom
- [x] Secret scan of all committable files and the bundle: key absent; missing key → clear 503

Problems found and fixed (each with a regression test):
- [x] Open-Meteo counts every location (600/min) → a real plan returned `NO_WEATHER_DATA` labelled "partial", and 10-mi plans always exceeded the limit. Fix: cell cap 400 → 200 (+ unbuffered 1° tier), checkpoints fetched before cells, no 429 retry, rate-limit hint, separate `CORRIDOR_WEATHER_PARTIAL` (DEC-34, DEC-52, DEC-53)
- [x] Geocoder offered whole states ("Denvr, CA" → "California") → state/country results dropped (DEC-54)
- [x] Mobile recommendation page scrolled sideways (444 px): `sr-only` labels escaped the table scroll area → wrappers made `relative`
- [x] gunicorn timeout 60 s could cut a retried routing request → 120 s (DEC-55)
- [x] Sparse TomTom `progress[]` now covered by a service-level test (VF-12)

Checks: backend 249 passed (98% coverage), live 8 passed; frontend 96 passed; ruff, ESLint, Prettier, `tsc -b`, build, `check --deploy` clean.

Not verified live (tests only): TomTom 401/403/429/5xx error bodies; real No Travel/Severe weather (forecasts were calm).

## Assets to supply

- [ ] Logo mark — square SVG, 64 × 64 viewBox, works on navy and white → `frontend/public/brand/logo-mark.svg`, set `BRAND_LOGO_SRC`
- [ ] Landing illustration — 1760 × 1240 px WebP/PNG ≤ 300 KB → `frontend/public/brand/hero.webp`, set `HERO_ILLUSTRATION_SRC`
- [ ] (Optional) favicon — 32 × 32 SVG → `frontend/public/favicon.svg`

## M12 — Production weather investigation (2026-10-13)

- [x] Deployed frontend (Vercel) ↔ backend (Render) verified: CORS, HTTPS, health, geocoding, TomTom routing, UI at 1440/375 px
- [x] Root-cause evidence for production weather failure (VF-17): HTTP 429 at any volume from Render only; no quota headers; per-IP limits (Open-Meteo) + shared regional egress IPs (Render)
- [x] DEC-58 (`1433917`): keep/log/show Open-Meteo's 429 reason; advice follows it; cells cache-only after a refusal; backend 257 passed
- [x] DEC-58 deployed (`1433917`); Open-Meteo's reason read: "Daily API request limit exceeded. Please try again tomorrow."
- [x] Fix chosen: new Render service in Virginia → full weather (VF-18); Vercel now points at it
- [ ] Suspend the old Oregon Render service
- [ ] Permanent fix if Virginia's quota ever runs out: paid Open-Meteo key or browser-side weather (B-4)

## Blockers (see `docs/DECISIONS.md` §8)

- [x] ~~B-1 TomTom API key~~ — resolved 2026-10-12
- [ ] B-2 TomTom terms to be read by the user (OPEN-10)
- [x] ~~B-3 Hosting and deployment~~ — resolved 2026-10-13
- [ ] B-4 Open-Meteo shared-IP quota — mitigated (Virginia region), permanent fix open
