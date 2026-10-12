"""TomTom client tests against SYNTHETIC responses (see tests/synthetic_tomtom.py)."""

import re
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest
import requests
import responses
from django.test import override_settings

from trips.domain.checkpoints import place_checkpoints
from trips.domain.profile import build_profile
from trips.domain.types import LatLon
from trips.services import tomtom
from trips.services.errors import (
    NoRouteFound,
    ProviderAuthError,
    ProviderBadResponse,
    ProviderNotConfigured,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)
from trips.tests.synthetic_tomtom import (
    AUTH_403_XML,
    CHICAGO,
    CORRIDORS,
    DENVER,
    GEOCODE_SPRINGFIELD,
    NO_ROUTE_400,
    densify,
    route_json,
    routes_response,
    three_routes_response,
)

ROUTE_URL = re.compile(r"https://api\.tomtom\.com/routing/1/calculateRoute/.*")
GEOCODE_URL = re.compile(r"https://api\.tomtom\.com/search/2/geocode/.*")
NOW = datetime(2026, 10, 12, 10, 0, tzinfo=UTC)
DEPARTURE = datetime(2026, 10, 14, 13, 0, tzinfo=UTC)
KEY = "test-tomtom-key-SECRET123"


def _routes():
    return tomtom.calculate_routes(CHICAGO, DENVER, DEPARTURE, now=NOW)


@responses.activate
def test_parses_three_routes_in_provider_order() -> None:
    body = three_routes_response()
    responses.get(ROUTE_URL, json=body)

    routes = _routes()

    assert [r.provider_index for r in routes] == [0, 1, 2]
    for route, raw in zip(routes, body["routes"], strict=True):
        assert len(route.points) == len(raw["legs"][0]["points"])
        assert route.points[0] == CHICAGO
        assert route.length_m == raw["summary"]["lengthInMeters"]
        assert route.travel_time_s == raw["summary"]["travelTimeInSeconds"]
        assert route.progress[-1].point_index == len(route.points) - 1


@responses.activate
def test_request_parameters() -> None:
    responses.get(ROUTE_URL, json=three_routes_response())

    _routes()

    url = urlparse(responses.calls[0].request.url)
    assert url.path == ("/routing/1/calculateRoute/41.884200,-87.632400:39.739200,-104.990300/json")
    query = parse_qs(url.query)
    assert query["travelMode"] == ["truck"]
    assert query["routeType"] == ["fastest"]
    assert query["maxAlternatives"] == ["2"]
    assert query["routeRepresentation"] == ["polyline"]
    assert query["extendedRouteRepresentation"] == ["distance", "travelTime"]
    assert query["departAt"] == ["2026-10-14T13:00:00Z"]
    assert query["key"] == [KEY]
    assert "vehicleWeight" not in query  # DEC-11


@responses.activate
def test_fewer_routes_are_returned_as_is() -> None:
    responses.get(ROUTE_URL, json=routes_response("middle", "south"))

    assert len(_routes()) == 2


@responses.activate
def test_empty_route_list_is_no_route() -> None:
    responses.get(ROUTE_URL, json={"formatVersion": "0.0.12", "routes": []})

    with pytest.raises(NoRouteFound):
        _routes()


@responses.activate
def test_400_is_no_route_found() -> None:
    responses.get(ROUTE_URL, status=400, json=NO_ROUTE_400)

    with pytest.raises(NoRouteFound) as caught:
        _routes()
    assert "MAP_MATCHING_FAILURE" in caught.value.message
    assert len(responses.calls) == 1


@responses.activate
def test_403_xml_is_auth_error() -> None:
    responses.get(ROUTE_URL, status=403, body=AUTH_403_XML, content_type="text/xml")

    with pytest.raises(ProviderAuthError) as caught:
        _routes()
    assert KEY not in caught.value.message


@responses.activate
def test_429_is_rate_limited() -> None:
    responses.get(ROUTE_URL, status=429, headers={"Retry-After": "12"})

    with pytest.raises(ProviderRateLimited) as caught:
        _routes()
    assert caught.value.retry_after_s == 12


@responses.activate
def test_timeouts_after_one_retry() -> None:
    responses.get(ROUTE_URL, body=requests.exceptions.ReadTimeout())

    with pytest.raises(ProviderTimeout):
        _routes()
    assert len(responses.calls) == 2


@responses.activate
def test_server_error_is_retried_then_unavailable() -> None:
    responses.get(ROUTE_URL, status=500)

    with pytest.raises(ProviderUnavailable):
        _routes()
    assert len(responses.calls) == 2


