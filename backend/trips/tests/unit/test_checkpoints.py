import math
import random
from datetime import timedelta

import pytest

from trips.domain.checkpoints import checkpoint_miles, covered_miles, place_checkpoints
from trips.domain.geo import METERS_PER_MILE
from trips.domain.profile import build_profile
from trips.domain.types import LatLon
from trips.tests.factories import DEPARTURE, make_line, make_progress


def test_100_miles_every_10() -> None:
    miles = checkpoint_miles(100, 10)

    assert miles == [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    assert covered_miles(miles, 100) == [5] + [10] * 9 + [5]


def test_destination_added_when_not_on_interval() -> None:
    miles = checkpoint_miles(103, 25)

    assert miles == [0, 25, 50, 75, 100, 103]
    assert sum(covered_miles(miles, 103)) == pytest.approx(103)


def test_destination_not_duplicated_within_one_hundredth_of_a_mile() -> None:
    assert checkpoint_miles(100.005, 50) == [0, 50, 100]
    assert sum(covered_miles([0, 50, 100], 100.005)) == pytest.approx(100.005)


def test_route_shorter_than_interval() -> None:
    miles = checkpoint_miles(8, 10)

    assert miles == [0, 8]
    assert covered_miles(miles, 8) == [4, 4]


@pytest.mark.parametrize("interval", [10, 25, 50])
def test_covered_miles_always_sum_to_route_length(interval: int) -> None:
    rng = random.Random(20261012)
    for _ in range(200):
        length = rng.uniform(1, 3000)
        miles = checkpoint_miles(length, interval)
        covered = covered_miles(miles, length)
        assert math.isclose(sum(covered), length, rel_tol=0, abs_tol=1e-9)
        assert all(c > 0 for c in covered)
        assert miles == sorted(miles)
        assert all(b - a <= interval + 1e-9 for a, b in zip(miles, miles[1:], strict=False))


@pytest.mark.parametrize("bad", [(0, 10), (10, 0), (-1, 25)])
def test_invalid_inputs_are_rejected(bad: tuple[float, float]) -> None:
    with pytest.raises(ValueError):
        checkpoint_miles(*bad)


def _distance_to_segment_m(p: LatLon, a: LatLon, b: LatLon) -> float:
    # Local equirectangular projection; accurate to well under 1 m for short segments.
    k = math.cos(math.radians(a.lat))
    ax, ay = a.lon * k, a.lat
    bx, by = b.lon * k, b.lat
    px, py = p.lon * k, p.lat
    dx, dy = bx - ax, by - ay
    t = (
        0.0
        if dx == dy == 0
        else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx**2 + dy**2)))
    )
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111_195


def test_placements_lie_on_polyline_with_non_decreasing_etas() -> None:
    points = (
        LatLon(41.88, -87.63),
        LatLon(41.6, -88.4),
        LatLon(41.2, -90.1),
        LatLon(40.8, -91.0),
        LatLon(40.7, -93.5),
    )
    profile = build_profile(points, make_progress(points, speed_mph=55))

    placements = place_checkpoints(profile, 25, DEPARTURE)

    for placement in placements:
        nearest = min(
            _distance_to_segment_m(placement.point, points[i], points[i + 1])
            for i in range(len(points) - 1)
        )
        assert nearest < 1.0
    etas = [p.eta_utc for p in placements]
    assert etas == sorted(etas)
    assert placements[0].eta_utc == DEPARTURE
    expected_arrival = DEPARTURE + timedelta(seconds=profile.total_time_s)
    assert abs((placements[-1].eta_utc - expected_arrival).total_seconds()) <= 60
    assert placements[-1].point == points[-1]
    assert sum(p.covered_mi for p in placements) == pytest.approx(
        profile.length_m / METERS_PER_MILE
    )


@pytest.mark.parametrize("interval", [10, 25, 50])
def test_interval_changes_checkpoint_count(interval: int) -> None:
    points = make_line(LatLon(40, -100), LatLon(40, -97), 30)  # ≈ 158 mi
    profile = build_profile(points, make_progress(points))
    length_mi = profile.length_m / METERS_PER_MILE

    placements = place_checkpoints(profile, interval, DEPARTURE)

    regular = math.floor(length_mi / interval) + 1
    assert len(placements) in (regular, regular + 1)
    assert [p.index for p in placements] == list(range(len(placements)))
