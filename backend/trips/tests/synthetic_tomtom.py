"""SYNTHETIC TomTom Calculate Route / Geocode responses for tests.

These are NOT recordings. No TomTom API key was available (docs/DECISIONS.md B-1), so responses
are built from the documented schema (VF-8, VF-9): `routes[].summary`, `routes[].legs[].points`,
`routes[].progress[]` with cumulative `distanceInMeters` / `travelTimeInSeconds`. The polylines
are coarse lines between approximate city coordinates, not real roads. Replace with sanitised
recordings once a key exists (tests/fixtures/README.md).
"""

from __future__ import annotations

from typing import Any

from trips.domain.geo import METERS_PER_MILE, haversine_m
from trips.domain.types import LatLon

CHICAGO = LatLon(41.8842, -87.6324)
DENVER = LatLon(39.7392, -104.9903)

# Three distinct corridors Chicago → Denver, as rough waypoint lists (illustrative only).
CORRIDORS: dict[str, list[LatLon]] = {
    "north": [CHICAGO, LatLon(42.27, -89.09), LatLon(42.49, -92.34), LatLon(42.50, -96.40),
              LatLon(41.14, -100.76), DENVER],
    "middle": [CHICAGO, LatLon(41.52, -90.58), LatLon(41.59, -93.62), LatLon(41.26, -95.93),
               LatLon(40.70, -99.08), DENVER],
    "south": [CHICAGO, LatLon(39.78, -89.65), LatLon(39.10, -94.58), LatLon(38.84, -97.61),
              LatLon(38.88, -99.33), LatLon(39.26, -103.69), DENVER],
}  # fmt: skip


def densify(waypoints: list[LatLon], step_mi: float = 2.0) -> list[LatLon]:
    points = [waypoints[0]]
    for a, b in zip(waypoints, waypoints[1:], strict=False):
        steps = max(1, round(haversine_m(a, b) / METERS_PER_MILE / step_mi))
        for k in range(1, steps + 1):
            f = k / steps
            points.append(LatLon(round(a.lat + (b.lat - a.lat) * f, 5),
                                 round(a.lon + (b.lon - a.lon) * f, 5)))  # fmt: skip
    return points


def route_json(
    points: list[LatLon], speed_mph: float = 55.0, progress_every: int = 1, delay_s: int = 0
) -> dict[str, Any]:
    progress: list[dict[str, Any]] = []
    distance = 0.0
    for index, point in enumerate(points):
        if index:
            distance += haversine_m(points[index - 1], point)
        if index % progress_every == 0 or index == len(points) - 1:
            progress.append(
                {
                    "pointIndex": index,
                    "travelTimeInSeconds": round(distance / METERS_PER_MILE / speed_mph * 3600),
                    "distanceInMeters": round(distance),
                }
            )
    summary = {
        "lengthInMeters": progress[-1]["distanceInMeters"],
        "travelTimeInSeconds": progress[-1]["travelTimeInSeconds"],
        "trafficDelayInSeconds": delay_s,
        "trafficLengthInMeters": 0,
        "departureTime": "2026-10-14T08:00:00-05:00",
        "arrivalTime": "2026-10-14T23:00:00-06:00",
    }
    return {
        "summary": summary,
        "legs": [
            {
                "summary": summary,
                "points": [{"latitude": p.lat, "longitude": p.lon} for p in points],
            }
        ],
        "sections": [
            {
                "startPointIndex": 0,
                "endPointIndex": len(points) - 1,
                "sectionType": "TRAVEL_MODE",
                "travelMode": "truck",
            }
        ],  # fmt: skip
        "progress": progress,
    }


def routes_response(*corridors: str, speeds: tuple[float, ...] | None = None) -> dict[str, Any]:
    speeds = speeds or tuple(55.0 + 2 * i for i in range(len(corridors)))
    return {
        "formatVersion": "0.0.12",
        "routes": [
            route_json(densify(CORRIDORS[name]), speed_mph=speed)
            for name, speed in zip(corridors, speeds, strict=True)
        ],
    }


def three_routes_response() -> dict[str, Any]:
    return routes_response("middle", "north", "south")


NO_ROUTE_400 = {
    "formatVersion": "0.0.12",
    "detailedError": {
        "code": "MAP_MATCHING_FAILURE",
        "message": "Engine error while executing route request: MAP_MATCHING_FAILURE: Origin "
        "(41.8842, -87.6324)",
    },
}

AUTH_403_XML = (
    '<?xml version="1.0" encoding="UTF-8"?><errorResponse version="" '
    'description="" errorCode="403"><error>Developer Inactive</error></errorResponse>'
)

GEOCODE_SPRINGFIELD = {
    "summary": {"query": "springfield", "numResults": 4},
    "results": [
        {
            "type": "Geography",
            "entityType": "Municipality",
            "matchConfidence": {"score": 1},
            "address": {
                "municipality": "Springfield",
                "countrySecondarySubdivision": "Sangamon",
                "countrySubdivision": "IL",
                "countrySubdivisionName": "Illinois",
                "countryCode": "US",
                "freeformAddress": "Springfield, IL",
            },
            "position": {"lat": 39.79923, "lon": -89.64404},
        },
        {
            "type": "Geography",
            "entityType": "Municipality",
            "address": {
                "countrySecondarySubdivision": "Greene",
                "countrySubdivision": "MO",
                "countrySubdivisionName": "Missouri",
                "countryCode": "US",
                "freeformAddress": "Springfield, MO",
            },
            "position": {"lat": 37.20898, "lon": -93.29225},
        },
        {
            # Duplicate of the first result: must be removed.
            "type": "Geography",
            "address": {"countryCode": "US", "freeformAddress": "Springfield, IL"},
            "position": {"lat": 39.79923, "lon": -89.64404},
        },
        {"type": "Geography", "address": {"countryCode": "US"}},  # no position: skipped
        {
            "type": "Geography",
            "address": {"countryCode": "CA", "freeformAddress": "Springfield, NS"},
            "position": {"lat": 44.6, "lon": -64.7},
        },
    ],
}
