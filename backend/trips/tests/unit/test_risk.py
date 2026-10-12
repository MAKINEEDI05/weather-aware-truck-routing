"""Boundary tests for the assessment risk rules (docs/TEST_PLAN.md §2.1)."""

import math

import pytest

from trips.domain.risk import assess, classify_rain, classify_snow, classify_wind, clean_value
from trips.domain.types import RiskLevel

L, M, H, S, NT, U = (
    RiskLevel.LOW,
    RiskLevel.MODERATE,
    RiskLevel.HIGH,
    RiskLevel.SEVERE,
    RiskLevel.NO_TRAVEL,
    RiskLevel.UNKNOWN,
)


@pytest.mark.parametrize(
    ("wind", "expected"),
    [
        (0, L),
        (24.99, L),
        (25, M),
        (34, M),
        (34.99, M),
        (35, H),
        (44.99, H),
        (45, S),
        (54.99, S),
        (55, NT),
        (80, NT),
    ],
)
def test_wind_thresholds_at_light_load(wind: float, expected: RiskLevel) -> None:
    level, adjusted = classify_wind(wind, load_lb=20_000)
    assert level is expected
    assert adjusted is False
    assert assess(wind, 0, 0, 20_000).overall is expected


@pytest.mark.parametrize(
    ("wind", "load", "expected", "adjusted"),
    [
        (35, 40_000, H, False),  # not > 40,000
        (35, 40_000.01, S, True),  # 35–44 mph + > 40,000 lb
        (44.99, 40_001, S, True),
        (34.99, 50_000, M, False),  # below 35 mph: load irrelevant
        (40, 35_000, H, False),  # no rule for 30,001–40,000 lb at 35–44 mph
        (45, 30_000, S, False),  # not > 30,000
        (45, 30_001, NT, True),  # 45–54 mph + > 30,000 lb
        (54.99, 30_001, NT, True),
        (45, 45_000, NT, True),
        (55, 0, NT, False),  # ≥ 55 mph: No Travel for any load
        (24.99, 100_000, L, False),
    ],
)
def test_load_rules(wind: float, load: float, expected: RiskLevel, adjusted: bool) -> None:
    level, load_adjusted = classify_wind(wind, load)
    assert level is expected
    assert load_adjusted is adjusted
    result = assess(wind, 0, 0, load)
    assert result.overall is expected
    assert result.wind is expected
    assert result.load_adjusted is adjusted


@pytest.mark.parametrize(
    ("rain", "expected"),
    [
        (0, L),
        (0.0999, L),
        (0.10, M),
        (0.2499, M),
        (0.25, H),
        (0.4999, H),
        (0.50, S),
        (1.00, S),
        (1.0001, NT),
    ],
)
def test_rain_thresholds(rain: float, expected: RiskLevel) -> None:
    assert classify_rain(rain) is expected
    assert assess(0, rain, 0, 0).overall is expected


@pytest.mark.parametrize(
    ("snow", "expected"),
    [
        (0.49, L),
        (0.5, M),
        (0.99, M),
        (1.0, H),
        (1.99, H),
        (2.0, S),
        (3.0, S),
        (3.01, NT),
    ],
)
def test_snow_thresholds(snow: float, expected: RiskLevel) -> None:
    assert classify_snow(snow) is expected
    assert assess(0, 0, snow, 0).overall is expected


def test_overall_is_the_worst_component() -> None:
    result = assess(40, 0.6, 0.0, 20_000)  # wind HIGH, rain SEVERE, snow LOW

    assert (result.wind, result.rain, result.snow) == (H, S, L)
    assert result.overall is S


def test_snow_no_travel_dominates() -> None:
    assert assess(0, 0, 3.5, 0).overall is NT


def test_missing_wind_makes_overall_unknown_never_low() -> None:
    result = assess(None, 0.0, 0.0, 20_000)

    assert result.wind is U
    assert result.overall is U
    assert "Wind: no forecast → Unknown" in result.reasons


def test_missing_component_with_known_no_travel_is_no_travel() -> None:
    assert assess(None, 1.5, None, 0).overall is NT


def test_all_missing_is_unknown() -> None:
    result = assess(None, None, None, 0)

    assert (result.overall, result.wind, result.rain, result.snow) == (U, U, U, U)


@pytest.mark.parametrize(
    "bad", [-0.1, math.nan, math.inf, -math.inf, "0.3", True, False, object(), [1]]
)
def test_invalid_values_are_treated_as_missing(bad: object) -> None:
    assert clean_value(bad) is None
    assert assess(0, bad, 0, 0).rain is U
    assert assess(0, bad, 0, 0).overall is U


def test_valid_integers_are_accepted() -> None:
    assert clean_value(0) == 0.0
    assert clean_value(12) == 12.0


def test_reasons_describe_each_component_and_load_rule() -> None:
    result = assess(40.0, 0.02, 0.0, 42_000)

    assert result.reasons == (
        "Wind 40.0 mph → High; load 42,000 lb is above 40,000 lb → Severe",
        "Rain 0.02 in/hr → Low",
        "Snow 0.00 in/hr → Low",
    )


def test_reasons_do_not_hide_values_near_thresholds() -> None:
    result = assess(0, 0.0999, 0, 0)

    assert "Rain 0.0999 in/hr → Low" in result.reasons


def test_reasons_show_fractional_loads_exactly() -> None:
    result = assess(35, 0, 0, 40_000.01)

    assert result.reasons[0] == (
        "Wind 35.0 mph → High; load 40,000.01 lb is above 40,000 lb → Severe"
    )
