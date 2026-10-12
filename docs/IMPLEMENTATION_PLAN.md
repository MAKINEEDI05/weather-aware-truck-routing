# Implementation plan

Milestones follow dependency order. Each milestone ends with its checks run and
[`TASKS.md`](../TASKS.md) updated. This plan replaces blueprint §11 Phases 4–10 for execution; the
blueprint's phase numbers are shown for cross-reference.

| # | Milestone | Blueprint | Depends on |
|---|---|---|---|
| M0 | Project foundation | Phase 3 | — |
| M1 | Documentation set (`docs/`) | — | M0 |
| M2 | Risk engine | Phase 6 (P6-T1) | M1 |
| M3 | Route profile, checkpoints, ETAs, forecast lookup, metrics, ranking, recommendation, corridor (pure domain) | Phases 5–6 | M2 |
| M4 | TomTom integration (geocode, routes) + HTTP helper + typed errors | Phase 4 | M3 types |
| M5 | Open-Meteo integration (batching, cache, units, retries) | Phase 5 | M3 types |
| M6 | Planner + API (validation, presenters, error handler, throttles) | Phases 4–6 | M3–M5 |
| M7 | Frontend: shell, routing, design tokens, landing, About | Phases 7–8 | M1 |
| M8 | Frontend: trip planner, routes map, route details, recommendation, heatmap + slider, states | Phases 7–8 | M6, M7 |
| M9 | QA: full test runs, screenshots at 375/1440, security checks, live checks | Phase 9 | M8 |
| M10 | Deployment readiness: production settings, README, Loom script, docs reconciled with code | Phase 10 (no deploy) | M9 |

## Acceptance criteria per milestone

**M0 — done (2026-10-12).** Health endpoint, frontend status indicator, lint/test/build green.

**M1.** Seven documents exist; contradictions are listed in `DECISIONS.md` §5; the documents
agree with one another (API contract ↔ architecture ↔ requirements ↔ test plan).

**M2.** `domain/risk.py` implements REQUIREMENTS §4 exactly; every boundary row in TEST_PLAN
§2.1 passes; invalid values → missing → UNKNOWN (never Low).

**M3.**
- Checkpoint table (TEST_PLAN §2.3) passes, including the property test (Σ covered = D).
- ETAs non-decreasing; last ETA = departure + travel time ± 60 s.
- Forecast-hour table (§2.4) passes.
- Ranking matrix K1–K17 passes; the ranking key contains only the PDF criteria plus the
  documented final tie-break (code review).
- Corridor tests pass.

**M4.** Synthetic-fixture parsing tests pass. Error mapping is tested for each status. No key in
logs (`caplog`). The live test exists and skips without a key.

**M5.** Recorded-fixture parsing passes; batching, partial failure, unit mismatch and cache tests
pass; a live Open-Meteo test passes.

**M6.**
- Validation matrix passes, and every error code in API_CONTRACT §5 has a test.
- Contract test checks all response keys and that corridor arrays have length 49.
- Planner integration tests pass.
- `manage.py check --deploy` has no errors with production-like env.

**M7–M8.**
- Every page in DESIGN_SYSTEM §9 exists and works with real API data.
- Route and checkpoint selection work, and the slider changes the heatmap without network
  requests.
- All §2.5 states render.
- Frontend tests in TEST_PLAN §7 pass; lint, format and build are clean.

**M9.**
- Backend and frontend suites are green, and coverage is reported for `trips/domain`.
- Headless Chrome screenshots at 375 and 1440 px are reviewed for every page.
- Secret checks (§14.1 of the blueprint) pass.
- Live checks are run where credentials allow, and the results are recorded.

**M10.** README covers setup, tests, deployment, attribution, decisions, limitations and the
verification log. The Loom script exists. Docs match the code (re-read after the final changes).

## Completion checks (definition of done)

- [ ] Every FR and NFR in `REQUIREMENTS.md` §8 points at code and at least one test.
- [ ] `pytest -m "not live"` and `npm test -- --run` pass on a clean checkout.
- [ ] Lint, format and type checks are clean; `npm run build` succeeds.
- [ ] Every external integration has an explicit verification status (live / mocked-only) in the README.
- [ ] UI checked at 375 px and 1440 px.
- [ ] No secrets in Git, the bundle, logs or responses.
- [ ] Remaining blockers listed in `DECISIONS.md` §8.

## Risks to the plan

| Risk | Mitigation |
|---|---|
| No TomTom key (B-1) | Resolved 2026-10-12: key added; `pytest -m live` 8 passed |
| TomTom returns < 3 routes (OPEN-12) | Show the real count and a warning (DEC-47); fallback only after evidence |
| Open-Meteo quota (OPEN-7) | Batching, 30-min cache, cell cap, throttle |
| Heatmap performance | Canvas renderer, in-place `setStyle`, ≤ 200 cells (DEC-34) |
| Open-Meteo per-location quota (VF-11) | Cell cap 200, checkpoints fetched first, no 429 retry, cache (DEC-34, DEC-52, DEC-53) |
