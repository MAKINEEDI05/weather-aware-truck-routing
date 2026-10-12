"""Hand-made test data builders (`make_*`). Used only by tests; never shown in the app."""

from __future__ import annotations

from datetime import UTC, datetime

from trips.domain.geo import METERS_PER_MILE, haversine_m
from trips.domain.risk import assess
from trips.domain.types import (
    Checkpoint,
    HourlySeries,
    LatLon,
    ProgressPoint,
    ProviderRoute,
    RiskAssessment,
    RiskLevel,
    RouteForRanking,
    RouteMetrics,
)

DEPARTURE = datetime(2026, 10, 14, 13, 0, tzinfo=UTC)
CHICAGO = LatLon(41.8842, -87.6324)
DENVER = LatLon(39.7392, -104.9903)


def make_line(start: LatLon, end: LatLon, segments: int) -> tuple[LatLon, ...]:
    return tuple(
        LatLon(
            start.lat + (end.lat - start.lat) * k / segments,
            start.lon + (end.lon - start.lon) * k / segments,
        )
        for k in range(segments + 1)
    )


def make_progress(
    points: tuple[LatLon, ...], speed_mph: float = 60.0, every: int = 1
) -> tuple[ProgressPoint, ...]:
    """Cumulative haversine distance and constant-speed time at every `every`-th point."""
    progress: list[ProgressPoint] = []
    distance = 0.0
    for index, point in enumerate(points):
        if index:
            distance += haversine_m(points[index - 1], point)
        if index % every == 0 or index == len(points) - 1:
            time_s = distance / METERS_PER_MILE / speed_mph * 3600
            progress.append(ProgressPoint(index, distance, time_s))
    return tuple(progress)


def make_provider_route(
    provider_index: int = 0,
    start: LatLon = CHICAGO,
    end: LatLon = DENVER,
    segments: int = 400,
    speed_mph: float = 60.0,
) -> ProviderRoute:
    points = make_line(start, end, segments)
    progress = make_progress(points, speed_mph)
    return ProviderRoute(
        provider_index=provider_index,
        length_m=progress[-1].distance_m,
        travel_time_s=round(progress[-1].time_s),
        traffic_delay_s=0,
        points=points,
        progress=progress,
    )


def make_assessment(level: RiskLevel) -> RiskAssessment:
    return RiskAssessment(
        overall=level, wind=level, rain=level, snow=level, load_adjusted=False, reasons=()
    )


def make_checkpoint(level: RiskLevel, covered_mi: float, mile: float = 0.0) -> Checkpoint:
    return Checkpoint(
        index=0,
        mile=mile,
        point=LatLon(40.0, -100.0),
        covered_mi=covered_mi,
        eta_utc=DEPARTURE,
        weather=None,
        risk=make_assessment(level),
    )


def make_metrics(
    severe: float = 0.0,
    high: float = 0.0,
    average: float | None = 0.0,
    no_travel: float = 0.0,
    unknown: float = 0.0,
    distance: float = 100.0,
    checkpoint_count: int = 10,
    unknown_count: int | None = None,
    no_travel_count: int | None = None,
) -> RouteMetrics:
    if unknown_count is None:
        unknown_count = checkpoint_count if average is None else (1 if unknown > 0 else 0)
    if no_travel_count is None:
        no_travel_count = 1 if no_travel > 0 else 0
    low = max(0.0, distance - severe - high - no_travel - unknown)
    return RouteMetrics(
        distance_mi=distance,
        low_mi=low,
        moderate_mi=0.0,
        high_mi=high,
        severe_mi=severe,
        no_travel_mi=no_travel,
        unknown_mi=unknown,
        known_mi=distance - unknown,
        average_risk=average,
        checkpoint_count=checkpoint_count,
        unknown_count=unknown_count,
        no_travel_count=no_travel_count,
    )


def make_ranked(
    route_id: str,
    severe: float,
    high: float,
    average: float | None,
    travel_time_s: int,
    no_travel: float = 0.0,
    provider_index: int | None = None,
    unknown: float = 0.0,
) -> RouteForRanking:
    return RouteForRanking(
        id=route_id,
        provider_index="ABCDE".index(route_id) if provider_index is None else provider_index,
        metrics=make_metrics(
            severe=severe, high=high, average=average, no_travel=no_travel, unknown=unknown
        ),
        travel_time_s=travel_time_s,
    )


def make_series(
    point: LatLon,
    start: datetime,
    hours: int,
    wind: float | None = 10.0,
    rain: float | None = 0.0,
    snow: float | None = 0.0,
) -> HourlySeries:
    epoch0 = int(start.timestamp())
    return HourlySeries(
        requested=point,
        grid_point=point,
        times=tuple(epoch0 + 3600 * k for k in range(hours)),
        wind_mph=(wind,) * hours,
        rain_in=(rain,) * hours,
        snow_in=(snow,) * hours,
    )


def assess_level(wind: float, rain: float, snow: float, load: float) -> RiskLevel:
    return assess(wind, rain, snow, load).overall
