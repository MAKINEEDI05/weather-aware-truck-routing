"""Contract, validation and error-mapping tests for POST /api/v1/trips/plan/."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from django.test import Client
from rest_framework.throttling import ScopedRateThrottle

from trips import planner
from trips.services.errors import (
    NoRouteFound,
    ProviderAuthError,
    ProviderBadResponse,
    ProviderNotConfigured,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)
from trips.tests.fakes import FakeWeather, install, windy_near_salina

URL = "/api/v1/trips/plan/"
RISK_LEVELS = {"LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL", "UNKNOWN"}


def departure(delta: timedelta = timedelta(days=1)) -> str:
    local = (datetime.now(UTC) + delta).astimezone(
        datetime.now().astimezone().tzinfo
    )  # any offset is fine
    return local.replace(microsecond=0).isoformat()


def payload(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "origin": {"label": "Chicago, IL", "lat": 41.8842, "lon": -87.6324},
        "destination": {"label": "Denver, CO", "lat": 39.7392, "lon": -104.9903},
        "departure_time": departure(),
        "load_weight_lb": 42_000,
        "checkpoint_interval_mi": 25,
    }
    body.update(overrides)
    return body


def post(client: Client, body: Any, content_type: str = "application/json"):
    data = body if isinstance(body, str) else json.dumps(body)
    return client.post(URL, data=data, content_type=content_type)


def assert_error(response, status: int, code: str) -> dict[str, Any]:
    assert response.status_code == status, response.content
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "details"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]
    assert isinstance(body["error"]["details"], dict)
    return body["error"]


# --- contract ---------------------------------------------------------------------------------


def test_successful_plan_matches_contract(client: Client, monkeypatch) -> None:
    install(monkeypatch, weather=FakeWeather(windy_near_salina))

    response = post(client, payload())

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"request", "routes", "recommendation", "corridor", "warnings", "meta"}
    assert body["request"]["departure_time"].endswith("Z")
    assert body["request"]["checkpoint_interval_mi"] == 25

    assert [r["id"] for r in body["routes"]] == ["A", "B", "C"]
    route = body["routes"][0]
    assert set(route) == {
        "id", "label", "source", "provider_index", "distance_mi", "travel_time_s",
        "traffic_delay_s", "departure_time", "arrival_time", "geometry", "checkpoints",
        "metrics", "rank", "eligible", "is_recommended",
    }  # fmt: skip
    assert route["label"] == "Route A"
    assert route["source"] == "provider"
    assert isinstance(route["travel_time_s"], int)
    assert all(len(point) == 2 for point in route["geometry"])
    assert set(route["metrics"]) == {
        "low_mi", "moderate_mi", "high_mi", "severe_mi", "no_travel_mi", "unknown_mi",
        "known_mi", "average_risk",
    }  # fmt: skip

    checkpoint = route["checkpoints"][0]
    assert set(checkpoint) == {
        "index", "mile", "lat", "lon", "covered_mi", "eta", "weather", "risk",
    }  # fmt: skip
    assert set(checkpoint["weather"]) == {
        "provider_grid_point", "wind_mph", "wind_hour", "rain_in_hr", "snow_in_hr",
        "precip_hour",
    }  # fmt: skip
    assert set(checkpoint["risk"]) == {
        "overall", "wind", "rain", "snow", "load_adjusted", "reasons",
    }  # fmt: skip
    for r in body["routes"]:
        for c in r["checkpoints"]:
            assert c["risk"]["overall"] in RISK_LEVELS
            assert c["eta"].endswith("Z")

    rec = body["recommendation"]
    assert set(rec) == {
        "status", "route_id", "ranking", "comparisons", "ineligible", "explanation",
    }  # fmt: skip
    assert rec["status"] == "RECOMMENDED"
    assert sorted(rec["ranking"]) == ["A", "B", "C"]
    assert len(rec["comparisons"]) == 2
    assert set(rec["comparisons"][0]) == {
        "other_route", "other_rank", "other_eligible", "decided_by", "recommended_value",
        "other_value",
    }  # fmt: skip
    ranks = {r["id"]: r["rank"] for r in body["routes"]}
    assert [rid for rid, _ in sorted(ranks.items(), key=lambda item: item[1])] == rec["ranking"]
    assert sum(r["is_recommended"] for r in body["routes"]) == 1

    corridor = body["corridor"]
    assert corridor["hours"] == 49
    assert corridor["start_time"].endswith(":00:00Z")
    assert corridor["cells"]
    for cell in corridor["cells"]:
        for key in ("risk", "wind_mph", "rain_in_hr", "snow_in_hr"):
            assert len(cell[key]) == 49
        assert set(cell["risk"]) <= {-1, 0, 1, 2, 3, 4}

    assert body["meta"]["route_count"] == 3
    assert body["meta"]["providers"]["weather"].startswith("Open-Meteo")
    assert all(set(w) == {"code", "message"} for w in body["warnings"])


def test_response_is_gzip_compressed_when_accepted(client: Client, monkeypatch) -> None:
    install(monkeypatch)

    response = client.post(
        URL, data=json.dumps(payload()), content_type="application/json",
        headers={"Accept-Encoding": "gzip"},
    )  # fmt: skip

    assert response.status_code == 200
    assert response["Content-Encoding"] == "gzip"


# --- validation -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("overrides", "field", "code"),
    [
        ({"origin": None}, "origin", "INVALID_INPUT"),
        ({"origin": {"label": "X", "lat": 91, "lon": 0}}, "origin", "INVALID_INPUT"),
        ({"origin": {"label": "", "lat": 41, "lon": -87}}, "origin", "INVALID_INPUT"),
        ({"destination": {"label": "X", "lat": 41, "lon": 181}}, "destination", "INVALID_INPUT"),
        ({"departure_time": "2026-10-14T08:00:00"}, "departure_time", "INVALID_INPUT"),
        ({"departure_time": "tomorrow"}, "departure_time", "INVALID_INPUT"),
        ({"load_weight_lb": -1}, "load_weight_lb", "INVALID_INPUT"),
        ({"load_weight_lb": 100_001}, "load_weight_lb", "INVALID_INPUT"),
        ({"load_weight_lb": "abc"}, "load_weight_lb", "INVALID_INPUT"),
        ({"load_weight_lb": True}, "load_weight_lb", "INVALID_INPUT"),
        ({"checkpoint_interval_mi": 15}, "checkpoint_interval_mi", "INVALID_INPUT"),
    ],
)
def test_invalid_fields(client: Client, overrides, field: str, code: str) -> None:
    error = assert_error(post(client, payload(**overrides)), 400, code)

    assert field in error["details"]


def test_missing_field(client: Client) -> None:
    body = payload()
    del body["load_weight_lb"]

    error = assert_error(post(client, body), 400, "INVALID_INPUT")

    assert "load_weight_lb" in error["details"]


@pytest.mark.parametrize("delta", [timedelta(minutes=-20), timedelta(days=-1), timedelta(days=8)])
def test_departure_out_of_range(client: Client, delta: timedelta) -> None:
    error = assert_error(
        post(client, payload(departure_time=departure(delta))), 400, "DEPARTURE_OUT_OF_RANGE"
    )

    assert "departure_time" in error["details"]


def test_departure_within_grace_is_accepted(client: Client, monkeypatch) -> None:
    install(monkeypatch)

    response = post(client, payload(departure_time=departure(timedelta(minutes=-10))))

    assert response.status_code == 200


def test_same_location(client: Client) -> None:
    near = {"label": "Chicago Loop", "lat": 41.8850, "lon": -87.6330}

    error = assert_error(post(client, payload(destination=near)), 400, "SAME_LOCATION")

    assert "destination" in error["details"]


def test_malformed_json(client: Client) -> None:
    assert_error(post(client, "{not json"), 400, "INVALID_INPUT")


def test_non_json_body(client: Client) -> None:
    assert_error(post(client, "a=b", content_type="application/x-www-form-urlencoded"), 415,
                 "INVALID_INPUT")  # fmt: skip


def test_get_is_not_allowed(client: Client) -> None:
    assert_error(client.get(URL), 405, "METHOD_NOT_ALLOWED")


# --- provider errors --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (NoRouteFound("TomTom", "x"), 422, "NO_ROUTE_FOUND"),
        (ProviderNotConfigured("TomTom", "x"), 503, "ROUTING_NOT_CONFIGURED"),
        (ProviderAuthError("TomTom", "x", status=403), 502, "ROUTING_CONFIGURATION_ERROR"),
        (ProviderTimeout("TomTom", "x"), 504, "UPSTREAM_TIMEOUT"),
        (ProviderUnavailable("TomTom", "x", status=500), 502, "ROUTING_UNAVAILABLE"),
        (ProviderBadResponse("TomTom", "x"), 502, "ROUTING_UNAVAILABLE"),
    ],
)
def test_provider_errors_are_mapped(client: Client, monkeypatch, error, status, code) -> None:
    def fail(_command):
        raise error

    monkeypatch.setattr(planner, "plan_trip", fail)

    assert_error(post(client, payload()), status, code)


def test_rate_limit_sets_retry_after(client: Client, monkeypatch) -> None:
    def fail(_command):
        raise ProviderRateLimited("TomTom", "x", status=429, retry_after_s=30)

    monkeypatch.setattr(planner, "plan_trip", fail)

    response = post(client, payload())

    error = assert_error(response, 503, "RATE_LIMITED")
    assert response["Retry-After"] == "30"
    assert error["details"] == {"retry_after_s": 30}


def test_unexpected_error_is_500_without_details(client: Client, monkeypatch) -> None:
    def boom(_command):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(planner, "plan_trip", boom)

    response = post(client, payload())

    error = assert_error(response, 500, "INTERNAL_ERROR")
    assert "secret internal detail" not in response.content.decode()
    assert error["details"] == {}


def test_own_throttle(client: Client, monkeypatch) -> None:
    install(monkeypatch)
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"plan": "2/min"})

    assert post(client, payload()).status_code == 200
    assert post(client, payload()).status_code == 200
    response = post(client, payload())

    error = assert_error(response, 429, "TOO_MANY_REQUESTS")
    assert int(response["Retry-After"]) > 0
    assert error["details"]["retry_after_s"] > 0


def test_unknown_api_path_is_json_404(client: Client) -> None:
    assert_error(client.get("/api/v1/nope/"), 404, "NOT_FOUND")
