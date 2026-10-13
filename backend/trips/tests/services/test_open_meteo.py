import copy
import json
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
import responses

from trips.domain.types import LatLon
from trips.services import open_meteo

START = datetime(2026, 10, 14, 13, 0, tzinfo=UTC)
END = datetime(2026, 10, 16, 13, 0, tzinfo=UTC)
RECORDED_POINTS = [
    LatLon(41.8842, -87.6324),
    LatLon(39.7392, -104.9903),
    LatLon(38.84, -97.61),
]


def _synthetic_location(template: dict[str, Any], lat: float, lon: float) -> dict[str, Any]:
    """A response entry in the verified live format (VF-1 – VF-3), re-centred on lat/lon."""
    item = copy.deepcopy(template)
    item["latitude"], item["longitude"] = lat, lon
    return item


def _callback_factory(template: dict[str, Any]):
    def callback(request):
        query = parse_qs(urlparse(request.url).query)
        lats = query["latitude"][0].split(",")
        lons = query["longitude"][0].split(",")
        items = [
            _synthetic_location(template, float(a), float(b))
            for a, b in zip(lats, lons, strict=True)
        ]
        body = items if len(items) > 1 else items[0]
        return 200, {"Content-Type": "application/json"}, json.dumps(body)

    return callback


@responses.activate
def test_parses_recorded_response(open_meteo_recorded) -> None:
    responses.get(open_meteo.BASE_URL, json=open_meteo_recorded)

    result = open_meteo.fetch_hourly(RECORDED_POINTS, START, END)

    assert result.location_count == 3
    assert result.failed_count == 0
    assert result.request_count == 1
    for point, raw in zip(RECORDED_POINTS, open_meteo_recorded, strict=True):
        series = result.series[point]
        assert series is not None
        assert series.requested == point
        assert series.grid_point == LatLon(raw["latitude"], raw["longitude"])
        assert len(series.times) == 49
        assert series.times[0] == int(START.timestamp())
        hourly = raw["hourly"]
        for i in (0, 24, 48):
            assert series.wind_mph[i] == hourly["wind_speed_10m"][i]
            assert series.rain_in[i] == pytest.approx(hourly["rain"][i] + hourly["showers"][i])
            assert series.snow_in[i] == hourly["snowfall"][i]


@responses.activate
def test_request_parameters(open_meteo_recorded) -> None:
    responses.get(open_meteo.BASE_URL, json=open_meteo_recorded)

    open_meteo.fetch_hourly(RECORDED_POINTS, START, END)

    query = parse_qs(urlparse(responses.calls[0].request.url).query)
    assert query["latitude"] == ["41.884200,39.739200,38.840000"]
    assert query["hourly"] == ["wind_speed_10m,rain,showers,snowfall"]
    assert query["wind_speed_unit"] == ["mph"]
    assert query["precipitation_unit"] == ["inch"]
    assert query["timeformat"] == ["unixtime"]
    assert query["timezone"] == ["GMT"]
    assert query["start_hour"] == ["2026-10-14T13:00"]
    assert query["end_hour"] == ["2026-10-16T13:00"]


@responses.activate
def test_single_location_object_response(open_meteo_recorded) -> None:
    responses.get(open_meteo.BASE_URL, json=open_meteo_recorded[0])

    result = open_meteo.fetch_hourly(RECORDED_POINTS[:1], START, END)

    assert result.series[RECORDED_POINTS[0]] is not None


@responses.activate
def test_batches_preserve_order_and_deduplicate(open_meteo_recorded) -> None:
    responses.add_callback(
        responses.GET, open_meteo.BASE_URL, callback=_callback_factory(open_meteo_recorded[0])
    )
    points = [LatLon(30 + i * 0.01, -100.0) for i in range(250)]

    result = open_meteo.fetch_hourly(points + points[:10], START, END, batch_size=100)

    assert result.request_count == 3
    assert result.location_count == 250
    for point in points:
        series = result.series[point]
        assert series is not None and series.requested == point
        assert series.grid_point.lat == pytest.approx(round(point.lat, 6))


@responses.activate
def test_failed_batch_leaves_its_locations_missing(open_meteo_recorded) -> None:
    template = open_meteo_recorded[0]
    calls = {"n": 0}

    def callback(request):
        calls["n"] += 1
        query = parse_qs(urlparse(request.url).query)
        if query["latitude"][0].startswith("31."):  # second batch always fails
            return 500, {}, ""
        return _callback_factory(template)(request)

    responses.add_callback(responses.GET, open_meteo.BASE_URL, callback=callback)
    points = [LatLon(30 + i * 0.01, -100.0) for i in range(200)]

    result = open_meteo.fetch_hourly(points, START, END, batch_size=100)

    assert result.failed_count == 100
    assert all(result.series[p] is not None for p in points[:100])
    assert all(result.series[p] is None for p in points[100:])
    assert calls["n"] == 3  # failing batch retried once


