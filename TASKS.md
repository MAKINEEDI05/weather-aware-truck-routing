# TASKS — Weather-Aware Truck Routing

Progress tracker. Design and acceptance criteria live in [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md).
An item is checked only when it was run and its result observed.

| Implementation phase              | Blueprint §11 phase | Status          |
| --------------------------------- | ------------------- | --------------- |
| Phase 1 — Project foundation      | Phase 3 — Setup     | Done (2026-10-12), awaiting review |
| Routing and route options         | Phase 4             | Not started     |
| Checkpoints and forecasts         | Phase 5             | Not started     |
| Risk and recommendation           | Phase 6             | Not started     |
| Map, markers, summaries, heatmap  | Phase 7             | Not started     |
| Slider and full integration       | Phase 8             | Not started     |
| Tests, edge cases, failures       | Phase 9             | Not started     |
| Deployment, README, Loom          | Phase 10            | Not started     |

## Phase 1 — Project foundation

### Tasks

- [x] P3-T1 Root `.gitignore`, `.editorconfig`
- [x] P3-T2 Backend venv, Django project `config`, app `trips`
- [x] P3-T3 Settings from environment variables, CORS allowlist, console logging, `.env.example`
- [x] P3-T4 `GET /api/v1/health/` (plus `/api/health/` alias)
- [x] P3-T5 Vite React-TS + Tailwind + empty Leaflet map in a dashboard shell
- [x] P3-T6 Frontend calls the health endpoint and shows the connection status (with retry and timeout)
- [x] P3-T7 ruff, ESLint, Prettier, pytest, Vitest configured with passing tests
- [x] README stub

### Acceptance (verified 2026-10-12)

- [x] `curl http://127.0.0.1:8000/api/v1/health/` → 200 `{"status":"ok","version":"0.1.0"}`
- [x] Browser (headless Chrome) shows the map and "API: ok"; with the backend stopped shows
      "API: unreachable", an explanation and Retry
- [x] Layout checked at 1440 px and 375 px
- [x] CORS: `http://localhost:5173` allowed; unknown origins get no CORS header
- [x] Backend: `pytest -m "not live"` 6 passed; `ruff check` and `ruff format --check` clean;
      `manage.py check` no issues
- [x] Frontend: Vitest 13 passed; ESLint clean; Prettier clean; `npm run build` succeeds
- [x] `.env` files are ignored by `.gitignore` (checked with `git check-ignore`)
- [ ] `git ls-files` contains no `.env` — **pending: the folder is not yet a Git repository**

### Decisions and deviations made in this phase

- **React 19 + React Leaflet 5** instead of the blueprint's React 18 + React Leaflet 4
  (the blueprint marked this "[UNVERIFIED — Phase 3]"). React Leaflet 5 requires React 19.
- **TypeScript 6.0.3**, not 7.x: `typescript-eslint` 8.71 supports `typescript <6.1`; the
  official Vite template also pins TypeScript ~6.0.
- **Django 5.2.18 LTS** (blueprint: "Django 5"). Supports Python 3.10–3.14.
- **No database configured** (`DATABASES = {}`). Django needs neither SQLite nor `migrate` for
  this app set; this resolves the blueprint §10.1 Phase 3 check.
- **Health path:** the blueprint contract is `/api/v1/health`; the Phase 1 request named
  `/api/health/`. Both are served by the same view; the frontend uses the versioned path. Paths
  end in `/` (Django convention).
- **Secret key:** settings refuse to start without `DJANGO_SECRET_KEY` unless `DJANGO_DEBUG=true`,
  in which case a dev-only key is used. Tests use `config/settings_test.py` so they pass on a clean
  clone without `.env`.
- **`python-dotenv`** loads `backend/.env` locally; it never overrides real environment variables.
- Not added yet because nothing uses them: `requests`, `responses`, `gunicorn`, `pytest-cov`.

## Open setup items

- [ ] Initialise / clone the Git repository and commit (owner: user)
- [ ] Create a TomTom API key before the routing phase (blueprint §20)
