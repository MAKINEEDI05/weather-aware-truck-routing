# Loom walkthrough script (about 9 minutes)

Record against the **hosted** app with a real TomTom key. Show only real behaviour: if the live
weather is calm, say so and demonstrate the rules through the tests instead.

**Before recording**
- [ ] Backend warmed up: open https://weather-routing-api-va.onrender.com/api/v1/health/ about a minute before (free instance sleeps).
- [ ] App open at https://weather-routing-planner.vercel.app.
- [ ] Demo trip Chicago, IL → Denver, CO plans successfully; note how many routes TomTom returns.
- [ ] DevTools Network panel ready (filter out map tiles).
- [ ] A terminal with `backend/` and the venv active.

| Time | Segment | What to show and say |
|---|---|---|
| 0:00–0:40 | Problem | Landing page. "Pick the safest truck route from weather, load and time. Three pieces: real routes, the forecast at each checkpoint's ETA, and a ranking you can explain." Point at the risk ramp: colour always comes with a label; Unknown is never Low. |
| 0:40–2:00 | Plan a trip | `/plan` (step 01 in the top bar): search "Springfield" to show candidate picking, then Chicago → Denver, 42,000 lb, 25 mi. Show the load scale (which wind rule applies) and the rules table. Plan; the loader states elapsed time, not fake progress. |
| 2:00–3:10 | Routes | `/routes`: the real route count (warning if fewer than 3). Each card's strip is the risk **along** the route; the four ranking criteria sit in priority order and the one a route lost on is filled. On the map, routes carry their letter; click a line for its summary, a checkpoint for ETA, values, forecast hours and reasons. |
| 3:10–4:30 | Recommendation | `/recommendation`: the explanation, the tie-break ladder (tie → tie → decides), the matrix with the losing cell filled, and the No Travel app policy. **Say how "balancing" is read:** the PDF's order is applied strictly — risk first, travel time only breaks ties — so one Moderate checkpoint outranks hours of driving; the text says when a losing route was faster ("travel time is only the fourth priority"). |
| 4:30–5:00 | Interval | Edit trip → 10 mi → plan again: more checkpoints, same covered-miles method (Σ covered = route length). |
| 5:00–6:00 | Heatmap | `/heatmap`: drag the slider 0 → 48 h with the Network panel open (no requests). The histogram shows corridor risk per hour; the bar under it is the selected route's time on the road. Long trips use a 0.5° band along the routes (DEC-57). Click a cell. |
| 6:00–6:40 | Reload | Reload the page: the trip returns with "Restored after reload" and its calculation time; the Network panel shows no plan request. Change the load → "Outdated results" until re-planned. **New trip** clears it (DEC-56). |
| 6:40–7:40 | Code | `backend/trips/domain/risk.py` (quoted PDF table, half-open wind ranges, strict load rules); `recommend.py` (`RANKING_CRITERIA`, eligibility separate from ranking); `frontend/src/state/tripStorage.ts` (versioned, validated restore). |
| 7:40–8:30 | Tests | `pytest -m "not live" -q` (250) and `npm test -- --run` (127); open `test_risk.py` boundary rows and `test_recommend.py` K1–K17. |
| 8:30–9:00 | Limits | Continuous-driving ETAs, grid-cell forecasts, Open-Meteo free-tier limits, restored results are labelled and expire after 12 h, open questions in `docs/DECISIONS.md` (OPEN-10). |
