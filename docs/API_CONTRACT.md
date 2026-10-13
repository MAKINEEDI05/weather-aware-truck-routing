# API contract

Base path: `/api/v1/`. JSON only. All paths end with `/`.

**Conventions**

| Item | Convention |
|---|---|
| Distances | miles (`*_mi`) |
| Durations | seconds (`*_s`), integers |
| Wind | mph |
| Rain, snow | inches per hour (`*_in_hr`); the hourly total for the hour containing the ETA |
| Weight | pounds (`*_lb`) |
| Coordinates | WGS84 decimal degrees; geometry `[lat, lon]` |
| Timestamps in responses | UTC ISO 8601 with `Z`, second precision, e.g. `2026-10-14T13:00:00Z` |
| Timestamps in requests | ISO 8601 **with** offset, e.g. `2026-10-14T08:00:00-05:00` |
| Rounding in responses | miles 2 dp · average risk 4 dp · coordinates 5 dp (geometry) / 6 dp (checkpoints) · provider weather values as received |
| Compression | gzip when the client sends `Accept-Encoding: gzip` |

## 1. `GET /api/v1/health/` (alias `GET /api/health/`)

Liveness; never calls providers.

```json
{ "status": "ok", "version": "1.0.0" }
```

## 2. `GET /api/v1/geocode/?q=<text>`

US-only place search (TomTom Geocode, `countrySet=US`, `limit=5`). Throttle: 30/min per client.

`q`: required, 2–120 characters after trimming.

**200**
```json
{
  "results": [
    { "label": "Springfield, IL", "detail": "Sangamon County, Illinois", "lat": 39.79923, "lon": -89.64404 }
  ]
}
```
`detail` may be an empty string. Duplicate label + coordinate pairs are removed, and country- or
state-level results (TomTom `entityType` `Country` / `CountrySubdivision`) are dropped (DEC-54).

**Errors:** 400 `INVALID_INPUT` · 404 `LOCATION_NOT_FOUND` · 429 `TOO_MANY_REQUESTS` · 502 / 503 / 504
(see §5).

## 3. `POST /api/v1/trips/plan/`

Throttle: 10/min per client.

### 3.1 Request

```json
{
  "origin":      { "label": "Chicago, IL", "lat": 41.8842, "lon": -87.6324 },
  "destination": { "label": "Denver, CO",  "lat": 39.7392, "lon": -104.9903 },
  "departure_time": "2026-10-14T08:00:00-05:00",
  "load_weight_lb": 42000,
  "checkpoint_interval_mi": 25
}
```

