"""Weather risk classification — the assessment's rules, implemented exactly.

Assessment PDF, "Risk Rules" (quoted):

    Condition | Low         | Moderate  | High      | Severe    | No Travel
    Wind      | <25 mph     | 25–34     | 35–44     | 45–54     | ≥55 mph
    Rain      | <0.10 in/hr | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | >1.00
    Snow      | <0.5 in/hr  | 0.5–1.0   | 1.0–2.0   | 2.0–3.0   | >3.0

    Load rules:
    • ≥55 mph → No Travel for any load
    • 45–54 mph + >30,000 lb → No Travel
    • 35–44 mph + >40,000 lb → Severe

Interpretations (docs/DECISIONS.md):
- DEC-7  wind uses half-open intervals [25, 35), [35, 45), [45, 55) — no gaps for decimals.
- DEC-8  a rain/snow endpoint shared by two columns belongs to the higher level.
- A-3    top of Severe is inclusive: rain 1.00 and snow 3.0 are Severe; No Travel is strictly above.
- A-4    load thresholds are strict: exactly 30,000 / 40,000 lb does not trigger a rule.
- DEC-17 overall = max of components; any missing component → UNKNOWN unless a known component
         is already NO_TRAVEL. Missing data is never treated as Low.
"""

from __future__ import annotations

import math
from numbers import Real

from .types import KNOWN_LEVELS, RiskAssessment, RiskLevel

# Wind (mph): lower bounds, inclusive.
WIND_MODERATE_MPH = 25.0
WIND_HIGH_MPH = 35.0
WIND_SEVERE_MPH = 45.0
WIND_NO_TRAVEL_MPH = 55.0

# Rain (in/hr): lower bounds inclusive; No Travel strictly above the Severe maximum.
RAIN_MODERATE_IN_HR = 0.10
RAIN_HIGH_IN_HR = 0.25
RAIN_SEVERE_IN_HR = 0.50
RAIN_SEVERE_MAX_IN_HR = 1.00

# Snow (in/hr): same pattern as rain.
SNOW_MODERATE_IN_HR = 0.5
SNOW_HIGH_IN_HR = 1.0
SNOW_SEVERE_IN_HR = 2.0
SNOW_SEVERE_MAX_IN_HR = 3.0

# Load rules (lb): strictly greater than.
LOAD_NO_TRAVEL_ABOVE_LB = 30_000.0  # applies to 45–54 mph
LOAD_SEVERE_ABOVE_LB = 40_000.0  # applies to 35–44 mph

_SEVERITY_INDEX = {level: index for index, level in enumerate(KNOWN_LEVELS)}


def clean_value(value: object) -> float | None:
    """A usable non-negative finite number, or None (treated as missing)."""
    if value is None or isinstance(value, bool) or not isinstance(value, Real):
        return None
    number = float(value)
    if not math.isfinite(number) or number < 0:
        return None
    return number


def wind_base_level(wind_mph: float) -> RiskLevel:
    if wind_mph >= WIND_NO_TRAVEL_MPH:
        return RiskLevel.NO_TRAVEL
    if wind_mph >= WIND_SEVERE_MPH:
        return RiskLevel.SEVERE
    if wind_mph >= WIND_HIGH_MPH:
        return RiskLevel.HIGH
    if wind_mph >= WIND_MODERATE_MPH:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_wind(wind_mph: float, load_lb: float) -> tuple[RiskLevel, bool]:
    """Wind level after the load rules, and whether a load rule changed it."""
    base = wind_base_level(wind_mph)
    if base is RiskLevel.SEVERE and load_lb > LOAD_NO_TRAVEL_ABOVE_LB:
        return RiskLevel.NO_TRAVEL, True
    if base is RiskLevel.HIGH and load_lb > LOAD_SEVERE_ABOVE_LB:
        return RiskLevel.SEVERE, True
    return base, False