@override_settings(TOMTOM_API_KEY="")
@responses.activate
def test_missing_key_makes_no_request() -> None:
    with pytest.raises(ProviderNotConfigured):
        _routes()
    with pytest.raises(ProviderNotConfigured):
        tomtom.geocode("Chicago")
    assert len(responses.calls) == 0


@pytest.mark.parametrize(
    "mutate",
    [
        lambda r: r.pop("progress"),
        lambda r: r.update(progress=[]),
        lambda r: r["legs"][0].update(points=[{"latitude": 1, "longitude": 2}]),
        lambda r: r["summary"].pop("lengthInMeters"),
        lambda r: r["legs"][0]["points"][3].update(latitude=123),
        lambda r: r["progress"].append(
            {"pointIndex": 99_999, "distanceInMeters": 1, "travelTimeInSeconds": 1}
        ),
    ],
)
@responses.activate
def test_malformed_routes_are_bad_responses(mutate) -> None:
    body = three_routes_response()
    mutate(body["routes"][1])
    responses.get(ROUTE_URL, json=body)

    with pytest.raises(ProviderBadResponse):
        _routes()


def test_depart_at_is_sent_only_when_in_the_future() -> None:
    assert tomtom.depart_at_param(NOW + timedelta(minutes=2), NOW) == "2026-10-12T10:02:00Z"
    assert tomtom.depart_at_param(NOW + timedelta(seconds=119), NOW) == "now"
    assert tomtom.depart_at_param(NOW - timedelta(minutes=5), NOW) == "now"


@responses.activate
def test_geocode_parses_and_deduplicates() -> None:
    responses.get(GEOCODE_URL, json=GEOCODE_SPRINGFIELD)

    places = tomtom.geocode("Springfield")

    assert [(p.label, p.detail) for p in places] == [
        ("Springfield, IL", "Sangamon, Illinois"),
        ("Springfield, MO", "Greene, Missouri"),
    ]
    assert places[0].point == LatLon(39.79923, -89.64404)
    query = parse_qs(urlparse(responses.calls[0].request.url).query)
    assert query["countrySet"] == ["US"]
    assert query["limit"] == ["5"]


@responses.activate
def test_geocode_query_is_url_encoded_in_path() -> None:
    responses.get(GEOCODE_URL, json={"results": []})

    assert tomtom.geocode("St. Louis, MO/../x") == []
    assert urlparse(responses.calls[0].request.url).path == (
        "/search/2/geocode/St.%20Louis%2C%20MO%2F..%2Fx.json"
    )


@responses.activate
def test_geocode_unexpected_body_is_bad_response() -> None:
    responses.get(GEOCODE_URL, json={"unexpected": True})

    with pytest.raises(ProviderBadResponse):
        tomtom.geocode("Chicago")


@responses.activate
def test_geocode_drops_state_and_country_results() -> None:
    # Regression: shape recorded live 2026-10-12 for "Denvr, CA" (values trimmed).
    responses.get(
        GEOCODE_URL,
        json={
            "results": [
                {
                    "type": "Geography",
                    "entityType": "CountrySubdivision",
                    "address": {"countryCode": "US", "freeformAddress": "California"},
                    "position": {"lat": 37.253603, "lon": -119.609046},
                },
                {
                    "type": "Geography",
                    "entityType": "Municipality",
                    "address": {
                        "countryCode": "US",
                        "freeformAddress": "Denver, CO",
                        "countrySubdivisionName": "Colorado",
                    },
                    "position": {"lat": 39.738453, "lon": -104.984853},
                },
                {
                    "type": "Geography",
                    "entityType": "Country",
                    "address": {"countryCode": "US", "freeformAddress": "United States"},
                    "position": {"lat": 39.8, "lon": -98.5},
                },
            ]
        },
    )

    assert [p.label for p in tomtom.geocode("Denvr, CA")] == ["Denver, CO"]


@responses.activate
def test_sparse_progress_like_the_live_api() -> None:
    # Regression (VF-12): live TomTom sends ~1 progress element per ~100 points (86 for 10,649).
    body = {"routes": [route_json(densify(CORRIDORS["middle"], step_mi=0.5), progress_every=97)]}
    responses.get(ROUTE_URL, json=body)

    (route,) = _routes()
    profile = build_profile(route.points, route.progress)
    placements = place_checkpoints(profile, 25, DEPARTURE)

    assert len(route.progress) < len(route.points) / 50
    assert profile.length_m == route.length_m
    assert profile.total_time_s == route.travel_time_s
    assert abs((placements[-1].eta_utc - DEPARTURE).total_seconds() - route.travel_time_s) <= 60
    etas = [p.eta_utc for p in placements]
    assert etas == sorted(etas)