The validation rules are in [`REQUIREMENTS.md` §5](REQUIREMENTS.md#5-input-validation).

### 3.2 Response 200 (structure; values illustrative)

```json
{
  "request": {
    "origin": { "label": "Chicago, IL", "lat": 41.8842, "lon": -87.6324 },
    "destination": { "label": "Denver, CO", "lat": 39.7392, "lon": -104.9903 },
    "departure_time": "2026-10-14T13:00:00Z",
    "load_weight_lb": 42000.0,
    "checkpoint_interval_mi": 25
  },
  "routes": [
    {
      "id": "A",
      "label": "Route A",
      "source": "provider",
      "provider_index": 0,
      "distance_mi": 1003.41,
      "travel_time_s": 54120,
      "traffic_delay_s": 0,
      "departure_time": "2026-10-14T13:00:00Z",
      "arrival_time": "2026-10-15T04:02:00Z",
      "geometry": [[41.8842, -87.6324], [41.88001, -87.70012]],
      "checkpoints": [
        {
          "index": 0,
          "mile": 0.0,
          "lat": 41.8842,
          "lon": -87.6324,
          "covered_mi": 12.5,
          "eta": "2026-10-14T13:00:00Z",
          "weather": {
            "provider_grid_point": { "lat": 41.8795, "lon": -87.6497 },
            "wind_mph": 18.2,
            "wind_hour": "2026-10-14T13:00:00Z",
            "rain_in_hr": 0.02,
            "snow_in_hr": 0.0,
            "precip_hour": "2026-10-14T13:00:00Z"
          },
          "risk": {
            "overall": "LOW",
            "wind": "LOW",
            "rain": "LOW",
            "snow": "LOW",
            "load_adjusted": false,
            "reasons": ["Wind 18.2 mph → Low", "Rain 0.02 in/hr → Low", "Snow 0.00 in/hr → Low"]
          }
        }
      ],
      "metrics": {
        "low_mi": 878.41, "moderate_mi": 100.0, "high_mi": 25.0,
        "severe_mi": 0.0, "no_travel_mi": 0.0, "unknown_mi": 0.0,
        "known_mi": 1003.41, "average_risk": 0.1495
      },
      "rank": 2,
      "eligible": true,
      "is_recommended": false
    }
  ],
  "recommendation": {
    "status": "RECOMMENDED",
    "route_id": "B",
    "ranking": ["B", "A", "C"],
    "comparisons": [
      {
        "other_route": "A", "other_rank": 2, "other_eligible": true,
        "decided_by": "high_miles", "recommended_value": 0.0, "other_value": 25.0
      }
    ],
    "ineligible": [{ "route": "C", "no_travel_mi": 25.0 }],
    "explanation": "Route B is recommended. Route A ties on Severe miles (0.0) but has more High miles (25.0 vs 0.0). …"
  },
  "corridor": {
    "start_time": "2026-10-14T13:00:00Z",
    "hours": 49,
    "cell_size_deg": 0.25,
    "cells": [
      {
        "lat": 41.875, "lon": -87.625,
        "risk": [0, 0, 1, -1],
        "wind_mph": [18.2, 19.0, 26.1, null],
        "rain_in_hr": [0.0, 0.01, 0.0, null],
        "snow_in_hr": [0.0, 0.0, 0.0, null]
      }
    ]
  },
  "warnings": [
    { "code": "FEWER_THAN_THREE_ROUTES", "message": "The routing provider returned 2 routes for this trip." }
  ],
  "meta": {
    "providers": {
      "routing": "TomTom Routing API v1",
      "weather": "Open-Meteo Forecast API (CC BY 4.0)"
    },
    "rules_version": "1.1",
    "app_version": "1.0.0",
    "generated_at": "2026-10-12T10:00:00Z",
    "route_count": 3
  }
}
```

### 3.3 Field notes

- `routes` are in **provider order** and labelled A, B, C. `rank` (1 = best) follows the PDF
  priority. `ranking` lists **all** route ids in rank order; eligibility does not change it.
- `source` is always `"provider"` (no fallback routes are built, DEC-47). The enum value
  `"via_point_fallback"` is reserved.
- `distance_mi` = the route length from the provider progress profile (DEC-37). `arrival_time` =
  `departure_time + travel_time_s`.
- `checkpoints[].weather` is `null` when no forecast series exists for that point. Inside it, any
  of `wind_mph`, `rain_in_hr` or `snow_in_hr` may be `null` (missing record). `wind_hour` and
  `precip_hour` are the forecast records looked up (DEC-24).
- `risk.wind|rain|snow|overall` ∈ `RiskLevel`. `load_adjusted` is `true` when a load rule changed
  the wind level.
- `metrics.average_risk` is `null` when `known_mi` is 0.
- `recommendation.route_id` is `null` unless `status` is `RECOMMENDED`. `comparisons` is empty
  unless `status` is `RECOMMENDED`; otherwise it has one entry per other route, in rank order.
  - `decided_by` ∈ `DecidedBy`. `recommended_value` / `other_value` are miles for
    `severe_miles` / `high_miles`, a number or `null` for `average_risk`, seconds for
    `travel_time`, and provider indexes for `provider_order`.
  - For a route ranked **above** the recommended route (possible only if it is ineligible), the
    values show where that route was better, and `other_eligible` is `false`.
- `ineligible` lists `{route, no_travel_mi}` for each route with No Travel miles, in rank order.
- `corridor.cells[].*` arrays always have exactly `hours` (49) entries for hours 0–48 after
  `start_time` = `floor_to_hour(departure)`. Risk codes: 0 LOW, 1 MODERATE, 2 HIGH, 3 SEVERE,
  4 NO_TRAVEL, −1 UNKNOWN. A cell covers `[lat ± size/2, lon ± size/2]`.

## 4. Enumerations

| Enum | Values |
|---|---|
| `RiskLevel` | `LOW`, `MODERATE`, `HIGH`, `SEVERE`, `NO_TRAVEL`, `UNKNOWN` |
| `RouteSource` | `provider` (`via_point_fallback` reserved) |
| `RecommendationStatus` | `RECOMMENDED`, `NO_ELIGIBLE_ROUTE`, `NO_WEATHER_DATA` |
| `DecidedBy` | `severe_miles`, `high_miles`, `average_risk`, `travel_time`, `provider_order` |
| Warning codes | `FEWER_THAN_THREE_ROUTES`, `WEATHER_PARTIAL` (some checkpoints), `WEATHER_UNAVAILABLE` (no checkpoint), `CORRIDOR_WEATHER_PARTIAL` (some heatmap cells), `INCOMPLETE_WEATHER_DATA`, `CORRIDOR_COARSENED` (`ROUTE_FALLBACK_USED` reserved) |

## 5. Errors (all endpoints)

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Some fields are invalid.",
    "details": { "load_weight_lb": ["Ensure this value is less than or equal to 100000."] }
  }
}
```

`details` is an object (possibly empty). For 429 and 503 `RATE_LIMITED` responses, a
`Retry-After` header (seconds) is set when known, and `details.retry_after_s` repeats it.

| HTTP | `code` | When |
|---|---|---|
| 400 | `INVALID_INPUT` | Malformed JSON, missing or invalid field, `q` length |
| 400 | `DEPARTURE_OUT_OF_RANGE` | Departure outside the DEC-31 window |
| 400 | `SAME_LOCATION` | Origin and destination < 1 mi apart |
| 404 | `LOCATION_NOT_FOUND` | Geocoder returned no US result |
| 404 | `NOT_FOUND` | Unknown API path (with `DJANGO_DEBUG=false`; in debug mode Django shows its own page) |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method |
| 415 | `INVALID_INPUT` | Non-JSON request body |
| 422 | `NO_ROUTE_FOUND` | TomTom 400 (points not connected / not near a road) |
| 429 | `TOO_MANY_REQUESTS` | This API's own throttle |
| 500 | `INTERNAL_ERROR` | Unexpected error (stack trace logged, never returned) |
| 502 | `ROUTING_CONFIGURATION_ERROR` | TomTom 401/403 (key never echoed) |
| 502 | `ROUTING_UNAVAILABLE` | TomTom 5xx, connection error, unparseable response |
| 503 | `RATE_LIMITED` | TomTom 429 |
| 503 | `ROUTING_NOT_CONFIGURED` | `TOMTOM_API_KEY` not set (DEC-32) |
| 504 | `UPSTREAM_TIMEOUT` | TomTom timeout (after one retry) |

Open-Meteo failures never fail the request. They return 200 with UNKNOWN checkpoints/cells and the
warnings `WEATHER_PARTIAL` / `WEATHER_UNAVAILABLE` (checkpoints) and/or `CORRIDOR_WEATHER_PARTIAL`
(heatmap cells). When the provider's rate limit caused the failure, the message quotes Open-Meteo's
reason and gives matching advice (DEC-58), and heatmap cells are served from cache only.

## 6. Frontend types

`frontend/src/api/types.ts` mirrors this document exactly; nullable fields are typed `T | null`.
