"""One error format for every endpoint (docs/API_CONTRACT.md §5)."""

from __future__ import annotations

import logging
import math
from typing import Any

from django.http import HttpRequest, JsonResponse
from rest_framework import exceptions, status
from rest_framework.response import Response

from trips.services.errors import (
    NoRouteFound,
    ProviderAuthError,
    ProviderError,
    ProviderNotConfigured,
    ProviderRateLimited,
    ProviderTimeout,
)

logger = logging.getLogger("trips.api")


class LocationNotFound(exceptions.APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "No US location matches this search."
    default_code = "LOCATION_NOT_FOUND"


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def _plain(detail: Any) -> Any:
    if isinstance(detail, dict):
        return {key: _plain(value) for key, value in detail.items()}
    if isinstance(detail, list):
        return [_plain(item) for item in detail]
    return str(detail)


def _codes(codes: Any) -> set[str]:
    if isinstance(codes, dict):
        return set().union(*(_codes(v) for v in codes.values())) if codes else set()
    if isinstance(codes, list):
        return set().union(*(_codes(v) for v in codes)) if codes else set()
    return {str(codes)}


def _validation_response(exc: exceptions.ValidationError) -> Response:
    codes = _codes(exc.get_codes())
    details = _plain(exc.detail)
    if not isinstance(details, dict):
        details = {"non_field_errors": details}
    if codes == {"departure_out_of_range"}:
        code, message = (
            "DEPARTURE_OUT_OF_RANGE",
            "The departure time is outside the allowed window.",
        )
    elif codes == {"same_location"}:
        code, message = "SAME_LOCATION", "Origin and destination must be at least 1 mile apart."
    else:
        code, message = "INVALID_INPUT", "Some fields are invalid."
    return Response(error_body(code, message, details), status=status.HTTP_400_BAD_REQUEST)


def _provider_response(exc: ProviderError) -> Response:
    headers: dict[str, str] = {}
    details: dict[str, Any] = {}
    if isinstance(exc, NoRouteFound):
        http, code = 422, "NO_ROUTE_FOUND"
        message = "No truck route was found between these locations."
    elif isinstance(exc, ProviderNotConfigured):
        http, code = 503, "ROUTING_NOT_CONFIGURED"
        message = "Routing is not configured on the server (the TomTom API key is missing)."
    elif isinstance(exc, ProviderAuthError):
        http, code = 502, "ROUTING_CONFIGURATION_ERROR"
        message = "The routing provider rejected the server's credentials."
    elif isinstance(exc, ProviderRateLimited):
        http, code = 503, "RATE_LIMITED"
        message = "The routing service is busy. Try again shortly."
        if exc.retry_after_s is not None:
            headers["Retry-After"] = str(exc.retry_after_s)
            details["retry_after_s"] = exc.retry_after_s
    elif isinstance(exc, ProviderTimeout):
        http, code = 504, "UPSTREAM_TIMEOUT"
        message = "The routing service did not respond in time."
    else:
        http, code = 502, "ROUTING_UNAVAILABLE"
        message = "The routing service is unavailable right now."
    logger.warning("provider_error provider=%s code=%s detail=%s", exc.provider, code, exc.message)
    return Response(error_body(code, message, details), status=http, headers=headers)


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    if isinstance(exc, exceptions.ValidationError):
        return _validation_response(exc)
    if isinstance(exc, LocationNotFound):
        return Response(error_body("LOCATION_NOT_FOUND", str(exc.detail)), status=404)
    if isinstance(exc, ProviderError):
        return _provider_response(exc)
    if isinstance(exc, exceptions.Throttled):
        wait = math.ceil(exc.wait) if exc.wait is not None else None
        details = {"retry_after_s": wait} if wait is not None else {}
        headers = {"Retry-After": str(wait)} if wait is not None else {}
        return Response(
            error_body("TOO_MANY_REQUESTS", "Too many requests. Try again shortly.", details),
            status=429,
            headers=headers,
        )
    if isinstance(exc, exceptions.MethodNotAllowed):
        return Response(error_body("METHOD_NOT_ALLOWED", "Method not allowed."), status=405)
    if isinstance(exc, exceptions.NotFound):
        return Response(error_body("NOT_FOUND", "Not found."), status=404)
    if isinstance(exc, exceptions.ParseError):
        return Response(error_body("INVALID_INPUT", "The request body is not valid JSON."), 400)
    if isinstance(exc, exceptions.UnsupportedMediaType):
        return Response(error_body("INVALID_INPUT", "Send the request body as JSON."), 415)
    if isinstance(exc, exceptions.APIException):
        return Response(error_body("INVALID_INPUT", str(exc.detail)), status=exc.status_code)

    logger.exception("Unhandled error in %s", type(context.get("view")).__name__)
    return Response(error_body("INTERNAL_ERROR", "Something went wrong on the server."), 500)


def json_404(request: HttpRequest, exception: Exception) -> JsonResponse:
    return JsonResponse(error_body("NOT_FOUND", "Not found."), status=404)


def json_500(request: HttpRequest) -> JsonResponse:
    return JsonResponse(
        error_body("INTERNAL_ERROR", "Something went wrong on the server."), status=500
    )
