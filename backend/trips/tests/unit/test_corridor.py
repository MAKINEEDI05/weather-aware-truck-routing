import math

from trips.domain.corridor import (
    HOURS,
    MAX_CELLS,
    _cells_for,
    corridor_cells,
    corridor_grid,
    sample_route,
)
from trips.domain.geo import METERS_PER_MILE, haversine_mi
from trips.domain.profile import build_profile
from trips.domain.types import LatLon
from trips.tests.factories import DEPARTURE, make_line, make_progress, make_series


def _profile(start: LatLon, end: LatLon, segments: int = 50):
    points = make_line(start, end, segments)
    return build_profile(points, make_progress(points))


def test_samples_every_five_miles_including_the_end() -> None:
    profile = _profile(LatLon(40, -100), LatLon(40, -99))
    samples = sample_route(profile)

    assert samples[0] == LatLon(40, -100)
    assert samples[-1] == LatLon(40, -99)
    assert len(samples) == math.floor(profile.length_m / METERS_PER_MILE / 5) + 2
    assert all(haversine_mi(a, b) <= 5.0 + 1e-6 for a, b in zip(samples, samples[1:], strict=False))


def test_cells_cover_route_with_one_cell_buffer() -> None:
    profile = _profile(LatLon(40.1, -100.1), LatLon(40.1, -99.1))

    size, centres = corridor_cells([profile])

    assert size == 0.25
    lats = sorted({c.lat for c in centres})
    lons = sorted({c.lon for c in centres})
    assert lats == [39.875, 40.125, 40.375]  # route row + one row either side
    assert lons[0] == -100.375 and lons[-1] == -98.875
    assert all(math.isclose((c.lat / 0.25) % 1, 0.5) for c in centres)
    assert len(centres) == len(set(centres))


def test_long_trips_are_coarsened() -> None:
    # A zig-zag across the country produces more than 400 cells at 0.25°.
    profiles = [
        _profile(LatLon(47, -122), LatLon(25.8, -80.2), 400),
        _profile(LatLon(34, -118), LatLon(42.4, -71), 400),
    ]

    size, centres = corridor_cells(profiles)

    assert size in (0.5, 1.0)
    assert len(centres) <= MAX_CELLS


def test_grid_has_49_hours_and_uses_load() -> None:
    centre = LatLon(40.125, -99.875)
    windy = make_series(centre, DEPARTURE, 60, wind=45.0, rain=0.0, snow=0.0)

    light = corridor_grid(DEPARTURE, 0.25, [centre], {centre: windy}, 30_000)
    heavy = corridor_grid(DEPARTURE, 0.25, [centre], {centre: windy}, 30_001)

    assert light.hours == HOURS == 49
    assert len(light.cells[0].risk) == 49
    assert set(light.cells[0].risk) == {3}  # SEVERE
    assert set(heavy.cells[0].risk) == {4}  # NO_TRAVEL (45–54 mph + > 30,000 lb)
    assert light.start_utc == DEPARTURE


def test_missing_hours_and_cells_are_unknown() -> None:
    centre = LatLon(40.125, -99.875)
    other = LatLon(40.375, -99.875)
    short = make_series(centre, DEPARTURE, 10)

    grid = corridor_grid(DEPARTURE, 0.25, [centre, other], {centre: short, other: None}, 0)

    assert grid.cells[0].risk[:10] == (0,) * 10
    assert grid.cells[0].risk[10:] == (-1,) * 39
    assert grid.cells[0].wind_mph[20] is None
    assert grid.cells[1].risk == (-1,) * 49


def test_grid_starts_at_departure_hour() -> None:
    departure = DEPARTURE.replace(minute=40)
    centre = LatLon(40.125, -99.875)

    grid = corridor_grid(departure, 0.25, [centre], {}, 0)

    assert grid.start_utc == DEPARTURE


def test_cell_cap_keeps_weather_requests_within_the_per_minute_limit() -> None:
    # Regression (VF-11): Open-Meteo counts each location; checkpoints need part of the budget.
    assert MAX_CELLS == 200


def test_continental_trips_drop_the_buffer_as_a_last_resort() -> None:
    profiles = [
        _profile(LatLon(47, -122), LatLon(25.8, -80.2), 400),
        _profile(LatLon(34, -118), LatLon(42.4, -71), 400),
    ]
    samples = [p for profile in profiles for p in sample_route(profile)]
    assert len(_cells_for(samples, 1.0, buffer=1)) > MAX_CELLS  # the buffered 1° grid is too big

    size, centres = corridor_cells(profiles)

    assert size == 1.0
    assert len(centres) == len(_cells_for(samples, 1.0, buffer=0))
