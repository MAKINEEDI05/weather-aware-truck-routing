# Loom walkthrough script (about 8 minutes)

Record against the **hosted** app with a real TomTom key. Show only real behaviour: if the live
weather is calm, say so and demonstrate the rules through the tests instead.

**Before recording**
- [ ] Backend warmed up (`/api/v1/health/` returns 200).
- [ ] Demo trip Chicago, IL → Denver, CO plans successfully; note how many routes TomTom returns.
- [ ] DevTools Network panel ready (filter out map tiles).
- [ ] A terminal with `backend/` and the venv active.

| Time | Segment | What to show and say |
|---|---|---|
| 0:00–0:45 | Problem | Landing page. "Pick the safest truck route from weather, load and time. Three pieces: real routes, forecast at each ETA, a ranking you can explain." |
| 0:45–2:15 | Plan a trip | `/plan`: search "Springfield" to show candidate picking, then Chicago → Denver, 42,000 lb, 25 mi. Point out the rules table and the "within 7 days" window. Plan. |
| 2:15–3:15 | Routes | `/routes`: the route count from TomTom (and the warning if fewer than 3). Cards in rank order; Recommended / Not recommended badges; click a route line for its summary; click a checkpoint for ETA, values, forecast hours and reasons. |
| 3:15–4:15 | Recommendation | `/recommendation`: the explanation sentence, the decision trace (tie → tie → decides), the comparison table with the losing cell highlighted, and the No Travel app policy. |
| 4:15–4:45 | Interval | Edit trip → 10 mi → plan again: more checkpoints, same covered-miles method (Σ covered = route length). |
| 4:45–5:45 | Heatmap | `/heatmap`: drag the slider 0 → 48 h with the Network panel open (no requests). Explain "heatmap = whole corridor at one clock hour; dots = each point at the truck's ETA". Click a cell. |
| 5:45–6:45 | Code | `backend/trips/domain/risk.py` (quoted PDF table, half-open wind ranges, strict load rules); `recommend.py` (`RANKING_CRITERIA`, eligibility separate from ranking). |
| 6:45–7:30 | Tests | `pytest -m "not live" -q` and `npm test -- --run`; open `test_risk.py` boundary rows and `test_recommend.py` K1–K17. |
| 7:30–8:00 | Limits | Continuous-driving ETAs, grid-cell forecasts, free-tier limits, open questions in `docs/DECISIONS.md`. |
