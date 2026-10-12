"""Checkpoint placement, covered miles and ETAs (DEC-18, DEC-19, DEC-23)."""

from __future__ import annotations

from datetime import datetime, timedelta

from .geo import METERS_PER_MILE
from .profile import RouteProfile
from .timeutil import require_utc
from .types import CheckpointPlacement

ALLOWED_INTERVALS_MI = (10, 25, 50)
# The destination is not added as a separate checkpoint when the last regular checkpoint is
# this close to it.
DESTINATION_MERGE_MI = 0.01
_EPSILON_MI = 1e-9


def checkpoint_miles(length_mi: float, interval_mi: float) -> list[float]:
    """Mile markers at 0, N, 2N, … plus the destination (unless within 0.01 mi)."""
    if length_mi <= 0:
        raise ValueError("Route length must be positive.")
    if interval_mi <= 0:
        raise ValueError("Checkpoint interval must be positive.")
    miles: list[float] = []
    k = 0
    while k * interval_mi <= length_mi + _EPSILON_MI:
        miles.append(min(k * interval_mi, length_mi))
        k += 1
    if length_mi - miles[-1] > DESTINATION_MERGE_MI:
        miles.append(length_mi)
    return miles


def covered_miles(miles: list[float], length_mi: float) -> list[float]:
    """Road miles each checkpoint stands for: midpoint to midpoint; the sum equals the length."""
    covered: list[float] = []
    last = len(miles) - 1
    for i, mile in enumerate(miles):
        start = 0.0 if i == 0 else (miles[i - 1] + mile) / 2
        end = length_mi if i == last else (mile + miles[i + 1]) / 2
        covered.append(end - start)
    return covered


def place_checkpoints(
    profile: RouteProfile, interval_mi: int, departure_utc: datetime
) -> list[CheckpointPlacement]:
    departure_utc = require_utc(departure_utc)
    length_mi = profile.length_m / METERS_PER_MILE
    miles = checkpoint_miles(length_mi, interval_mi)
    covered = covered_miles(miles, length_mi)
    placements: list[CheckpointPlacement] = []
    for index, (mile, covered_mi) in enumerate(zip(miles, covered, strict=True)):
        point, time_s = profile.locate(mile * METERS_PER_MILE)
        placements.append(
            CheckpointPlacement(
                index=index,
                mile=mile,
                point=point,
                covered_mi=covered_mi,
                eta_utc=departure_utc + timedelta(seconds=round(time_s)),
            )
        )
    return placements
