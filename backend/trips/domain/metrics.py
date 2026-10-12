"""Risk-mile aggregation per route (blueprint §3.7, DEC-13, DEC-14).

Miles are rounded to 0.01 mi and average risk to 4 decimals here, once. The same rounded values
are ranked (DEC-20), returned by the API and shown in the UI.
"""

from __future__ import annotations

from collections.abc import Sequence

from .types import RISK_SCORE, Checkpoint, RiskLevel, RouteMetrics

MILES_DECIMALS = 2
AVERAGE_DECIMALS = 4


def route_metrics(checkpoints: Sequence[Checkpoint], length_mi: float) -> RouteMetrics:
    if not checkpoints:
        raise ValueError("A route needs at least one checkpoint.")
    miles = dict.fromkeys(RiskLevel, 0.0)
    weighted_score = 0.0
    for checkpoint in checkpoints:
        level = checkpoint.risk.overall
        miles[level] += checkpoint.covered_mi
        if level is not RiskLevel.UNKNOWN:
            weighted_score += RISK_SCORE[level] * checkpoint.covered_mi

    unknown_mi = miles[RiskLevel.UNKNOWN]
    known_mi = max(0.0, length_mi - unknown_mi)
    unknown_count = sum(1 for c in checkpoints if c.risk.overall is RiskLevel.UNKNOWN)
    has_known = unknown_count < len(checkpoints) and known_mi > 0
    average = round(weighted_score / known_mi, AVERAGE_DECIMALS) if has_known else None

    def r(value: float) -> float:
        return round(value, MILES_DECIMALS)

    return RouteMetrics(
        distance_mi=r(length_mi),
        low_mi=r(miles[RiskLevel.LOW]),
        moderate_mi=r(miles[RiskLevel.MODERATE]),
        high_mi=r(miles[RiskLevel.HIGH]),
        # Severe miles count SEVERE checkpoints only; No Travel is reported separately (DEC-13).
        severe_mi=r(miles[RiskLevel.SEVERE]),
        no_travel_mi=r(miles[RiskLevel.NO_TRAVEL]),
        unknown_mi=r(unknown_mi),
        known_mi=r(known_mi),
        average_risk=average,
        checkpoint_count=len(checkpoints),
        unknown_count=unknown_count,
        no_travel_count=sum(1 for c in checkpoints if c.risk.overall is RiskLevel.NO_TRAVEL),
    )
