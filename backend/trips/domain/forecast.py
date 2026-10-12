"""Choosing the forecast record for a checkpoint ETA (DEC-24).

Open-Meteo semantics: `wind_speed_10m` is the value at the stated hour; `rain`, `showers` and
`snowfall` are sums over the *preceding* hour.

- Rain and snow use the record stamped `ceil_to_hour(ETA)` (the ETA itself if exactly on the
  hour), i.e. the hourly total whose interval contains the ETA, used as the in/hr rate.
- Wind uses the record at the nearest hour (exactly half past rounds up).
- No interpolation between hours. A missing record leaves that component missing.
"""

from __future__ import annotations

from datetime import datetime

from .timeutil import ceil_to_hour, nearest_hour, to_epoch
from .types import HourlySeries, WeatherAtCheckpoint


def _value(values: tuple[float | None, ...], index: int | None) -> float | None:
    return None if index is None else values[index]


def lookup_weather(series: HourlySeries | None, eta_utc: datetime) -> WeatherAtCheckpoint | None:
    if series is None:
        return None
    wind_hour = nearest_hour(eta_utc)
    precip_hour = ceil_to_hour(eta_utc)
    wind_index = series.index_of(to_epoch(wind_hour))
    precip_index = series.index_of(to_epoch(precip_hour))
    return WeatherAtCheckpoint(
        grid_point=series.grid_point,
        wind_mph=_value(series.wind_mph, wind_index),
        wind_hour=wind_hour,
        rain_in_hr=_value(series.rain_in, precip_index),
        snow_in_hr=_value(series.snow_in, precip_index),
        precip_hour=precip_hour,
    )


def values_at_hour(
    series: HourlySeries | None, hour_utc: datetime
) -> tuple[float | None, float | None, float | None]:
    """Wind, rain and snow for a clock hour (corridor heatmap): all from the record stamped there.

    This is the same rule as an ETA exactly on the hour.
    """
    if series is None:
        return None, None, None
    index = series.index_of(to_epoch(hour_utc))
    return (
        _value(series.wind_mph, index),
        _value(series.rain_in, index),
        _value(series.snow_in, index),
    )
