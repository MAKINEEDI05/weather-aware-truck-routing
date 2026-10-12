from datetime import UTC, datetime

import pytest

from trips.domain.forecast import lookup_weather, values_at_hour
from trips.domain.timeutil import ceil_to_hour, floor_to_hour, nearest_hour
from trips.domain.types import HourlySeries, LatLon

POINT = LatLon(40.0, -100.0)
START = datetime(2026, 10, 14, 12, 0, tzinfo=UTC)


def _series() -> HourlySeries:
    # Distinct values per hour so the chosen record is identifiable: hour 12 → 12.0, etc.
    epochs = tuple(int(START.timestamp()) + 3600 * k for k in range(6))
    return HourlySeries(
        requested=POINT,
        grid_point=LatLon(40.01, -99.99),
        times=epochs,
        wind_mph=(12.0, 13.0, 14.0, 15.0, None, 17.0),
        rain_in=(0.12, 0.13, 0.14, 0.15, 0.16, None),
        snow_in=(1.2, 1.3, 1.4, 1.5, 1.6, None),
    )


def _at(hour: int, minute: int = 0, second: int = 0) -> datetime:
    return datetime(2026, 10, 14, hour, minute, second, tzinfo=UTC)


@pytest.mark.parametrize(
    ("eta", "precip_hour", "wind_hour"),
    [
        (_at(14), 14, 14),
        (_at(14, 20), 15, 14),
        (_at(14, 30), 15, 15),
        (_at(14, 45), 15, 15),
        (_at(14, 0, 1), 15, 14),
    ],
)
def test_forecast_hour_selection(eta: datetime, precip_hour: int, wind_hour: int) -> None:
    weather = lookup_weather(_series(), eta)

    assert weather is not None
    assert weather.precip_hour == _at(precip_hour)
    assert weather.wind_hour == _at(wind_hour)
    assert weather.wind_mph == float(wind_hour)  # wind value encodes the hour
    assert weather.rain_in_hr == pytest.approx(precip_hour / 100)
    assert weather.snow_in_hr == pytest.approx(precip_hour / 10)
    assert weather.grid_point == LatLon(40.01, -99.99)


def test_missing_record_leaves_component_missing() -> None:
    weather = lookup_weather(_series(), _at(16))  # wind None at 16:00

    assert weather is not None
    assert weather.wind_mph is None
    assert weather.rain_in_hr == pytest.approx(0.16)


def test_hour_outside_series_is_missing() -> None:
    weather = lookup_weather(_series(), _at(20, 10))

    assert weather is not None
    assert (weather.wind_mph, weather.rain_in_hr, weather.snow_in_hr) == (None, None, None)


def test_no_series_means_no_weather() -> None:
    assert lookup_weather(None, _at(14)) is None
    assert values_at_hour(None, _at(14)) == (None, None, None)


def test_values_at_clock_hour_use_that_record() -> None:
    assert values_at_hour(_series(), _at(13)) == (13.0, 0.13, 1.3)


def test_hour_helpers() -> None:
    assert floor_to_hour(_at(14, 59, 59)) == _at(14)
    assert ceil_to_hour(_at(14)) == _at(14)
    assert ceil_to_hour(_at(14, 0, 1)) == _at(15)
    assert nearest_hour(_at(14, 29, 59)) == _at(14)
    assert nearest_hour(_at(14, 30)) == _at(15)


def test_naive_datetimes_are_rejected() -> None:
    with pytest.raises(ValueError, match="Naive"):
        floor_to_hour(datetime(2026, 10, 14, 12))
