// Mirror of docs/API_CONTRACT.md. Nullable fields are typed `T | null`.

/** Response of `GET /api/v1/health/`. */
export interface HealthResponse {
  status: 'ok'
  version: string
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'NO_TRAVEL' | 'UNKNOWN'
export type RecommendationStatus = 'RECOMMENDED' | 'NO_ELIGIBLE_ROUTE' | 'NO_WEATHER_DATA'
export type DecidedBy =
  'severe_miles' | 'high_miles' | 'average_risk' | 'travel_time' | 'provider_order'
export type CheckpointInterval = 10 | 25 | 50
export type WarningCode =
  | 'FEWER_THAN_THREE_ROUTES'
  | 'WEATHER_PARTIAL'
  | 'WEATHER_UNAVAILABLE'
  | 'CORRIDOR_WEATHER_PARTIAL'
  | 'INCOMPLETE_WEATHER_DATA'
  | 'CORRIDOR_COARSENED'
  | 'ROUTE_FALLBACK_USED'

export interface Place {
  label: string
  lat: number
  lon: number
}

export interface GeocodeResult extends Place {
  detail: string
}

export interface GeocodeResponse {
  results: GeocodeResult[]
}

export interface PlanRequest {
  origin: Place
  destination: Place
  departure_time: string
  load_weight_lb: number
  checkpoint_interval_mi: CheckpointInterval
}

export interface CheckpointWeather {
  provider_grid_point: { lat: number; lon: number }
  wind_mph: number | null
  wind_hour: string
  rain_in_hr: number | null
  snow_in_hr: number | null
  precip_hour: string
}

export interface CheckpointRisk {
  overall: RiskLevel
  wind: RiskLevel
  rain: RiskLevel
  snow: RiskLevel
  load_adjusted: boolean
  reasons: string[]
}

export interface Checkpoint {
  index: number
  mile: number
  lat: number
  lon: number
  covered_mi: number
  eta: string
  weather: CheckpointWeather | null
  risk: CheckpointRisk
}

export interface RouteMetrics {
  low_mi: number
  moderate_mi: number
  high_mi: number
  severe_mi: number
  no_travel_mi: number
  unknown_mi: number
  known_mi: number
  average_risk: number | null
}

export interface Route {
  id: string
  label: string
  source: 'provider' | 'via_point_fallback'
  provider_index: number
  distance_mi: number
  travel_time_s: number
  traffic_delay_s: number
  departure_time: string
  arrival_time: string
  geometry: [number, number][]
  checkpoints: Checkpoint[]
  metrics: RouteMetrics
  rank: number
  eligible: boolean
  is_recommended: boolean
}

export interface Comparison {
  other_route: string
  other_rank: number
  other_eligible: boolean
  decided_by: DecidedBy
  recommended_value: number | null
  other_value: number | null
}

export interface Recommendation {
  status: RecommendationStatus
  route_id: string | null
  ranking: string[]
  comparisons: Comparison[]
  ineligible: { route: string; no_travel_mi: number }[]
  explanation: string
}

export interface CorridorCell {
  lat: number
  lon: number
  risk: number[]
  wind_mph: (number | null)[]
  rain_in_hr: (number | null)[]
  snow_in_hr: (number | null)[]
}

export interface Corridor {
  start_time: string
  hours: number
  cell_size_deg: number
  cells: CorridorCell[]
}

export interface PlanWarning {
  code: WarningCode | string
  message: string
}

export interface PlanResponse {
  request: {
    origin: Place
    destination: Place
    departure_time: string
    load_weight_lb: number
    checkpoint_interval_mi: CheckpointInterval
  }
  routes: Route[]
  recommendation: Recommendation
  corridor: Corridor
  warnings: PlanWarning[]
  meta: {
    providers: { routing: string; weather: string }
    rules_version: string
    app_version: string
    generated_at: string
    route_count: number
  }
}

export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> }
}