def classify_rain(rain_in_hr: float) -> RiskLevel:
    if rain_in_hr > RAIN_SEVERE_MAX_IN_HR:
        return RiskLevel.NO_TRAVEL
    if rain_in_hr >= RAIN_SEVERE_IN_HR:
        return RiskLevel.SEVERE
    if rain_in_hr >= RAIN_HIGH_IN_HR:
        return RiskLevel.HIGH
    if rain_in_hr >= RAIN_MODERATE_IN_HR:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_snow(snow_in_hr: float) -> RiskLevel:
    if snow_in_hr > SNOW_SEVERE_MAX_IN_HR:
        return RiskLevel.NO_TRAVEL
    if snow_in_hr >= SNOW_SEVERE_IN_HR:
        return RiskLevel.SEVERE
    if snow_in_hr >= SNOW_HIGH_IN_HR:
        return RiskLevel.HIGH
    if snow_in_hr >= SNOW_MODERATE_IN_HR:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def combine(levels: list[RiskLevel]) -> RiskLevel:
    """Overall level (DEC-17)."""
    known = [level for level in levels if level is not RiskLevel.UNKNOWN]
    if RiskLevel.NO_TRAVEL in known:
        return RiskLevel.NO_TRAVEL
    if len(known) < len(levels):
        return RiskLevel.UNKNOWN
    return max(known, key=_SEVERITY_INDEX.__getitem__)


def overall_level(
    wind_mph: object, rain_in_hr: object, snow_in_hr: object, load_lb: float
) -> RiskLevel:
    """Overall level only (no reasons); same rules as `assess`, used for the corridor grid."""
    wind = clean_value(wind_mph)
    rain = clean_value(rain_in_hr)
    snow = clean_value(snow_in_hr)
    return combine(
        [
            RiskLevel.UNKNOWN if wind is None else classify_wind(wind, load_lb)[0],
            RiskLevel.UNKNOWN if rain is None else classify_rain(rain),
            RiskLevel.UNKNOWN if snow is None else classify_snow(snow),
        ]
    )


def assess(
    wind_mph: object, rain_in_hr: object, snow_in_hr: object, load_lb: float
) -> RiskAssessment:
    """Classify one point in time. Invalid or missing values become UNKNOWN components."""
    wind = clean_value(wind_mph)
    rain = clean_value(rain_in_hr)
    snow = clean_value(snow_in_hr)
    reasons: list[str] = []

    if wind is None:
        wind_level, load_adjusted = RiskLevel.UNKNOWN, False
        reasons.append("Wind: no forecast → Unknown")
    else:
        wind_level, load_adjusted = classify_wind(wind, load_lb)
        base = wind_base_level(wind)
        if load_adjusted:
            limit = LOAD_NO_TRAVEL_ABOVE_LB if base is RiskLevel.SEVERE else LOAD_SEVERE_ABOVE_LB
            reasons.append(
                f"Wind {_fmt(wind, 1)} mph → {base.label}; load {_lb(load_lb)} lb is above "
                f"{_lb(limit)} lb → {wind_level.label}"
            )
        else:
            reasons.append(f"Wind {_fmt(wind, 1)} mph → {wind_level.label}")

    rain_level = RiskLevel.UNKNOWN if rain is None else classify_rain(rain)
    reasons.append(
        "Rain: no forecast → Unknown"
        if rain is None
        else f"Rain {_fmt(rain, 2)} in/hr → {rain_level.label}"
    )

    snow_level = RiskLevel.UNKNOWN if snow is None else classify_snow(snow)
    reasons.append(
        "Snow: no forecast → Unknown"
        if snow is None
        else f"Snow {_fmt(snow, 2)} in/hr → {snow_level.label}"
    )

    return RiskAssessment(
        overall=combine([wind_level, rain_level, snow_level]),
        wind=wind_level,
        rain=rain_level,
        snow=snow_level,
        load_adjusted=load_adjusted,
        reasons=tuple(reasons),
    )


def _lb(value: float) -> str:
    return f"{value:,.0f}" if float(value).is_integer() else f"{value:,.2f}"


def _fmt(value: float, min_decimals: int) -> str:
    """Format with `min_decimals`, adding up to 4 decimals if rounding would hide the value."""
    for decimals in range(min_decimals, 5):
        text = f"{value:.{decimals}f}"
        if math.isclose(float(text), value, rel_tol=0, abs_tol=1e-9):
            return text
    return f"{value:.4f}"
