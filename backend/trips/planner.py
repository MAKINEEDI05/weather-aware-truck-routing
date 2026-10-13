"""Orchestrates one plan request: routes → checkpoints → weather → risk → ranking → corridor.

All decisions live in `trips.domain`; this module only wires providers and domain together and
produces warnings. It never invents routes or weather.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime, timedelta

from trips.domain.checkpoints import place_checkpoints
from trips.domain.corridor import CELL_SIZES_DEG, HOURS, corridor_cells, corridor_grid
from trips.domain.forecast import lookup_weather
from trips.domain.geo import METERS_PER_MILE
from trips.domain.metrics import route_metrics
from trips.domain.profile import InvalidRouteProfile, RouteProfile, build_profile
from trips.domain.recommend import is_eligible, recommend
from trips.domain.risk import assess
from trips.domain.timeutil import HOUR, ceil_to_hour, floor_to_hour, require_utc
from trips.domain.types import (
    Checkpoint,
    PlanCommand,
    PlannedRoute,
    PlanResult,
    RecommendationStatus,
    RouteForRanking,
    RouteSource,
    Warning,
)
from trips.services import open_meteo, tomtom
from trips.services.errors import ProviderBadResponse

logger = logging.getLogger("trips.planner")

ROUTE_IDS = "ABCDEF"
EXPECTED_ROUTE_COUNT = 3


def weather_window(
    departure_utc: datetime, latest_arrival_utc: datetime
) -> tuple[datetime, datetime]:
    start = floor_to_hour(departure_utc)
    end = max(start + (HOURS - 1) * HOUR, ceil_to_hour(latest_arrival_utc))
    return start, end


def rate_limit_hint(reason: str) -> str:
    """Advice for an Open-Meteo 429, based on the provider's own reason (never assumed)."""
    said = f' Open-Meteo said: "{reason}"' if reason else ""
    lowered = reason.lower()
    if "minute" in lowered:
        advice = " Wait about a minute and plan again; forecasts already fetched are cached."
    elif "hour" in lowered:
        advice = " Try again later this hour."
    elif "daily" in lowered or "tomorrow" in lowered:
        advice = " Its free daily quota for this server is used up; try again tomorrow."
    else:
        advice = " Try again later."
    return (
        " The free weather service refused requests from this server (rate limit)." + said + advice
    )


def weather_warnings(
    checkpoints: open_meteo.WeatherFetch, cells: open_meteo.WeatherFetch
) -> list[Warning]:
    """Separate warnings for checkpoint weather (drives the ranking) and heatmap cells."""
    found: list[Warning] = []
    limited = checkpoints.rate_limited or cells.rate_limited
    reason = checkpoints.rate_limit_reason or cells.rate_limit_reason
    hint = rate_limit_hint(reason) if limited else ""
    if checkpoints.failed_count and checkpoints.failed_count >= checkpoints.location_count:
        found.append(
            Warning(
                "WEATHER_UNAVAILABLE",
                "No checkpoint forecast could be retrieved, so no route could be scored." + hint,
            )
        )
    elif checkpoints.failed_count:
        found.append(
            Warning(
                "WEATHER_PARTIAL",
                f"Forecasts could not be retrieved for {checkpoints.failed_count} of "
                f"{checkpoints.location_count} checkpoints. Those points are shown as Unknown."
                + hint,
            )
        )
    if cells.failed_count:
        found.append(
            Warning(
                "CORRIDOR_WEATHER_PARTIAL",
                f"{cells.failed_count} of {cells.location_count} heatmap cells have no forecast "
                "and are drawn as Unknown." + ("" if checkpoints.failed_count else hint),
            )
        )
    return found


