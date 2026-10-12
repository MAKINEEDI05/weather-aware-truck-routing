// HAND-MADE test data. Used only by tests; never rendered by the application.
import type { Checkpoint, PlanResponse, RiskLevel, Route, RouteMetrics } from '../api/types'

const DEPARTURE = '2026-10-14T13:00:00Z' // Tue 14 Oct, 08:00 CDT

function checkpoint(
  index: number,
  mile: number,
  eta: string,
  level: RiskLevel,
  wind: number | null,
): Checkpoint {
  return {
    index,
    mile,
    lat: 41 - index * 0.3,
    lon: -88 - index * 2,
    covered_mi: 25,
    eta,
    weather:
      wind === null
        ? null
        : {
            provider_grid_point: { lat: 41, lon: -88 },
            wind_mph: wind,
            wind_hour: eta.replace(/:\d\d:\d\dZ$/, ':00:00Z'),
            rain_in_hr: 0.02,
            snow_in_hr: 0,
            precip_hour: eta.replace(/:\d\d:\d\dZ$/, ':00:00Z'),
          },
    risk: {
      overall: level,
      wind: wind === null ? 'UNKNOWN' : level,
      rain: wind === null ? 'UNKNOWN' : 'LOW',
      snow: wind === null ? 'UNKNOWN' : 'LOW',
      load_adjusted: false,
      reasons:
        wind === null
          ? ['Wind: no forecast → Unknown']
          : [`Wind ${wind.toFixed(1)} mph → ${level}`],
    },
  }
}

function metrics(partial: Partial<RouteMetrics>): RouteMetrics {
  return {
    low_mi: 0,
    moderate_mi: 0,
    high_mi: 0,
    severe_mi: 0,
    no_travel_mi: 0,
    unknown_mi: 0,
    known_mi: 0,
    average_risk: 0,
    ...partial,
  }
}

function route(partial: Partial<Route> & Pick<Route, 'id' | 'provider_index'>): Route {
  return {
    label: `Route ${partial.id}`,
    source: 'provider',
    distance_mi: 1000,
    travel_time_s: 54_000,
    traffic_delay_s: 0,
    departure_time: DEPARTURE,
    arrival_time: '2026-10-15T04:00:00Z',
    geometry: [
      [41.88, -87.63],
      [39.74, -104.99],
    ],
    checkpoints: [],
    metrics: metrics({}),
    rank: 1,
    eligible: true,
    is_recommended: false,
    ...partial,
  }
}

