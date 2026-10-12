"""Domain results → JSON, exactly as documented in docs/API_CONTRACT.md."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from django.conf import settings

from trips.domain.types import (
    Checkpoint,
    CorridorGrid,
    Place,
    PlannedRoute,
    PlanResult,
    Recommendation,
    RouteMetrics,
)

RULES_VERSION = "1.1"


def iso(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def place_json(place: Place) -> dict[str, Any]:
    return {"label": place.label, "lat": place.point.lat, "lon": place.point.lon}


def geocode_json(place: Place) -> dict[str, Any]:
    return {**place_json(place), "detail": place.detail}


def _checkpoint_json(checkpoint: Checkpoint) -> dict[str, Any]:
    weather = checkpoint.weather
    risk = checkpoint.risk
    return {
        "index": checkpoint.index,
        "mile": round(checkpoint.mile, 2),
        "lat": round(checkpoint.point.lat, 6),
        "lon": round(checkpoint.point.lon, 6),
        "covered_mi": round(checkpoint.covered_mi, 2),
        "eta": iso(checkpoint.eta_utc),
        "weather": None
        if weather is None
        else {
            "provider_grid_point": {"lat": weather.grid_point.lat, "lon": weather.grid_point.lon},
            "wind_mph": weather.wind_mph,
            "wind_hour": iso(weather.wind_hour),
            "rain_in_hr": None if weather.rain_in_hr is None else round(weather.rain_in_hr, 4),
            "snow_in_hr": weather.snow_in_hr,
            "precip_hour": iso(weather.precip_hour),
        },
        "risk": {
            "overall": risk.overall.value,
            "wind": risk.wind.value,
            "rain": risk.rain.value,
            "snow": risk.snow.value,
            "load_adjusted": risk.load_adjusted,
            "reasons": list(risk.reasons),
        },
    }


def _metrics_json(metrics: RouteMetrics) -> dict[str, Any]:
    return {
        "low_mi": metrics.low_mi,
        "moderate_mi": metrics.moderate_mi,
        "high_mi": metrics.high_mi,
        "severe_mi": metrics.severe_mi,
        "no_travel_mi": metrics.no_travel_mi,
        "unknown_mi": metrics.unknown_mi,
        "known_mi": metrics.known_mi,
        "average_risk": metrics.average_risk,
    }


def _route_json(route: PlannedRoute) -> dict[str, Any]:
    return {
        "id": route.id,
        "label": route.label,
        "source": route.source.value,
        "provider_index": route.provider_index,
        "distance_mi": route.distance_mi,
        "travel_time_s": route.travel_time_s,
        "traffic_delay_s": route.traffic_delay_s,
        "departure_time": iso(route.departure_utc),
        "arrival_time": iso(route.arrival_utc),
        "geometry": [[round(p.lat, 5), round(p.lon, 5)] for p in route.geometry],
        "checkpoints": [_checkpoint_json(c) for c in route.checkpoints],
        "metrics": _metrics_json(route.metrics),
        "rank": route.rank,
        "eligible": route.eligible,
        "is_recommended": route.is_recommended,
    }


def _recommendation_json(rec: Recommendation) -> dict[str, Any]:
    return {
        "status": rec.status.value,
        "route_id": rec.route_id,
        "ranking": list(rec.ranking),
        "comparisons": [
            {
                "other_route": c.other_route,
                "other_rank": c.other_rank,
                "other_eligible": c.other_eligible,
                "decided_by": c.decided_by.value,
                "recommended_value": c.recommended_value,
                "other_value": c.other_value,
            }
            for c in rec.comparisons
        ],
        "ineligible": [{"route": i.route, "no_travel_mi": i.no_travel_mi} for i in rec.ineligible],
        "explanation": rec.explanation,
    }


def _corridor_json(grid: CorridorGrid) -> dict[str, Any]:
    return {
        "start_time": iso(grid.start_utc),
        "hours": grid.hours,
        "cell_size_deg": grid.cell_size_deg,
        "cells": [
            {
                "lat": cell.lat,
                "lon": cell.lon,
                "risk": list(cell.risk),
                "wind_mph": list(cell.wind_mph),
                "rain_in_hr": [None if v is None else round(v, 4) for v in cell.rain_in_hr],
                "snow_in_hr": list(cell.snow_in_hr),
            }
            for cell in grid.cells
        ],
    }


def plan_json(result: PlanResult) -> dict[str, Any]:
    command = result.command
    return {
        "request": {
            "origin": place_json(command.origin),
            "destination": place_json(command.destination),
            "departure_time": iso(command.departure_utc),
            "load_weight_lb": command.load_lb,
            "checkpoint_interval_mi": command.interval_mi,
        },
        "routes": [_route_json(r) for r in result.routes],
        "recommendation": _recommendation_json(result.recommendation),
        "corridor": _corridor_json(result.corridor),
        "warnings": [{"code": w.code, "message": w.message} for w in result.warnings],
        "meta": {
            "providers": {
                "routing": "TomTom Routing API v1",
                "weather": "Open-Meteo Forecast API (CC BY 4.0)",
            },
            "rules_version": RULES_VERSION,
            "app_version": settings.APP_VERSION,
            "generated_at": iso(result.generated_at),
            "route_count": len(result.routes),
        },
    }
