# Test fixtures

| File / source | Kind | How it was made |
|---|---|---|
| `open_meteo_3_locations.json` | **Recorded** | Live Open-Meteo call on 2026-10-12 for Chicago, Denver and a Kansas point, 2026-10-14T13:00 → 2026-10-16T13:00 UTC (49 hours). No API key involved. |
| `../synthetic_tomtom.py` | **Synthetic** | Built by hand from TomTom's documented response schema (docs/DECISIONS.md VF-8, VF-9), originally because no key was available; kept for fast, offline tests. Polylines are straight segments between approximate city coordinates, **not real roads**. |

**Live status (2026-10-12):** the real TomTom response format was verified with `pytest -m live`
(8 passed; docs/DECISIONS.md VF-12 – VF-15). Real routes are 100–350 KB of geometry each, so they
are not committed as fixtures. The synthetic builder stays for unit and service tests. Its shape
matches the live format, including sparse `progress[]`
(`test_tomtom.py::test_sparse_progress_like_the_live_api`).

Synthetic or recorded data is used only in tests and is never shown in the application.
