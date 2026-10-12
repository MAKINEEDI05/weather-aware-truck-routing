"""Opt-in tests against the real providers: `pytest -m live -s`.

Open-Meteo needs no key. TomTom tests are skipped unless TOMTOM_API_KEY is set in the
environment or in backend/.env. Results (route counts, sizes, durations) are printed so they
can be copied into the README verification log.
"""

from __future__ import annotations

import json
import os
import time
from datetime import UTC, datetime, timedelta

import pytest
from django.test import override_settings

from trips import planner
from trips.domain.geo import haversine_m
from trips.domain.timeutil import floor_to_hour
from trips.domain.types import LatLon, Place, PlanCommand
from trips.services import open_meteo, tomtom

pytestmark = pytest.mark.live

REAL_KEY = os.environ.get("TOMTOM_API_KEY", "").strip()
needs_tomtom = pytest.mark.skipif(not REAL_KEY, reason="TOMTOM_API_KEY not set: TomTom unverified")

EVIDENCE_TRIPS = {
    "Chicago, IL → Denver, CO": (LatLon(41.8781, -87.6298), LatLon(39.7392, -104.9903)),
    "Dallas, TX → Atlanta, GA": (LatLon(32.7767, -96.7970), LatLon(33.7490, -84.3880)),
    "Seattle, WA → Salt Lake City, UT": (LatLon(47.6062, -122.3321), LatLon(40.7608, -111.8910)),
    "Los Angeles, CA → Phoenix, AZ": (LatLon(34.0522, -118.2437), LatLon(33.4484, -112.0740)),
    "Kansas City, MO → Minneapolis, MN": (LatLon(39.0997, -94.5786), LatLon(44.9778, -93.2650)),
}


def test_open_meteo_three_points_49_hours() -> None:
    start = floor_to_hour(datetime.now(UTC)) + timedelta(hours=2)
    end = start + timedelta(hours=48)
    points = [LatLon(41.8842, -87.6324), LatLon(39.7392, -104.9903), LatLon(38.84, -97.61)]

    started = time.monotonic()
    result = open_meteo.fetch_hourly(points, start, end, cache_ttl_s=0)
    elapsed = time.monotonic() - started

    assert result.failed_count == 0
    for point in points:
        series = result.series[point]
        assert series is not None
        assert len(series.times) == 49
        assert series.times[0] == int(start.timestamp())
        assert all(v is not None for v in series.wind_mph)
    print(f"\n[live] Open-Meteo 3 points × 49 h OK in {elapsed:.2f} s")


@needs_tomtom
@override_settings(TOMTOM_API_KEY=REAL_KEY)
def test_tomtom_geocode_chicago() -> None:
    places = tomtom.geocode("Chicago, IL")

    assert places
    assert haversine_m(places[0].point, LatLon(41.88, -87.63)) < 30_000
    print(f"\n[live] TomTom geocode 'Chicago, IL' → {places[0].label}")


@needs_tomtom
@override_settings(TOMTOM_API_KEY=REAL_KEY)
@pytest.mark.parametrize("trip", list(EVIDENCE_TRIPS))
def test_tomtom_route_count_evidence(trip: str) -> None:
    origin, destination = EVIDENCE_TRIPS[trip]
    departure = floor_to_hour(datetime.now(UTC)) + timedelta(hours=3)

    routes = tomtom.calculate_routes(origin, destination, departure)

    assert routes
    sizes = [len(json.dumps([[p.lat, p.lon] for p in r.points])) for r in routes]
    print(
        f"\n[live] {trip}: {len(routes)} route(s); "
        f"lengths {[round(r.length_m / 1609.344, 1) for r in routes]} mi; "
        f"points {[len(r.points) for r in routes]}; geometry bytes {sizes}"
    )


@needs_tomtom
@override_settings(TOMTOM_API_KEY=REAL_KEY)
def test_full_plan_chicago_denver() -> None:
    command = PlanCommand(
        origin=Place("Chicago, IL", LatLon(41.8781, -87.6298)),
        destination=Place("Denver, CO", LatLon(39.7392, -104.9903)),
        departure_utc=floor_to_hour(datetime.now(UTC)) + timedelta(hours=3),
        load_lb=42_000,
        interval_mi=25,
    )

    started = time.monotonic()
    result = planner.plan_trip(command)
    elapsed = time.monotonic() - started

    assert result.routes
    print(
        f"\n[live] Full plan Chicago → Denver: {len(result.routes)} routes, "
        f"status {result.recommendation.status}, {len(result.corridor.cells)} cells, "
        f"{elapsed:.1f} s"
    )
