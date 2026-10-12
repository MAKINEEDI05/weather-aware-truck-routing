"""Small geometry helpers on WGS84 coordinates."""

import math

from .types import LatLon

METERS_PER_MILE = 1609.344
EARTH_RADIUS_M = 6_371_008.8


def haversine_m(a: LatLon, b: LatLon) -> float:
    """Great-circle distance in meters."""
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = lat2 - lat1
    dlon = math.radians(b.lon - a.lon)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def haversine_mi(a: LatLon, b: LatLon) -> float:
    return haversine_m(a, b) / METERS_PER_MILE


def interpolate(a: LatLon, b: LatLon, fraction: float) -> LatLon:
    """Point at `fraction` (0–1) along the straight segment a→b in lat/lon space.

    Polyline segments from the routing provider are short, so linear interpolation stays on
    the drawn segment.
    """
    return LatLon(a.lat + (b.lat - a.lat) * fraction, a.lon + (b.lon - a.lon) * fraction)
