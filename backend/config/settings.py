"""Django settings for the Weather-Aware Truck Routing API.

All environment-specific values come from environment variables (blueprint §15.5).
A local `backend/.env` file is loaded if present; it never overrides variables
that are already set in the process environment.
"""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env", override=False)


def env_str(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in env_str(name, default).split(",") if item.strip()]


def env_int(name: str, default: int, minimum: int = 0) -> int:
    value = env_str(name)
    if not value:
        return default
    try:
        number = int(value)
    except ValueError as exc:
        raise ImproperlyConfigured(f"{name} must be an integer.") from exc
    if number < minimum:
        raise ImproperlyConfigured(f"{name} must be at least {minimum}.")
    return number


APP_VERSION = "1.0.0"

DEBUG = env_bool("DJANGO_DEBUG", default=False)

SECRET_KEY = env_str("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY is not set. Set it, or set DJANGO_DEBUG=true for local development."
        )
    SECRET_KEY = "django-insecure-local-development-only"

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")

# Stateless JSON API (DEC-2): no admin, auth, sessions or models.
INSTALLED_APPS = [
    "corsheaders",
    "rest_framework",
    "trips",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.gzip.GZipMiddleware",  # DEC-36: no secrets or cookies in responses
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Nothing persists between requests (DEC-45), so no database is configured.
DATABASES: dict[str, dict[str, str]] = {}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = True

# CORS: exact origin allowlist.
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)

# Production hardening behind a TLS-terminating proxy (host dashboard sets these).
if env_bool("DJANGO_BEHIND_TLS_PROXY"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT")
SECURE_HSTS_SECONDS = env_int("DJANGO_SECURE_HSTS_SECONDS", 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

SILENCED_SYSTEM_CHECKS = [
    # No cookies, sessions or authentication exist, so CSRF protection has nothing to protect.
    "security.W003",
    # HSTS preload is an irreversible opt-in for the domain owner, not an app default.
    "security.W021",
]

# Providers. The TomTom key stays on the server and is never logged or returned.
TOMTOM_API_KEY = env_str("TOMTOM_API_KEY")
WEATHER_BATCH_SIZE = env_int("WEATHER_BATCH_SIZE", 100, minimum=1)
WEATHER_CACHE_TTL_S = env_int("WEATHER_CACHE_TTL_S", 1800)
MAX_DEPARTURE_DAYS_AHEAD = env_int("MAX_DEPARTURE_DAYS_AHEAD", 7, minimum=1)

# One process with threads (DEC-26), so an in-memory cache is shared by all requests.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "weather-aware-truck-routing",
        "OPTIONS": {"MAX_ENTRIES": 20_000},
    }
}

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "trips.api.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_RATES": {"plan": "10/min", "geocode": "30/min"},  # DEC-27
    "NUM_PROXIES": env_int("DRF_NUM_PROXIES", 0) if env_str("DRF_NUM_PROXIES") else None,
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "redact_secrets": {"()": "trips.services.http.RedactSecretsFilter"},
    },
    "formatters": {
        "plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "plain",
            "filters": ["redact_secrets"],
        },
    },
    "root": {"handlers": ["console"], "level": env_str("LOG_LEVEL", "INFO").upper()},
}
