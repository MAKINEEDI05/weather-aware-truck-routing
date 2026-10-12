"""Domain types. Pure data: no Django, no network.

Units: miles, seconds, mph, inches per hour, pounds. Datetimes are timezone-aware UTC.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class RiskLevel(StrEnum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    SEVERE = "SEVERE"
    NO_TRAVEL = "NO_TRAVEL"
    UNKNOWN = "UNKNOWN"

    @property
    def label(self) -> str:
        return _RISK_LABELS[self]


_RISK_LABELS = {
    RiskLevel.LOW: "Low",
    RiskLevel.MODERATE: "Moderate",
    RiskLevel.HIGH: "High",
    RiskLevel.SEVERE: "Severe",
    RiskLevel.NO_TRAVEL: "No Travel",
    RiskLevel.UNKNOWN: "Unknown",
}

# Severity order of the known levels (LOW < … < NO_TRAVEL). UNKNOWN is not ordered.
KNOWN_LEVELS: tuple[RiskLevel, ...] = (
    RiskLevel.LOW,
    RiskLevel.MODERATE,
    RiskLevel.HIGH,
    RiskLevel.SEVERE,
    RiskLevel.NO_TRAVEL,
)

# Numeric score used for "average risk" (DEC-14). UNKNOWN has no score.
RISK_SCORE: dict[RiskLevel, int] = {level: score for score, level in enumerate(KNOWN_LEVELS)}

# Compact code used in the corridor grid: 0–4 for known levels, −1 for UNKNOWN.
RISK_CODE: dict[RiskLevel, int] = {**RISK_SCORE, RiskLevel.UNKNOWN: -1}


class RecommendationStatus(StrEnum):
    RECOMMENDED = "RECOMMENDED"
    NO_ELIGIBLE_ROUTE = "NO_ELIGIBLE_ROUTE"
    NO_WEATHER_DATA = "NO_WEATHER_DATA"


class DecidedBy(StrEnum):
    SEVERE_MILES = "severe_miles"
    HIGH_MILES = "high_miles"
    AVERAGE_RISK = "average_risk"
    TRAVEL_TIME = "travel_time"
    PROVIDER_ORDER = "provider_order"


class RouteSource(StrEnum):
    PROVIDER = "provider"


@dataclass(frozen=True, slots=True)
class LatLon:
    lat: float
    lon: float


@dataclass(frozen=True, slots=True)
class Place:
    label: str
    point: LatLon
    detail: str = ""


@dataclass(frozen=True, slots=True)
class PlanCommand:
    origin: Place
    destination: Place
    departure_utc: datetime
    load_lb: float
    interval_mi: int


@dataclass(frozen=True, slots=True)
class ProgressPoint:
    """Cumulative distance and travel time at a polyline point (TomTom `progress[]`)."""

    point_index: int
    distance_m: float
    time_s: float


@dataclass(frozen=True, slots=True)
class ProviderRoute:
    provider_index: int
    length_m: float
    travel_time_s: int
    traffic_delay_s: int
    points: tuple[LatLon, ...]
    progress: tuple[ProgressPoint, ...]


@dataclass(frozen=True, slots=True)
class HourlySeries:
    """Hourly forecast for one requested location. Values may be None (missing record)."""

    requested: LatLon
    grid_point: LatLon
    times: tuple[int, ...]  # epoch seconds, UTC, on the hour
    wind_mph: tuple[float | None, ...]
    rain_in: tuple[float | None, ...]  # rain + showers (DEC-35)
    snow_in: tuple[float | None, ...]

    def index_of(self, epoch_s: int) -> int | None:
        if not self.times:
            return None
        guess = (epoch_s - self.times[0]) // 3600  # records are normally consecutive hours
        if 0 <= guess < len(self.times) and self.times[guess] == epoch_s:
            return guess
        try:
            return self.times.index(epoch_s)
        except ValueError:
            return None


@dataclass(frozen=True, slots=True)
class WeatherAtCheckpoint:
    grid_point: LatLon
    wind_mph: float | None
    wind_hour: datetime
    rain_in_hr: float | None
    snow_in_hr: float | None
    precip_hour: datetime


@dataclass(frozen=True, slots=True)
class RiskAssessment:
    overall: RiskLevel
    wind: RiskLevel
    rain: RiskLevel
    snow: RiskLevel
    load_adjusted: bool
    reasons: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CheckpointPlacement:
    """A checkpoint's position and ETA, before weather is attached."""

    index: int
    mile: float
    point: LatLon
    covered_mi: float
    eta_utc: datetime


@dataclass(frozen=True, slots=True)
class Checkpoint:
    index: int
    mile: float
    point: LatLon
    covered_mi: float
    eta_utc: datetime
    weather: WeatherAtCheckpoint | None
    risk: RiskAssessment


@dataclass(frozen=True, slots=True)
class RouteMetrics:
    distance_mi: float
    low_mi: float
    moderate_mi: float
    high_mi: float
    severe_mi: float
    no_travel_mi: float
    unknown_mi: float
    known_mi: float
    average_risk: float | None
    # Counts make eligibility and "no weather" independent of mile rounding.
    checkpoint_count: int
    unknown_count: int
    no_travel_count: int


@dataclass(frozen=True, slots=True)
class RouteForRanking:
    id: str
    provider_index: int
    metrics: RouteMetrics
    travel_time_s: int


@dataclass(frozen=True, slots=True)
class Comparison:
    other_route: str
    other_rank: int
    other_eligible: bool
    decided_by: DecidedBy
    recommended_value: float | int | None
    other_value: float | int | None


@dataclass(frozen=True, slots=True)
class Ineligible:
    route: str
    no_travel_mi: float


@dataclass(frozen=True, slots=True)
class Recommendation:
    status: RecommendationStatus
    route_id: str | None
    ranking: tuple[str, ...]
    comparisons: tuple[Comparison, ...]
    ineligible: tuple[Ineligible, ...]
    explanation: str


@dataclass(frozen=True, slots=True)
class CorridorCell:
    lat: float
    lon: float
    risk: tuple[int, ...]
    wind_mph: tuple[float | None, ...]
    rain_in_hr: tuple[float | None, ...]
    snow_in_hr: tuple[float | None, ...]


@dataclass(frozen=True, slots=True)
class CorridorGrid:
    start_utc: datetime
    hours: int
    cell_size_deg: float
    cells: tuple[CorridorCell, ...]


@dataclass(frozen=True, slots=True)
class Warning:
    code: str
    message: str


@dataclass(frozen=True, slots=True)
class PlannedRoute:
    id: str
    source: RouteSource
    provider_index: int
    distance_mi: float
    travel_time_s: int
    traffic_delay_s: int
    departure_utc: datetime
    arrival_utc: datetime
    geometry: tuple[LatLon, ...]
    checkpoints: tuple[Checkpoint, ...]
    metrics: RouteMetrics
    rank: int
    eligible: bool
    is_recommended: bool

    @property
    def label(self) -> str:
        return f"Route {self.id}"


@dataclass(frozen=True, slots=True)
class PlanResult:
    command: PlanCommand
    routes: tuple[PlannedRoute, ...]
    recommendation: Recommendation
    corridor: CorridorGrid
    warnings: tuple[Warning, ...]
    generated_at: datetime
