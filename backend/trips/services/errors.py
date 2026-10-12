"""Typed provider errors. Messages never contain URLs or API keys."""

from __future__ import annotations


class ProviderError(Exception):
    def __init__(
        self,
        provider: str,
        message: str,
        *,
        status: int | None = None,
        retry_after_s: int | None = None,
    ) -> None:
        super().__init__(message)
        self.provider = provider
        self.message = message
        self.status = status
        self.retry_after_s = retry_after_s


class ProviderNotConfigured(ProviderError):
    """A required API key is not set on the server."""


class ProviderAuthError(ProviderError):
    """401/403: key invalid, missing permission or quota exhausted."""


class ProviderRateLimited(ProviderError):
    """429 from the provider."""


class ProviderTimeout(ProviderError):
    """Connect or read timeout."""


class ProviderUnavailable(ProviderError):
    """5xx, connection failure or other unexpected status."""


class ProviderBadRequest(ProviderError):
    """4xx other than auth/rate limit: the provider rejected the request."""


class ProviderBadResponse(ProviderError):
    """2xx with a body that cannot be parsed or fails validation."""


class NoRouteFound(ProviderBadRequest):
    """The routing provider could not connect the locations by road."""
