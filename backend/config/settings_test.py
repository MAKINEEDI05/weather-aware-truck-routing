"""Settings for the test suite.

Tests must pass on a clean clone without a `.env` file, so the values the tests
depend on are fixed here instead of being read from the environment.
"""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-insecure-key")

from .settings import *  # noqa: E402, F403

DEBUG = False
ALLOWED_HOSTS = ["testserver"]
CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