/** Three routes: C recommended (rank 1), A runner-up (lost on High miles), B ineligible (No Travel). */
export function makePlanResponse(): PlanResponse {
  return {
    request: {
      origin: { label: 'Chicago, IL', lat: 41.8842, lon: -87.6324 },
      destination: { label: 'Denver, CO', lat: 39.7392, lon: -104.9903 },
      departure_time: DEPARTURE,
      load_weight_lb: 38_000,
      checkpoint_interval_mi: 25,
    },
    routes: [
      route({
        id: 'A',
        provider_index: 0,
        distance_mi: 1003.4,
        travel_time_s: 54_120,
        arrival_time: '2026-10-15T04:02:00Z',
        rank: 2,
        metrics: metrics({
          low_mi: 853.4,
          moderate_mi: 70,
          high_mi: 50,
          unknown_mi: 30,
          known_mi: 973.4,
          average_risk: 0.25,
        }),
        checkpoints: [
          checkpoint(0, 0, '2026-10-14T13:00:00Z', 'LOW', 9),
          checkpoint(1, 25, '2026-10-14T13:22:00Z', 'MODERATE', 27.5),
          checkpoint(2, 50, '2026-10-14T13:44:00Z', 'HIGH', 38.4),
          checkpoint(3, 75, '2026-10-14T14:06:00Z', 'UNKNOWN', null),
        ],
      }),
      route({
        id: 'B',
        provider_index: 1,
        distance_mi: 1061.0,
        travel_time_s: 58_200,
        arrival_time: '2026-10-15T05:10:00Z',
        rank: 3,
        eligible: false,
        metrics: metrics({
          low_mi: 886,
          moderate_mi: 50,
          high_mi: 75,
          severe_mi: 25,
          no_travel_mi: 25,
          known_mi: 1061,
          average_risk: 0.45,
        }),
        checkpoints: [
          checkpoint(0, 0, '2026-10-14T13:00:00Z', 'LOW', 8),
          checkpoint(1, 25, '2026-10-14T13:23:00Z', 'SEVERE', 47),
          checkpoint(2, 50, '2026-10-14T13:46:00Z', 'NO_TRAVEL', 56),
        ],
      }),
      route({
        id: 'C',
        provider_index: 2,
        distance_mi: 1048.2,
        travel_time_s: 56_100,
        arrival_time: '2026-10-15T04:35:00Z',
        rank: 1,
        is_recommended: true,
        metrics: metrics({
          low_mi: 898.2,
          moderate_mi: 125,
          high_mi: 25,
          known_mi: 1048.2,
          average_risk: 0.17,
        }),
        checkpoints: [
          checkpoint(0, 0, '2026-10-14T13:00:00Z', 'LOW', 9),
          checkpoint(1, 25, '2026-10-14T13:22:00Z', 'LOW', 20),
          checkpoint(2, 50, '2026-10-14T13:44:00Z', 'MODERATE', 31.2),
          checkpoint(3, 725, '2026-10-14T23:46:00Z', 'HIGH', 38.4),
        ],
      }),
    ],
    recommendation: {
      status: 'RECOMMENDED',
      route_id: 'C',
      ranking: ['C', 'A', 'B'],
      comparisons: [
        {
          other_route: 'A',
          other_rank: 2,
          other_eligible: true,
          decided_by: 'high_miles',
          recommended_value: 25,
          other_value: 50,
        },
        {
          other_route: 'B',
          other_rank: 3,
          other_eligible: false,
          decided_by: 'severe_miles',
          recommended_value: 0,
          other_value: 25,
        },
      ],
      ineligible: [{ route: 'B', no_travel_mi: 25 }],
      explanation:
        'Route C is recommended. Route A ties on Severe miles (0.0) but has more High miles (50.0 vs 25.0). ' +
        'It is 33 min faster, but travel time is only the fourth priority. Route B has more Severe miles ' +
        '(25.0 vs 0.0). It also has 25.0 mi of No Travel conditions, so it cannot be recommended.',
    },
    corridor: {
      start_time: DEPARTURE,
      hours: 49,
      cell_size_deg: 0.25,
      cells: [
        {
          lat: 40.875,
          lon: -100.375,
          risk: Array.from({ length: 49 }, (_, k) => (k === 12 ? 4 : k < 12 ? 0 : 1)),
          wind_mph: Array.from({ length: 49 }, (_, k) => (k === 12 ? 52.8 : 12)),
          rain_in_hr: Array.from({ length: 49 }, () => 0),
          snow_in_hr: Array.from({ length: 49 }, () => 0),
        },
        {
          lat: 41.125,
          lon: -100.375,
          risk: Array.from({ length: 49 }, () => -1),
          wind_mph: Array.from({ length: 49 }, () => null),
          rain_in_hr: Array.from({ length: 49 }, () => null),
          snow_in_hr: Array.from({ length: 49 }, () => null),
        },
      ],
    },
    warnings: [
      {
        code: 'INCOMPLETE_WEATHER_DATA',
        message: 'Some checkpoints have no forecast (Route A: 30.0 mi Unknown).',
      },
      { code: 'CORRIDOR_COARSENED', message: 'This trip uses 0.5° cells.' },
    ],
    meta: {
      providers: {
        routing: 'TomTom Routing API v1',
        weather: 'Open-Meteo Forecast API (CC BY 4.0)',
      },
      rules_version: '1.1',
      app_version: '1.0.0',
      generated_at: '2026-10-12T10:00:00Z',
      route_count: 3,
    },
  }
}

export function makeNoEligibleResponse(): PlanResponse {
  const base = makePlanResponse()
  return {
    ...base,
    routes: base.routes.map((r) => ({
      ...r,
      eligible: false,
      is_recommended: false,
      metrics: { ...r.metrics, no_travel_mi: r.id === 'A' ? 50 : r.id === 'B' ? 75 : 25 },
    })),
    recommendation: {
      status: 'NO_ELIGIBLE_ROUTE',
      route_id: null,
      ranking: ['C', 'A', 'B'],
      comparisons: [],
      ineligible: [
        { route: 'C', no_travel_mi: 25 },
        { route: 'A', no_travel_mi: 50 },
        { route: 'B', no_travel_mi: 75 },
      ],
      explanation:
        'No route can be recommended: every route has No Travel conditions (Route C 25.0 mi, Route A 50.0 mi, Route B 75.0 mi). The ranking is shown for reference. Try a different departure time.',
    },
    warnings: [],
  }
}

export function makeNoWeatherResponse(): PlanResponse {
  const base = makePlanResponse()
  return {
    ...base,
    routes: base.routes.map((r) => ({ ...r, is_recommended: false })),
    recommendation: {
      status: 'NO_WEATHER_DATA',
      route_id: null,
      ranking: ['A', 'C', 'B'],
      comparisons: [],
      ineligible: [],
      explanation:
        'No route can be recommended because no checkpoint has forecast data. The routes are shown, but they cannot be compared on weather risk.',
    },
    warnings: [
      { code: 'WEATHER_UNAVAILABLE', message: 'The weather service could not be reached.' },
    ],
  }
}

export const HEALTH_OK = { status: 'ok', version: '1.0.0' }
