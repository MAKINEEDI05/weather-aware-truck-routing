# Weather-Aware Truck Routing

A React + Django web app that helps a truck driver choose the safest route based on forecast
weather, load weight and travel time.

> **Status:** project foundation only. Routing, weather, risk scoring and the heatmap are not
> implemented yet. See [`TASKS.md`](TASKS.md) for progress and
> [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) for the full design.

## Stack

| Part     | Technology                                                           |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Leaflet + React Leaflet |
| Backend  | Python 3.12+, Django 5.2 LTS, Django REST Framework 3.18             |
| Tests    | pytest + pytest-django (backend), Vitest + React Testing Library (frontend) |

## Local setup (Linux)

Requirements: Python ≥ 3.12 and Node.js ≥ 22.22.2 (developed with Python 3.14.7 and Node 22.23.1).

### Backend (terminal 1)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env          # then set DJANGO_DEBUG=true for local development
python manage.py runserver 127.0.0.1:8000
```

Check: `curl http://127.0.0.1:8000/api/v1/health/` → `{"status":"ok","version":"0.1.0"}`

### Frontend (terminal 2)

```bash
cd frontend
npm ci
cp .env.example .env          # optional in development; defaults to http://127.0.0.1:8000/api/v1
npm run dev
```

Open <http://localhost:5173>. The header shows **API: ok** when the backend is reachable, or
**API: unreachable** with a Retry button when it is not.

## Checks

```bash
# backend/ (venv active)
ruff check . && ruff format --check . && pytest -m "not live"

# frontend/
npm run lint && npm run format:check && npm test -- --run && npm run build
```

## API

| Method | Path              | Description                                                    |
| ------ | ----------------- | -------------------------------------------------------------- |
| GET    | `/api/v1/health/` | Liveness check. Does not call external providers.               |
| GET    | `/api/health/`    | Unversioned alias of the health check.                          |

## Attribution

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
