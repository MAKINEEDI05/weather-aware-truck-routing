from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from django.core.cache import cache

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _isolated_cache() -> Iterator[None]:
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _no_retry_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("trips.services.http.BACKOFF_S", 0)


@pytest.fixture
def open_meteo_recorded() -> list[dict[str, Any]]:
    return json.loads((FIXTURES / "open_meteo_3_locations.json").read_text())
