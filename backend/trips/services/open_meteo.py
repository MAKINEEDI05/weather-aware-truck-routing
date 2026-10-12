"""Open-Meteo hourly forecast client.

Facts verified with live calls on 2026-10-12 (docs/DECISIONS.md VF-1 – VF-6):
- comma-separated coordinates return a list in request order; a single location returns an object;
- `hourly_units`: wind_speed_10m "mp/h"; rain, showers, snowfall "inch";
- `start_hour`/`end_hour` are inclusive; `timeformat=unixtime` gives epoch seconds (UTC);
- a batch of 100 locations is ≈ 2.4 KB of URL and ≈ 1.8 s.

Free tier: non-commercial use, < 600 calls/min and < 10,000 calls/day, CC BY 4.0 attribution
(VF-7). Observed live on 2026-10-12 (VF-11): every location in a multi-location request counts
against the per-minute limit, so a burst of ≈ 600 locations returns HTTP 429.

Failures never raise: the affected locations come back as None (missing weather → UNKNOWN).
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
from numbers import Real
from typing import Any

from django.conf import settings
from django.core.cache import cache

from trips.domain.timeutil import require_utc, to_epoch
from trips.domain.types import HourlySeries, LatLon

from .errors import ProviderError, ProviderRateLimited
from .http import get_json

logger = logging.getLogger("trips.providers")

PROVIDER = "Open-Meteo"
BASE_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT = (5.0, 15.0)
MAX_IN_FLIGHT = 3
HOURLY_VARIABLES = ("wind_speed_10m", "rain", "showers", "snowfall")
EXPECTED_UNITS = {"wind_speed_10m": "mp/h", "rain": "inch", "showers": "inch", "snowfall": "inch"}
# 429 is not retried: the limit is per minute, so an immediate retry only spends another call.
RETRY_STATUSES = (500, 502, 503, 504)
_CACHE_PREFIX = "open-meteo:v1"


@dataclass(frozen=True, slots=True)
class WeatherFetch:
    series: dict[LatLon, HourlySeries | None]
    location_count: int
    failed_count: int
    request_count: int
    cache_hits: int
    # True when at least one batch was refused by the provider's rate limit (HTTP 429).
    rate_limited: bool = False


class _BatchError(Exception):
    pass


def _cache_key(point: LatLon, start: int, end: int) -> str:
    return f"{_CACHE_PREFIX}:{point.lat!r}:{point.lon!r}:{start}:{end}"


def fetch_hourly(
    locations: Sequence[LatLon],
    start_utc: datetime,
    end_utc: datetime,
    *,
    batch_size: int | None = None,
    cache_ttl_s: int | None = None,
) -> WeatherFetch:
    start_utc, end_utc = require_utc(start_utc), require_utc(end_utc)
    start_epoch, end_epoch = to_epoch(start_utc), to_epoch(end_utc)
    batch_size = batch_size or settings.WEATHER_BATCH_SIZE
    cache_ttl_s = settings.WEATHER_CACHE_TTL_S if cache_ttl_s is None else cache_ttl_s

    unique = list(dict.fromkeys(locations))  # identical coordinates only; no snapping
    results: dict[LatLon, HourlySeries | None] = {}
    missing: list[LatLon] = []
    for point in unique:
        cached = cache.get(_cache_key(point, start_epoch, end_epoch)) if cache_ttl_s else None
        if cached is not None:
            results[point] = cached
        else:
            missing.append(point)
    cache_hits = len(unique) - len(missing)

    batches = [missing[i : i + batch_size] for i in range(0, len(missing), batch_size)]
    failed = 0
    rate_limited = False
    if batches:
        workers = min(MAX_IN_FLIGHT, len(batches))
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="open-meteo") as pool:
            outcomes = list(pool.map(lambda b: _fetch_batch(b, start_utc, end_utc), batches))
        for batch, (outcome, limited) in zip(batches, outcomes, strict=True):
            rate_limited = rate_limited or limited
            if outcome is None:
                failed += len(batch)
                results.update(dict.fromkeys(batch))
                continue
            for point, series in zip(batch, outcome, strict=True):
                results[point] = series
                if cache_ttl_s:
                    cache.set(_cache_key(point, start_epoch, end_epoch), series, cache_ttl_s)

    return WeatherFetch(
        series={point: results.get(point) for point in unique},
        location_count=len(unique),
        failed_count=failed,
        request_count=len(batches),
        cache_hits=cache_hits,
        rate_limited=rate_limited,
    )


def _fetch_batch(
    batch: list[LatLon], start_utc: datetime, end_utc: datetime
) -> tuple[list[HourlySeries] | None, bool]:
    """Parsed series for the batch (or None if it failed) and whether it was rate-limited."""
    params = {
        "latitude": ",".join(f"{p.lat:.6f}" for p in batch),
        "longitude": ",".join(f"{p.lon:.6f}" for p in batch),
        "hourly": ",".join(HOURLY_VARIABLES),
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "GMT",
        "timeformat": "unixtime",
        "start_hour": start_utc.strftime("%Y-%m-%dT%H:%M"),
        "end_hour": end_utc.strftime("%Y-%m-%dT%H:%M"),
    }
    try:
        data = get_json(
            provider=PROVIDER,
            operation="forecast",
            url=BASE_URL,
            params=params,
            timeout=TIMEOUT,
            retry_statuses=RETRY_STATUSES,
        )
        return parse_forecast(data, batch), False
    except (ProviderError, _BatchError) as exc:
        logger.warning(
            "provider=%s op=forecast batch_failed locations=%d reason=%s",
            PROVIDER,
            len(batch),
            exc,
        )
        return None, isinstance(exc, ProviderRateLimited)


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool) or not isinstance(value, Real):
        return None
    return float(value)


def _parse_location(item: Any, requested: LatLon) -> HourlySeries:
    if not isinstance(item, dict):
        raise _BatchError("location entry is not an object")
    units = item.get("hourly_units") or {}
    for variable, unit in EXPECTED_UNITS.items():
        if units.get(variable) != unit:
            raise _BatchError(f"unexpected unit for {variable}: {units.get(variable)!r}")
    hourly = item.get("hourly")
    if not isinstance(hourly, dict) or not isinstance(hourly.get("time"), list):
        raise _BatchError("missing hourly data")
    times = hourly["time"]
    columns = {name: hourly.get(name) for name in HOURLY_VARIABLES}
    if any(not isinstance(col, list) or len(col) != len(times) for col in columns.values()):
        raise _BatchError("hourly arrays have inconsistent lengths")
    if any(isinstance(t, bool) or not isinstance(t, int) for t in times):
        raise _BatchError("hourly times are not epoch seconds")

    def rain_total(rain: Any, showers: Any) -> float | None:
        r, s = _number(rain), _number(showers)
        return None if r is None or s is None else r + s  # DEC-35

    try:
        grid_point = LatLon(float(item["latitude"]), float(item["longitude"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise _BatchError("missing grid point") from exc

    return HourlySeries(
        requested=requested,
        grid_point=grid_point,
        times=tuple(times),
        wind_mph=tuple(_number(v) for v in columns["wind_speed_10m"]),
        rain_in=tuple(
            rain_total(r, s) for r, s in zip(columns["rain"], columns["showers"], strict=True)
        ),
        snow_in=tuple(_number(v) for v in columns["snowfall"]),
    )


def parse_forecast(data: Any, batch: Sequence[LatLon]) -> list[HourlySeries]:
    items = data if isinstance(data, list) else [data]
    if len(items) != len(batch):
        raise _BatchError(f"expected {len(batch)} locations, got {len(items)}")
    return [_parse_location(item, point) for item, point in zip(items, batch, strict=True)]
