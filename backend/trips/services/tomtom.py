"""TomTom Geocoding and Calculate Route clients.

Documentation (read 2026-10-12, docs/DECISIONS.md VF-8, VF-9):
- https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route
- https://docs.tomtom.com/geocoding-api/documentation/geocode

NOT YET VERIFIED WITH A LIVE CALL (no API key available). Parsing is tested against synthetic
responses built from the documented schema; see tests/fixtures/README.md.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

from django.conf import settings

from trips.domain.types import LatLon, Place, ProgressPoint, ProviderRoute

from .errors import (
    NoRouteFound,
    ProviderBadRequest,
    ProviderBadResponse,
    ProviderNotConfigured,
)
from .http import get_json

PROVIDER = "TomTom"
BASE_URL = "https://api.tomtom.com"
GEOCODE_TIMEOUT = (5.0, 10.0)
ROUTE_TIMEOUT = (5.0, 30.0)
GEOCODE_LIMIT = 5
# Whole countries and states are not usable trip endpoints (routing would use their centroid).
# Observed live 2026-10-12: "Denvr, CA" returns "California" (entityType CountrySubdivision) first.
EXCLUDED_ENTITY_TYPES = frozenset({"Country", "CountrySubdivision"})
# Up to 2 alternatives + the primary route = the 3 options the assessment asks for. TomTom may
# return fewer (VF-8); the app then shows the real count (DEC-47).
MAX_ALTERNATIVES = 2
# departAt is only sent when comfortably in the future (DEC-33).
DEPART_AT_MIN_LEAD = timedelta(minutes=2)


def _api_key() -> str:
    key = getattr(settings, "TOMTOM_API_KEY", "")
    if not key:
        raise ProviderNotConfigured(PROVIDER, "The routing provider is not configured.")
    return key


# --- Geocoding --------------------------------------------------------------------------------


def geocode(query: str) -> list[Place]:
    key = _api_key()
    data = get_json(
        provider=PROVIDER,
        operation="geocode",
        url=f"{BASE_URL}/search/2/geocode/{quote(query, safe='')}.json",
        params={"key": key, "countrySet": "US", "limit": GEOCODE_LIMIT},
        timeout=GEOCODE_TIMEOUT,
    )
    return parse_geocode(data)


def parse_geocode(data: Any) -> list[Place]:
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise ProviderBadResponse(PROVIDER, "Unexpected geocoding response.")
    places: list[Place] = []
    seen: set[tuple[str, float, float]] = set()
    for result in data["results"]:
        if isinstance(result, dict) and result.get("entityType") in EXCLUDED_ENTITY_TYPES:
            continue
        try:
            address = result.get("address") or {}
            position = result["position"]
            lat, lon = float(position["lat"]), float(position["lon"])
        except (AttributeError, KeyError, TypeError, ValueError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        country = address.get("countryCode")
        if country and country != "US":
            continue
        label = str(address.get("freeformAddress") or "").strip()
        if not label:
            continue
        detail_parts = [
            address.get("countrySecondarySubdivision"),
            address.get("countrySubdivisionName") or address.get("countrySubdivision"),
        ]
        detail = ", ".join(str(part) for part in detail_parts if part and str(part) not in label)
        identity = (label, round(lat, 5), round(lon, 5))
        if identity in seen:
            continue
        seen.add(identity)
        places.append(Place(label=label[:200], point=LatLon(lat, lon), detail=detail))
    return places


# --- Routing ----------------------------------------------------------------------------------


def depart_at_param(departure_utc: datetime, now: datetime) -> str:
    if departure_utc - now >= DEPART_AT_MIN_LEAD:
        return departure_utc.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    return "now"


def calculate_routes(
    origin: LatLon, destination: LatLon, departure_utc: datetime, now: datetime | None = None
) -> list[ProviderRoute]:
    key = _api_key()
    now = now or datetime.now(UTC)
    locations = f"{origin.lat:.6f},{origin.lon:.6f}:{destination.lat:.6f},{destination.lon:.6f}"
    params = [
        ("key", key),
        ("travelMode", "truck"),
        ("routeType", "fastest"),
        ("traffic", "true"),
        ("maxAlternatives", str(MAX_ALTERNATIVES)),
        ("routeRepresentation", "polyline"),
        ("extendedRouteRepresentation", "distance"),
        ("extendedRouteRepresentation", "travelTime"),
        ("departAt", depart_at_param(departure_utc, now)),
    ]
    try:
        data = get_json(
            provider=PROVIDER,
            operation="calculateRoute",
            url=f"{BASE_URL}/routing/1/calculateRoute/{locations}/json",
            params=params,
            timeout=ROUTE_TIMEOUT,
        )
    except NoRouteFound:
        raise
    except ProviderBadRequest as exc:
        # Documented 400 causes: points not connected by road, or not near a road.
        raise NoRouteFound(PROVIDER, exc.message, status=exc.status) from None
    return parse_routes(data)


def parse_routes(data: Any) -> list[ProviderRoute]:
    if not isinstance(data, dict) or not isinstance(data.get("routes"), list):
        raise ProviderBadResponse(PROVIDER, "Unexpected routing response.")
    if not data["routes"]:
        raise NoRouteFound(PROVIDER, "The routing provider returned no routes.")
    return [_parse_route(index, route) for index, route in enumerate(data["routes"])]


def _parse_route(index: int, route: Any) -> ProviderRoute:
    try:
        summary = route["summary"]
        points = tuple(
            LatLon(float(point["latitude"]), float(point["longitude"]))
            for leg in route["legs"]
            for point in leg["points"]
        )
        progress = tuple(
            ProgressPoint(
                point_index=int(item["pointIndex"]),
                distance_m=float(item["distanceInMeters"]),
                time_s=float(item["travelTimeInSeconds"]),
            )
            for item in route["progress"]
            if "distanceInMeters" in item and "travelTimeInSeconds" in item
        )
        length_m = float(summary["lengthInMeters"])
        travel_time_s = int(summary["travelTimeInSeconds"])
        traffic_delay_s = int(summary.get("trafficDelayInSeconds", 0) or 0)
    except (KeyError, TypeError, ValueError) as exc:
        raise ProviderBadResponse(PROVIDER, f"Route {index} is missing required fields.") from exc

    if len(points) < 2:
        raise ProviderBadResponse(PROVIDER, f"Route {index} has no geometry.")
    if not progress:
        raise ProviderBadResponse(PROVIDER, f"Route {index} has no distance/time profile.")
    if any(not (-90 <= p.lat <= 90 and -180 <= p.lon <= 180) for p in points):
        raise ProviderBadResponse(PROVIDER, f"Route {index} has invalid coordinates.")
    if any(not (0 <= item.point_index < len(points)) for item in progress):
        raise ProviderBadResponse(PROVIDER, f"Route {index} profile refers to unknown points.")
    return ProviderRoute(
        provider_index=index,
        length_m=length_m,
        travel_time_s=travel_time_s,
        traffic_delay_s=traffic_delay_s,
        points=points,
        progress=progress,
    )