@responses.activate
def test_unexpected_units_fail_the_batch(open_meteo_recorded) -> None:
    body = copy.deepcopy(open_meteo_recorded)
    body[1]["hourly_units"]["wind_speed_10m"] = "km/h"
    responses.get(open_meteo.BASE_URL, json=body)

    result = open_meteo.fetch_hourly(RECORDED_POINTS, START, END)

    assert result.failed_count == 3
    assert all(series is None for series in result.series.values())


@responses.activate
def test_wrong_location_count_fails_the_batch(open_meteo_recorded) -> None:
    responses.get(open_meteo.BASE_URL, json=open_meteo_recorded[:2])

    assert open_meteo.fetch_hourly(RECORDED_POINTS, START, END).failed_count == 3


@responses.activate
def test_bad_request_is_not_retried(open_meteo_recorded) -> None:
    responses.get(
        open_meteo.BASE_URL, status=400, json={"error": True, "reason": "out of allowed range"}
    )

    result = open_meteo.fetch_hourly(RECORDED_POINTS, START, END)

    assert result.failed_count == 3
    assert len(responses.calls) == 1


@responses.activate
def test_missing_showers_makes_rain_missing(open_meteo_recorded) -> None:
    body = copy.deepcopy(open_meteo_recorded)
    body[0]["hourly"]["showers"][5] = None
    responses.get(open_meteo.BASE_URL, json=body)

    series = open_meteo.fetch_hourly(RECORDED_POINTS, START, END).series[RECORDED_POINTS[0]]

    assert series is not None
    assert series.rain_in[5] is None
    assert series.rain_in[6] is not None


@responses.activate
def test_cache_avoids_repeat_requests(open_meteo_recorded) -> None:
    responses.get(open_meteo.BASE_URL, json=open_meteo_recorded)

    first = open_meteo.fetch_hourly(RECORDED_POINTS, START, END)
    second = open_meteo.fetch_hourly(RECORDED_POINTS, START, END)

    assert len(responses.calls) == 1
    assert second.cache_hits == 3
    assert second.request_count == 0
    assert second.series == first.series


@responses.activate
def test_failed_results_are_not_cached(open_meteo_recorded) -> None:
    responses.get(open_meteo.BASE_URL, status=500)
    open_meteo.fetch_hourly(RECORDED_POINTS, START, END)
    responses.replace(responses.GET, open_meteo.BASE_URL, json=open_meteo_recorded)

    result = open_meteo.fetch_hourly(RECORDED_POINTS, START, END)

    assert result.failed_count == 0
    assert result.cache_hits == 0


@responses.activate
def test_rate_limit_is_not_retried_and_is_reported(open_meteo_recorded) -> None:
    # Regression (VF-11): the limit is per minute, so an immediate retry only wastes a call.
    responses.get(
        open_meteo.BASE_URL,
        status=429,
        json={"error": True, "reason": "Minutely API request limit exceeded."},
    )

    result = open_meteo.fetch_hourly(RECORDED_POINTS, START, END)

    assert len(responses.calls) == 1
    assert result.failed_count == 3
    assert result.rate_limited is True
    assert result.rate_limit_reason == "Minutely API request limit exceeded."


@responses.activate
def test_rate_limit_reason_is_logged(open_meteo_recorded, caplog) -> None:
    reason = "Daily API request limit exceeded. Please try again tomorrow."
    responses.get(open_meteo.BASE_URL, status=429, json={"error": True, "reason": reason})

    with caplog.at_level("WARNING", logger="trips.providers"):
        open_meteo.fetch_hourly(RECORDED_POINTS, START, END)

    assert any(reason in record.getMessage() for record in caplog.records)


@responses.activate
def test_cache_only_mode_makes_no_request(open_meteo_recorded) -> None:
    responses.get(open_meteo.BASE_URL, json=open_meteo_recorded[0])
    open_meteo.fetch_hourly(RECORDED_POINTS[:1], START, END)  # caches the first point

    result = open_meteo.fetch_hourly(RECORDED_POINTS, START, END, network=False)

    assert len(responses.calls) == 1
    assert result.cache_hits == 1
    assert result.failed_count == 2
    assert result.series[RECORDED_POINTS[0]] is not None
    assert result.series[RECORDED_POINTS[1]] is None


@responses.activate
def test_server_errors_are_not_reported_as_rate_limits(open_meteo_recorded) -> None:
    responses.get(open_meteo.BASE_URL, status=503)

    result = open_meteo.fetch_hourly(RECORDED_POINTS, START, END)

    assert len(responses.calls) == 2
    assert result.rate_limited is False
