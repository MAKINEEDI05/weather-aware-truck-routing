"""Cumulative distance and travel time along a route polyline (DEC-23, DEC-37).

The routing provider reports cumulative distance and travel time for polyline points
(TomTom `progress[]`). If some points have no progress element, the distance and time between
two known anchors are spread over the points in between by their share of the straight-line
polyline length. Positions and times at any distance are then interpolated linearly.
"""

from __future__ import annotations

from bisect import bisect_right
from collections.abc import Sequence
from dataclasses import dataclass

from .geo import haversine_m, interpolate
from .types import LatLon, ProgressPoint


class InvalidRouteProfile(ValueError):
    """The provider's geometry or progress data is inconsistent."""


@dataclass(frozen=True, slots=True)
class RouteProfile:
    points: tuple[LatLon, ...]
    distance_m: tuple[float, ...]  # cumulative, per point, non-decreasing
    time_s: tuple[float, ...]  # cumulative, per point, non-decreasing

    @property
    def length_m(self) -> float:
        return self.distance_m[-1]

    @property
    def total_time_s(self) -> float:
        return self.time_s[-1]

    def locate(self, distance_m: float) -> tuple[LatLon, float]:
        """Position and cumulative travel time at `distance_m` from the start."""
        if distance_m <= self.distance_m[0]:
            return self.points[0], self.time_s[0]
        if distance_m >= self.length_m:
            return self.points[-1], self.time_s[-1]
        j = bisect_right(self.distance_m, distance_m) - 1
        start, end = self.distance_m[j], self.distance_m[j + 1]
        fraction = (distance_m - start) / (end - start) if end > start else 0.0
        point = interpolate(self.points[j], self.points[j + 1], fraction)
        time = self.time_s[j] + (self.time_s[j + 1] - self.time_s[j]) * fraction
        return point, time


def build_profile(points: Sequence[LatLon], progress: Sequence[ProgressPoint]) -> RouteProfile:
    count = len(points)
    if count < 2:
        raise InvalidRouteProfile("A route needs at least two points.")

    anchors = sorted(progress, key=lambda item: item.point_index)
    if not anchors or anchors[0].point_index != 0:
        anchors.insert(0, ProgressPoint(point_index=0, distance_m=0.0, time_s=0.0))
    if anchors[-1].point_index != count - 1:
        raise InvalidRouteProfile("Progress data does not reach the last route point.")

    for previous, current in zip(anchors, anchors[1:], strict=False):
        if current.point_index <= previous.point_index:
            raise InvalidRouteProfile("Progress point indexes must be strictly increasing.")
        if current.distance_m < previous.distance_m or current.time_s < previous.time_s:
            raise InvalidRouteProfile("Progress distance and time must not decrease.")
    if anchors[0].distance_m < 0 or anchors[0].time_s < 0:
        raise InvalidRouteProfile("Progress values must not be negative.")

    segment_m = [haversine_m(points[i], points[i + 1]) for i in range(count - 1)]
    distance = [0.0] * count
    time = [0.0] * count
    first = anchors[0]
    distance[0], time[0] = first.distance_m, first.time_s

    for start, end in zip(anchors, anchors[1:], strict=False):
        span_m = sum(segment_m[start.point_index : end.point_index])
        steps = end.point_index - start.point_index
        travelled = 0.0
        for k in range(start.point_index + 1, end.point_index + 1):
            travelled += segment_m[k - 1]
            fraction = travelled / span_m if span_m > 0 else (k - start.point_index) / steps
            distance[k] = start.distance_m + fraction * (end.distance_m - start.distance_m)
            time[k] = start.time_s + fraction * (end.time_s - start.time_s)
        # Pin anchors exactly to the provider's values (no accumulated float drift).
        distance[end.point_index], time[end.point_index] = end.distance_m, end.time_s

    if distance[-1] <= 0:
        raise InvalidRouteProfile("Route length must be positive.")

    return RouteProfile(points=tuple(points), distance_m=tuple(distance), time_s=tuple(time))
