import pytest

from trips.domain.geo import haversine_m
from trips.domain.profile import InvalidRouteProfile, build_profile
from trips.domain.types import LatLon, ProgressPoint
from trips.tests.factories import make_line, make_progress

A = LatLon(40.0, -100.0)
B = LatLon(40.0, -99.0)


def test_linear_profile_is_half_time_at_half_distance() -> None:
    points = make_line(A, B, 10)
    profile = build_profile(points, make_progress(points))

    point, time_s = profile.locate(profile.length_m / 2)

    assert time_s == pytest.approx(profile.total_time_s / 2, rel=1e-6)
    assert point.lon == pytest.approx(-99.5, abs=1e-6)


def test_non_linear_profile_is_piecewise_linear() -> None:
    points = (A, LatLon(40.0, -99.5), B)
    half = haversine_m(points[0], points[1])
    total = half + haversine_m(points[1], points[2])
    # First half at 1 000 s, second half takes 3 000 s more (slower).
    progress = (
        ProgressPoint(0, 0, 0),
        ProgressPoint(1, half, 1000),
        ProgressPoint(2, total, 4000),
    )
    profile = build_profile(points, progress)

    assert profile.locate(half / 2)[1] == pytest.approx(500)
    assert profile.locate(half + (total - half) / 2)[1] == pytest.approx(2500)


def test_sparse_progress_is_spread_by_polyline_length() -> None:
    points = make_line(A, B, 10)
    dense = make_progress(points)
    sparse = (dense[0], dense[-1])  # only the first and last elements

    profile = build_profile(points, sparse)

    for index, item in enumerate(dense):
        assert profile.distance_m[index] == pytest.approx(item.distance_m, rel=1e-9)
        assert profile.time_s[index] == pytest.approx(item.time_s, rel=1e-9)


def test_missing_first_progress_element_assumes_zero() -> None:
    points = make_line(A, B, 4)
    progress = make_progress(points)[1:]

    profile = build_profile(points, progress)

    assert profile.distance_m[0] == 0
    assert profile.time_s[0] == 0


def test_progress_must_reach_last_point() -> None:
    points = make_line(A, B, 4)

    with pytest.raises(InvalidRouteProfile, match="last route point"):
        build_profile(points, make_progress(points)[:-1])


@pytest.mark.parametrize("field", ["distance_m", "time_s"])
def test_decreasing_progress_is_rejected(field: str) -> None:
    points = make_line(A, B, 2)
    good = make_progress(points)
    values = {"distance_m": good[1].distance_m, "time_s": good[1].time_s}
    values[field] = getattr(good[2], field) + 1  # middle larger than the end
    bad = (good[0], ProgressPoint(1, **values), good[2])

    with pytest.raises(InvalidRouteProfile, match="must not decrease"):
        build_profile(points, bad)


def test_single_point_route_is_rejected() -> None:
    with pytest.raises(InvalidRouteProfile):
        build_profile((A,), (ProgressPoint(0, 0, 0),))


def test_locate_clamps_to_endpoints() -> None:
    points = make_line(A, B, 3)
    profile = build_profile(points, make_progress(points))

    assert profile.locate(-5)[0] == A
    assert profile.locate(profile.length_m + 100) == (B, profile.total_time_s)


def test_zero_length_segments_are_handled() -> None:
    points = (A, A, B)
    total = haversine_m(A, B)
    progress = (ProgressPoint(0, 0, 0), ProgressPoint(1, 0, 0), ProgressPoint(2, total, 100))

    profile = build_profile(points, progress)

    assert profile.locate(total / 2)[1] == pytest.approx(50)
