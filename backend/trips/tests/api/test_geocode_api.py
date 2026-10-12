import re

import pytest
import responses
from django.test import Client, override_settings
from rest_framework.throttling import ScopedRateThrottle

from trips.tests.synthetic_tomtom import GEOCODE_SPRINGFIELD

URL = "/api/v1/geocode/"
TOMTOM = re.compile(r"https://api\.tomtom\.com/search/2/geocode/.*")


@responses.activate
def test_returns_candidates(client: Client) -> None:
    responses.get(TOMTOM, json=GEOCODE_SPRINGFIELD)

    response = client.get(URL, {"q": "Springfield"})

    assert response.status_code == 200
    assert response.json() == {
        "results": [
            {"label": "Springfield, IL", "lat": 39.79923, "lon": -89.64404,
             "detail": "Sangamon, Illinois"},
            {"label": "Springfield, MO", "lat": 37.20898, "lon": -93.29225,
             "detail": "Greene, Missouri"},
        ]
    }  # fmt: skip


@responses.activate
def test_no_results_is_404(client: Client) -> None:
    responses.get(TOMTOM, json={"results": []})

    response = client.get(URL, {"q": "Denvr, CA"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "LOCATION_NOT_FOUND"


@pytest.mark.parametrize("q", ["", "a", " a ", "x" * 121])
def test_query_length_is_validated(client: Client, q: str) -> None:
    response = client.get(URL, {"q": q})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"
    assert "q" in response.json()["error"]["details"]


def test_missing_query(client: Client) -> None:
    assert client.get(URL).status_code == 400


@responses.activate
def test_provider_failure_is_mapped(client: Client) -> None:
    responses.get(TOMTOM, status=503)

    response = client.get(URL, {"q": "Chicago"})

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ROUTING_UNAVAILABLE"


@override_settings(TOMTOM_API_KEY="")
def test_missing_key_is_503(client: Client) -> None:
    response = client.get(URL, {"q": "Chicago"})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ROUTING_NOT_CONFIGURED"


@responses.activate
def test_response_never_contains_the_key(client: Client) -> None:
    responses.get(TOMTOM, status=403, body="<error/>")

    response = client.get(URL, {"q": "Chicago"})

    assert response.status_code == 502
    assert b"SECRET123" not in response.content


@responses.activate
def test_throttled(client: Client, monkeypatch) -> None:
    responses.get(TOMTOM, json=GEOCODE_SPRINGFIELD)
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"geocode": "1/min"})

    assert client.get(URL, {"q": "Springfield"}).status_code == 200
    response = client.get(URL, {"q": "Springfield"})

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "TOO_MANY_REQUESTS"