def plan_trip(command: PlanCommand, *, now: datetime | None = None) -> PlanResult:
    started = time.monotonic()
    now = now or datetime.now(UTC)
    departure = require_utc(command.departure_utc)
    warnings: list[Warning] = []

    provider_routes = tomtom.calculate_routes(
        command.origin.point, command.destination.point, departure, now=now
    )[: len(ROUTE_IDS)]
    if len(provider_routes) < EXPECTED_ROUTE_COUNT:
        count = len(provider_routes)
        warnings.append(
            Warning(
                "FEWER_THAN_THREE_ROUTES",
                f"The routing provider returned {count} route{'s' if count != 1 else ''} for "
                "this trip. Routes are never invented, so fewer than three are compared.",
            )
        )

    profiles: list[RouteProfile] = []
    for route in provider_routes:
        try:
            profiles.append(build_profile(route.points, route.progress))
        except InvalidRouteProfile as exc:
            raise ProviderBadResponse("TomTom", str(exc)) from exc

    placements = [place_checkpoints(p, command.interval_mi, departure) for p in profiles]
    cell_size, centres = corridor_cells(profiles)
    if cell_size > CELL_SIZES_DEG[0]:
        warnings.append(
            Warning(
                "CORRIDOR_COARSENED",
                f"This trip's corridor is large, so the heatmap uses {cell_size:g}° cells "
                f"instead of {CELL_SIZES_DEG[0]:g}°.",
            )
        )

    latest_arrival = max(departure + timedelta(seconds=p.total_time_s) for p in profiles)
    start, end = weather_window(departure, latest_arrival)
    # Checkpoints drive the recommendation, so they are fetched before the heatmap cells: if the
    # provider's rate limit is reached, the cells are what goes missing (VF-11). Once checkpoints
    # were refused with HTTP 429, cell requests would be refused too, so only cached cells are
    # used instead of sending more requests (VF-17).
    checkpoint_points = [pl.point for route in placements for pl in route]
    checkpoint_weather = open_meteo.fetch_hourly(checkpoint_points, start, end)
    cell_weather = open_meteo.fetch_hourly(
        centres, start, end, network=not checkpoint_weather.rate_limited
    )
    series = {**cell_weather.series, **checkpoint_weather.series}
    warnings.extend(weather_warnings(checkpoint_weather, cell_weather))

    route_ids = ROUTE_IDS[: len(provider_routes)]
    checkpoints_by_route: list[tuple[Checkpoint, ...]] = []
    ranking_input: list[RouteForRanking] = []
    for route_id, route, profile, route_placements in zip(
        route_ids, provider_routes, profiles, placements, strict=True
    ):
        checkpoints = []
        for placement in route_placements:
            observed = lookup_weather(series.get(placement.point), placement.eta_utc)
            risk = assess(
                observed.wind_mph if observed else None,
                observed.rain_in_hr if observed else None,
                observed.snow_in_hr if observed else None,
                command.load_lb,
            )
            checkpoints.append(
                Checkpoint(
                    index=placement.index,
                    mile=placement.mile,
                    point=placement.point,
                    covered_mi=placement.covered_mi,
                    eta_utc=placement.eta_utc,
                    weather=observed,
                    risk=risk,
                )
            )
        metrics = route_metrics(checkpoints, profile.length_m / METERS_PER_MILE)
        checkpoints_by_route.append(tuple(checkpoints))
        ranking_input.append(
            RouteForRanking(
                id=route_id,
                provider_index=route.provider_index,
                metrics=metrics,
                travel_time_s=route.travel_time_s,
            )
        )

    recommendation = recommend(ranking_input)
    partially_unknown = [r for r in ranking_input if 0 < r.metrics.unknown_count]
    if recommendation.status is RecommendationStatus.RECOMMENDED and partially_unknown:
        listed = ", ".join(
            f"Route {r.id}: {r.metrics.unknown_mi:.1f} mi" for r in partially_unknown
        )
        warnings.append(
            Warning(
                "INCOMPLETE_WEATHER_DATA",
                f"Some checkpoints have no forecast ({listed} Unknown). The recommendation uses "
                "the remaining miles; Unknown is never treated as Low.",
            )
        )

    corridor = corridor_grid(departure, cell_size, centres, series, command.load_lb)

    planned: list[PlannedRoute] = []
    for ranked, route, profile, checkpoints in zip(
        ranking_input, provider_routes, profiles, checkpoints_by_route, strict=True
    ):
        planned.append(
            PlannedRoute(
                id=ranked.id,
                source=RouteSource.PROVIDER,
                provider_index=route.provider_index,
                distance_mi=ranked.metrics.distance_mi,
                travel_time_s=route.travel_time_s,
                traffic_delay_s=route.traffic_delay_s,
                departure_utc=departure,
                arrival_utc=departure + timedelta(seconds=route.travel_time_s),
                geometry=profile.points,
                checkpoints=checkpoints,
                metrics=ranked.metrics,
                rank=recommendation.ranking.index(ranked.id) + 1,
                eligible=is_eligible(ranked),
                is_recommended=recommendation.route_id == ranked.id,
            )
        )

    logger.info(
        "plan routes=%d interval=%d checkpoints=%d cells=%d cell_size=%g weather_locations=%d "
        "weather_requests=%d weather_cache_hits=%d weather_failed=%d status=%s ms=%d",
        len(planned),
        command.interval_mi,
        sum(len(c) for c in checkpoints_by_route),
        len(centres),
        cell_size,
        checkpoint_weather.location_count + cell_weather.location_count,
        checkpoint_weather.request_count + cell_weather.request_count,
        checkpoint_weather.cache_hits + cell_weather.cache_hits,
        checkpoint_weather.failed_count + cell_weather.failed_count,
        recommendation.status,
        round((time.monotonic() - started) * 1000),
    )

    return PlanResult(
        command=command,
        routes=tuple(planned),
        recommendation=recommendation,
        corridor=corridor,
        warnings=tuple(warnings),
        generated_at=now,
    )
