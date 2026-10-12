"""Corridor heatmap grid (DEC-15, DEC-16, DEC-34).

Cells are a regular lat/lon grid touched by any route (sampled every 5 mi) plus a one-cell
buffer. The grid is coarsened (0.25° → 0.5° → 1.0°) until it has at most 200 cells; as a last
resort (continental-scale trips) the 1.0° grid keeps only the cells the routes touch. Each cell
gets the overall risk for every hour 0–48 after the departure hour, using the same classifier
and the user's load as the checkpoints. The grid exists only to draw the heatmap.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from datetime import datetime

from .forecast import values_at_hour
from .geo import METERS_PER_MILE
from .profile import RouteProfile
from .risk import overall_level
from .timeutil import HOUR, floor_to_hour
from .types import RISK_CODE, CorridorCell, CorridorGrid, HourlySeries, LatLon

CELL_SIZES_DEG = (0.25, 0.5, 1.0)
# (cell size, buffer in cells) tried in order; the last entry drops the buffer.
GRID_TIERS: tuple[tuple[float, int], ...] = ((0.25, 1), (0.5, 1), (1.0, 1), (1.0, 0))
# 200, not the original 400 (DEC-34 amended): Open-Meteo counts every location against a
# 600-per-minute limit (VF-11), and checkpoints need part of that budget. Real Chicago → Denver
# routes need 369 cells at 0.5° and 154 at 1.0°.
MAX_CELLS = 200
SAMPLE_STEP_MI = 5.0
HOURS = 49  # hours 0–48 inclusive


def sample_route(profile: RouteProfile, step_mi: float = SAMPLE_STEP_MI) -> list[LatLon]:
    length_m = profile.length_m
    step_m = step_mi * METERS_PER_MILE
    samples = [profile.locate(k * step_m)[0] for k in range(int(length_m // step_m) + 1)]
    samples.append(profile.points[-1])
    return samples


def _cells_for(samples: Sequence[LatLon], size: float, buffer: int = 1) -> set[tuple[int, int]]:
    cells: set[tuple[int, int]] = set()
    offsets = range(-buffer, buffer + 1)
    for point in samples:
        i, j = math.floor(point.lat / size), math.floor(point.lon / size)
        for di in offsets:
            for dj in offsets:
                cells.add((i + di, j + dj))
    return cells


def corridor_cells(profiles: Sequence[RouteProfile]) -> tuple[float, list[LatLon]]:
    """Cell size and cell centres (sorted south→north, west→east)."""
    samples = [point for profile in profiles for point in sample_route(profile)]
    size = CELL_SIZES_DEG[-1]
    cells: set[tuple[int, int]] = set()
    for size, buffer in GRID_TIERS:
        cells = _cells_for(samples, size, buffer)
        if len(cells) <= MAX_CELLS:
            break
    centres = [
        LatLon(round((i + 0.5) * size, 6), round((j + 0.5) * size, 6)) for i, j in sorted(cells)
    ]
    return size, centres


def corridor_grid(
    departure_utc: datetime,
    cell_size_deg: float,
    centres: Sequence[LatLon],
    series_by_point: Mapping[LatLon, HourlySeries | None],
    load_lb: float,
) -> CorridorGrid:
    start = floor_to_hour(departure_utc)
    hours = [start + k * HOUR for k in range(HOURS)]
    cells: list[CorridorCell] = []
    for centre in centres:
        series = series_by_point.get(centre)
        risk: list[int] = []
        wind: list[float | None] = []
        rain: list[float | None] = []
        snow: list[float | None] = []
        for hour in hours:
            w, r, s = values_at_hour(series, hour)
            risk.append(RISK_CODE[overall_level(w, r, s, load_lb)])
            wind.append(w)
            rain.append(r)
            snow.append(s)
        cells.append(
            CorridorCell(
                lat=centre.lat,
                lon=centre.lon,
                risk=tuple(risk),
                wind_mph=tuple(wind),
                rain_in_hr=tuple(rain),
                snow_in_hr=tuple(snow),
            )
        )
    return CorridorGrid(
        start_utc=start, hours=HOURS, cell_size_deg=cell_size_deg, cells=tuple(cells)
    )
