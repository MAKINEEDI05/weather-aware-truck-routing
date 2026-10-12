"""Fake providers for planner/API tests (hand-made data, never shown in the app)."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Any

import pytest

from trips.domain.types import HourlySeries, LatLon
from trips.services import open_meteo, tomtom
from trips.tests import synthetic_tomtom

WeatherRule = Callable[[LatLon], tuple[float | None, float | None, float | None] | None]


def calm(_: LatLon) -> tuple[float, float, float]:
    return 10.0, 0.0, 0.0


def windy_near_salina(point: LatLon) -> tuple[float, float, float]:
    """40 mph around Salina, KS (only the 'south' synthetic corridor passes there)."""
    if 38.5 < point.lat < 39.2 and -99.5 < point.lon < -96.0:
        return 40.0, 0.0, 0.0
    return 10.0, 0.0, 0.0


class FakeWeather:
    """Fake `open_meteo.fetch_hourly`. `fail_calls` fails every location of those call indexes
    (0 = checkpoints, 1 = heatmap cells); `rate_limited` marks failures as HTTP 429."""

    def __init__(
        self,
        rule: WeatherRule = calm,
        fail: Callable[[LatLon], bool] | None = None,
        fail_calls: tuple[int, ...] = (),
        rate_limited: bool = False,
    ):
        self.rule = rule
        self.fail = fail or (lambda _: False)
        self.fail_calls = fail_calls
        self.rate_limited = rate_limited
        self.calls: list[tuple[int, datetime, datetime]] = []

    def __call__(
        self, locations: Sequence[LatLon], start: datetime, end: datetime, **_: Any
    ) -> open_meteo.WeatherFetch:
        unique = list(dict.fromkeys(locations))
        call_index = len(self.calls)
        self.calls.append((len(unique), start, end))
        hours = int((end - start).total_seconds() // 3600) + 1
        epoch0 = int(start.timestamp())
        series: dict[LatLon, HourlySeries | None] = {}
        failed = 0
        for point in unique:
            failing = call_index in self.fail_calls or self.fail(point)
            values = None if failing else self.rule(point)
            if values is None:
                series[point] = None
                failed += 1
                continue
            wind, rain, snow = values
            series[point] = HourlySeries(
                requested=point,
                grid_point=LatLon(round(point.lat, 2), round(point.lon, 2)),
                times=tuple(epoch0 + 3600 * k for k in range(hours)),
                wind_mph=(wind,) * hours,
                rain_in=(rain,) * hours,
                snow_in=(snow,) * hours,
            )
        return open_meteo.WeatherFetch(
            series=series,
            location_count=len(unique),
            failed_count=failed,
            request_count=1,
            cache_hits=0,
            rate_limited=self.rate_limited and failed > 0,
        )


def install(
    monkeypatch: pytest.MonkeyPatch,
    routes_body: dict[str, Any] | None = None,
    weather: FakeWeather | None = None,
) -> FakeWeather:
    body = routes_body or synthetic_tomtom.three_routes_response()

    def fake_routes(origin, destination, departure_utc, now=None):
        return tomtom.parse_routes(body)

    weather = weather or FakeWeather()
    monkeypatch.setattr(tomtom, "calculate_routes", fake_routes)
    monkeypatch.setattr(open_meteo, "fetch_hourly", weather)
    return weather
