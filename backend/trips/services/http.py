"""Shared JSON-over-HTTP helper for provider clients.

- Connect and read timeouts on every call.
- At most one retry, with a short backoff, for statuses the caller marks as retryable and for
  timeouts and connection errors.
- Logs provider, operation, status, attempt and duration only. Request URLs carry API keys
  (TomTom takes the key as a query parameter), so URLs and `requests` exception messages are never
  logged or put into errors. `RedactSecretsFilter` masks `key=` values in any log record as a
  second line of defence (for example urllib3 debug output).
"""

from __future__ import annotations

import logging
import re
import threading
import time
from collections.abc import Collection, Mapping, Sequence
from typing import Any

import requests

from .errors import (
    ProviderAuthError,
    ProviderBadRequest,
    ProviderBadResponse,
    ProviderError,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)

logger = logging.getLogger("trips.providers")

USER_AGENT = "weather-aware-truck-routing/1.0"
MAX_ATTEMPTS = 2
BACKOFF_S = 0.5

_SECRET_PATTERN = re.compile(r"(?i)\b((?:api_?)?key=)[^&\s'\"<>]+")
_local = threading.local()

Params = Mapping[str, Any] | Sequence[tuple[str, Any]]


def redact(text: str) -> str:
    return _SECRET_PATTERN.sub(r"\1[REDACTED]", text)


class RedactSecretsFilter(logging.Filter):
    """Masks `key=…` query values in log messages and their arguments."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # noqa: BLE001 — never let logging break a request
            return True
        redacted = redact(message)
        if redacted != message:
            record.msg = redacted
            record.args = None
        return True


def _session() -> requests.Session:
    session = getattr(_local, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update({"Accept": "application/json", "User-Agent": USER_AGENT})
        _local.session = session
    return session


def _retry_after(response: requests.Response) -> int | None:
    value = response.headers.get("Retry-After", "").strip()
    return int(value) if value.isdigit() else None


def _provider_detail(response: requests.Response) -> str:
    """A short, key-free detail message from a provider error body, if it has one."""
    try:
        body = response.json()
    except ValueError:
        return ""
    if not isinstance(body, dict):
        return ""
    detailed = body.get("detailedError")
    if isinstance(detailed, dict) and isinstance(detailed.get("message"), str):
        return redact(detailed["message"])[:300]
    for field in ("reason", "errorText", "message"):
        if isinstance(body.get(field), str):
            return redact(body[field])[:300]
    return ""


def _error_for_status(provider: str, response: requests.Response) -> ProviderError:
    status = response.status_code
    if status in (401, 403):
        return ProviderAuthError(provider, f"{provider} rejected the API key.", status=status)
    if status == 429:
        # Keep the provider's reason: it says which limit was hit (e.g. Open-Meteo's
        # "Daily API request limit exceeded. Please try again tomorrow.").
        detail = _provider_detail(response)
        return ProviderRateLimited(
            provider,
            f"{provider} rate limit reached" + (f": {detail}" if detail else "."),
            status=status,
            retry_after_s=_retry_after(response),
            detail=detail,
        )
    if 400 <= status < 500:
        detail = _provider_detail(response)
        message = f"{provider} rejected the request" + (f": {detail}" if detail else ".")
        return ProviderBadRequest(provider, message, status=status)
    return ProviderUnavailable(provider, f"{provider} returned HTTP {status}.", status=status)


def get_json(
    *,
    provider: str,
    operation: str,
    url: str,
    params: Params,
    timeout: tuple[float, float],
    retry_statuses: Collection[int] = (500, 502, 503, 504),
) -> Any:
    last_error: ProviderError | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        started = time.monotonic()
        retryable = False
        try:
            response = _session().get(url, params=params, timeout=timeout)
        except requests.Timeout:
            last_error = ProviderTimeout(provider, f"{provider} did not respond in time.")
            retryable = True
            status_text = "timeout"
        except requests.RequestException as exc:
            last_error = ProviderUnavailable(provider, f"{provider} could not be reached.")
            retryable = True
            status_text = type(exc).__name__
        else:
            status_text = str(response.status_code)
            if 200 <= response.status_code < 300:
                _log(provider, operation, status_text, attempt, started)
                try:
                    return response.json()
                except ValueError as exc:
                    raise ProviderBadResponse(
                        provider, f"{provider} returned a response that is not JSON."
                    ) from exc
            last_error = _error_for_status(provider, response)
            retryable = response.status_code in retry_statuses
        _log(provider, operation, status_text, attempt, started)
        if not retryable or attempt == MAX_ATTEMPTS:
            break
        time.sleep(BACKOFF_S * attempt)
    assert last_error is not None
    raise last_error


def _log(provider: str, operation: str, status: str, attempt: int, started: float) -> None:
    logger.info(
        "provider=%s op=%s status=%s attempt=%d ms=%d",
        provider,
        operation,
        status,
        attempt,
        round((time.monotonic() - started) * 1000),
    )
