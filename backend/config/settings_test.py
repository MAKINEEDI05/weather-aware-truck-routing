"""Settings for the test suite.

Tests must pass on a clean clone without a `.env` file, so the values the tests depend on are
fixed here instead of being read from the environment.
"""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-insecure-key")

from .settings import *  # noqa: E402, F403
from .settings import REST_FRAMEWORK  # noqa: E402

DEBUG = False
ALLOWED_HOSTS = ["testserver"]
CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
TOMTOM_API_KEY = "test-tomtom-key-SECRET123"
WEATHER_BATCH_SIZE = 100
WEATHER_CACHE_TTL_S = 1800
MAX_DEPARTURE_DAYS_AHEAD = 7
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {"plan": "1000/min", "geocode": "1000/min"},
}
