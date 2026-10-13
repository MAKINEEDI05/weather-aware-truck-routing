import logging

import pytest
import requests
import responses

from trips.services.errors import (
    ProviderAuthError,
    ProviderBadRequest,
    ProviderBadResponse,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)
from trips.services.http import RedactSecretsFilter, get_json, redact

URL = "https://provider.example/api"
SECRET = "SECRET123"


def call(**overrides):
    kwargs = {
        "provider": "Example",
        "operation": "op",
        "url": URL,
        "params": {"key": SECRET, "q": "x"},
        "timeout": (1.0, 1.0),
    }
    kwargs.update(overrides)
    return get_json(**kwargs)


@responses.activate
def test_success_returns_json() -> None:
    responses.get(URL, json={"ok": True})

    assert call() == {"ok": True}
    assert len(responses.calls) == 1


@responses.activate
def test_timeout_is_retried_once_then_succeeds() -> None:
    responses.get(URL, body=requests.exceptions.ReadTimeout())
    responses.get(URL, json={"ok": True})

    assert call() == {"ok": True}
    assert len(responses.calls) == 2


@responses.activate
def test_timeout_twice_raises_provider_timeout() -> None:
    responses.get(URL, body=requests.exceptions.ConnectTimeout())

    with pytest.raises(ProviderTimeout):
        call()
    assert len(responses.calls) == 2


@responses.activate
def test_server_error_twice_raises_unavailable() -> None:
    responses.get(URL, status=503)

    with pytest.raises(ProviderUnavailable) as caught:
        call()
    assert caught.value.status == 503
    assert len(responses.calls) == 2


@responses.activate
def test_connection_error_message_never_contains_url_or_key() -> None:
    responses.get(URL, body=requests.exceptions.ConnectionError(f"failed {URL}?key={SECRET}"))

    with pytest.raises(ProviderUnavailable) as caught:
        call()
    assert SECRET not in str(caught.value)
    assert caught.value.__cause__ is None
    assert caught.value.__context__ is None


@responses.activate
def test_rate_limit_carries_retry_after_and_is_not_retried_by_default() -> None:
    responses.get(URL, status=429, headers={"Retry-After": "30"})

    with pytest.raises(ProviderRateLimited) as caught:
        call()
    assert caught.value.retry_after_s == 30
    assert len(responses.calls) == 1


@responses.activate
def test_rate_limit_keeps_the_provider_reason() -> None:
    # Regression (VF-17): Open-Meteo explains which limit was hit in a JSON "reason".
    reason = "Daily API request limit exceeded. Please try again tomorrow."
    responses.get(URL, status=429, json={"error": True, "reason": reason})

    with pytest.raises(ProviderRateLimited) as caught:
        call()
    assert caught.value.detail == reason
    assert reason in caught.value.message


@responses.activate
def test_rate_limit_is_retried_when_caller_allows() -> None:
    responses.get(URL, status=429)
    responses.get(URL, json=[1])

    assert call(retry_statuses=(429,)) == [1]


@responses.activate
def test_forbidden_with_xml_body_is_auth_error_without_key() -> None:
    responses.get(URL, status=403, body="<errorResponse>Developer Inactive</errorResponse>")

    with pytest.raises(ProviderAuthError) as caught:
        call()
    assert SECRET not in caught.value.message
    assert len(responses.calls) == 1


@responses.activate
def test_bad_request_includes_provider_detail_redacted() -> None:
    responses.get(URL, status=400, json={"detailedError": {"message": f"bad input key={SECRET}"}})

    with pytest.raises(ProviderBadRequest) as caught:
        call()
    assert "bad input" in caught.value.message
    assert SECRET not in caught.value.message


@responses.activate
def test_invalid_json_is_bad_response() -> None:
    responses.get(URL, body="<html>oops</html>", status=200)

    with pytest.raises(ProviderBadResponse):
        call()


@responses.activate
def test_logs_never_contain_the_key(caplog: pytest.LogCaptureFixture) -> None:
    responses.get(URL, status=500)
    caplog.set_level(logging.DEBUG)

    with pytest.raises(ProviderUnavailable):
        call()

    assert caplog.records, "expected provider log lines"
    assert all(SECRET not in record.getMessage() for record in caplog.records)
    assert "provider=Example op=op status=500" in caplog.text


def test_redact_masks_key_values() -> None:
    text = f'GET /routing/1/calculateRoute/1,2:3,4/json?key={SECRET}&travelMode=truck "200"'

    assert redact(text) == (
        'GET /routing/1/calculateRoute/1,2:3,4/json?key=[REDACTED]&travelMode=truck "200"'
    )
    assert redact(f"api_key={SECRET}") == "api_key=[REDACTED]"


def test_redact_filter_rewrites_urllib3_style_records() -> None:
    record = logging.LogRecord(
        "urllib3.connectionpool",
        logging.DEBUG,
        __file__,
        1,
        '%s://%s:%s "%s %s %s" %s %s',
        ("https", "api.tomtom.com", 443, "GET", f"/search?key={SECRET}", "HTTP/1.1", 200, 10),
        None,
    )

    assert RedactSecretsFilter().filter(record) is True
    assert SECRET not in record.getMessage()
    assert "key=[REDACTED]" in record.getMessage()
