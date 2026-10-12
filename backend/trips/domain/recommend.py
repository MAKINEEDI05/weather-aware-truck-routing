"""Route ranking (assessment PDF) and recommendation eligibility (app policy), kept separate.

Ranking — assessment PDF, "Route Recommendation" (quoted):

    Prefer:
    1. Fewest Severe miles
    2. Fewest High miles
    3. Lowest average risk
    4. Shortest travel times

The criteria are compared in this order and the first difference decides. There is no weighted
score. DEC-20 adds only what determinism needs: values are compared at their rounded precision
(0.01 mi, 4-decimal average), a `null` average sorts last, and the provider's order breaks a
complete tie.

Eligibility — DEC-12 (app policy, not a PDF rule): a route with any No Travel checkpoint keeps its
rank but cannot be recommended. No Travel miles are not counted as Severe miles (DEC-13).

Status — DEC-21, evaluated in order: NO_WEATHER_DATA → NO_ELIGIBLE_ROUTE → RECOMMENDED.
"""

from __future__ import annotations

from collections.abc import Sequence

from .types import (
    Comparison,
    DecidedBy,
    Ineligible,
    Recommendation,
    RecommendationStatus,
    RouteForRanking,
)

RANKING_CRITERIA: tuple[DecidedBy, ...] = (
    DecidedBy.SEVERE_MILES,
    DecidedBy.HIGH_MILES,
    DecidedBy.AVERAGE_RISK,
    DecidedBy.TRAVEL_TIME,
    DecidedBy.PROVIDER_ORDER,  # deterministic final tie-break, never above a PDF criterion
)


def criterion_value(route: RouteForRanking, criterion: DecidedBy) -> float | int | None:
    metrics = route.metrics
    match criterion:
        case DecidedBy.SEVERE_MILES:
            return round(metrics.severe_mi, 2)
        case DecidedBy.HIGH_MILES:
            return round(metrics.high_mi, 2)
        case DecidedBy.AVERAGE_RISK:
            return None if metrics.average_risk is None else round(metrics.average_risk, 4)
        case DecidedBy.TRAVEL_TIME:
            return route.travel_time_s
        case DecidedBy.PROVIDER_ORDER:
            return route.provider_index
    raise ValueError(f"Unknown criterion {criterion!r}")  # pragma: no cover


def _sortable(value: float | int | None) -> tuple[int, float]:
    # Lower is better for every criterion; a null average sorts after any number.
    if value is None:
        return (1, 0.0)
    return (0, float(value))


def rank_key(route: RouteForRanking) -> tuple[tuple[int, float], ...]:
    return tuple(_sortable(criterion_value(route, c)) for c in RANKING_CRITERIA)


def rank(routes: Sequence[RouteForRanking]) -> list[RouteForRanking]:
    """All routes ordered by the PDF priority. Eligibility does not affect the order."""
    return sorted(routes, key=rank_key)


def first_difference(
    better: RouteForRanking, worse: RouteForRanking
) -> tuple[DecidedBy, float | int | None, float | int | None]:
    """The first criterion on which two routes differ, with both values."""
    for criterion in RANKING_CRITERIA:
        a, b = criterion_value(better, criterion), criterion_value(worse, criterion)
        if _sortable(a) != _sortable(b):
            return criterion, a, b
    return DecidedBy.PROVIDER_ORDER, better.provider_index, worse.provider_index


def is_eligible(route: RouteForRanking) -> bool:
    return route.metrics.no_travel_count == 0


def has_no_weather(route: RouteForRanking) -> bool:
    return route.metrics.unknown_count == route.metrics.checkpoint_count


def recommend(routes: Sequence[RouteForRanking]) -> Recommendation:
    if not routes:
        raise ValueError("At least one route is required.")
    ranked = rank(routes)
    ranking = tuple(route.id for route in ranked)
    ineligible = tuple(
        Ineligible(route=route.id, no_travel_mi=route.metrics.no_travel_mi)
        for route in ranked
        if not is_eligible(route)
    )

    if all(has_no_weather(route) for route in ranked):
        return Recommendation(
            status=RecommendationStatus.NO_WEATHER_DATA,
            route_id=None,
            ranking=ranking,
            comparisons=(),
            ineligible=ineligible,
            explanation=(
                "No route can be recommended because no checkpoint has forecast data. "
                "The routes are shown, but they cannot be compared on weather risk."
            ),
        )

    eligible = [route for route in ranked if is_eligible(route)]
    if not eligible:
        listed = ", ".join(f"{_label(i.route)} {_mi(i.no_travel_mi)} mi" for i in ineligible)
        return Recommendation(
            status=RecommendationStatus.NO_ELIGIBLE_ROUTE,
            route_id=None,
            ranking=ranking,
            comparisons=(),
            ineligible=ineligible,
            explanation=(
                f"No route can be recommended: every route has No Travel conditions ({listed}). "
                "The ranking is shown for reference. Try a different departure time."
            ),
        )

    chosen = eligible[0]
    chosen_rank = ranking.index(chosen.id) + 1
    comparisons: list[Comparison] = []
    sentences = [f"{_label(chosen.id)} is recommended."]
    for position, other in enumerate(ranked, start=1):
        if other.id == chosen.id:
            continue
        other_above = position < chosen_rank
        if other_above:
            criterion, other_value, chosen_value = first_difference(other, chosen)
        else:
            criterion, chosen_value, other_value = first_difference(chosen, other)
        comparisons.append(
            Comparison(
                other_route=other.id,
                other_rank=position,
                other_eligible=is_eligible(other),
                decided_by=criterion,
                recommended_value=chosen_value,
                other_value=other_value,
            )
        )
        sentences.append(_explain_pair(chosen, other, other_above, criterion))

    return Recommendation(
        status=RecommendationStatus.RECOMMENDED,
        route_id=chosen.id,
        ranking=ranking,
        comparisons=tuple(comparisons),
        ineligible=ineligible,
        explanation=" ".join(sentences),
    )


# --- explanation text -----------------------------------------------------------------------


def _label(route_id: str) -> str:
    return f"Route {route_id}"


def _mi(value: float) -> str:
    return f"{value:.1f}"


def _mi_pair(a: float, b: float) -> tuple[str, str]:
    """1 decimal, or 2 when 1-decimal text would hide a real difference (DEC-49)."""
    one = (f"{a:.1f}", f"{b:.1f}")
    if one[0] == one[1] and round(a, 2) != round(b, 2):
        return f"{a:.2f}", f"{b:.2f}"
    return one


def _avg_pair(a: float | None, b: float | None) -> tuple[str, str]:
    def text(value: float | None, decimals: int) -> str:
        return "unknown" if value is None else f"{value:.{decimals}f}"

    for decimals in (2, 3, 4):
        pair = (text(a, decimals), text(b, decimals))
        if pair[0] != pair[1] or a == b:
            return pair
    return text(a, 4), text(b, 4)


def format_duration(seconds: int) -> str:
    minutes = round(seconds / 60)
    hours, minutes = divmod(minutes, 60)
    if hours == 0:
        return f"{minutes} min"
    return f"{hours} h {minutes:02d} m"


def _explain_pair(
    chosen: RouteForRanking, other: RouteForRanking, other_above: bool, criterion: DecidedBy
) -> str:
    c, o = chosen.metrics, other.metrics
    name = _label(other.id)
    no_travel = f"{_mi(o.no_travel_mi)} mi of No Travel conditions"

    if other_above:
        if criterion is DecidedBy.SEVERE_MILES:
            ov, cv = _mi_pair(o.severe_mi, c.severe_mi)
            why = f"fewer Severe miles, {ov} vs {cv}"
        elif criterion is DecidedBy.HIGH_MILES:
            ov, cv = _mi_pair(o.high_mi, c.high_mi)
            why = f"fewer High miles, {ov} vs {cv}"
        elif criterion is DecidedBy.AVERAGE_RISK:
            ov, cv = _avg_pair(o.average_risk, c.average_risk)
            why = f"lower average risk, {ov} vs {cv}"
        elif criterion is DecidedBy.TRAVEL_TIME:
            why = (
                f"shorter travel time, {format_duration(other.travel_time_s)} vs "
                f"{format_duration(chosen.travel_time_s)}"
            )
        else:
            why = "the routing provider's order on a full tie"
        return f"{name} ranks higher ({why}) but has {no_travel}, so it cannot be recommended."

    if criterion is DecidedBy.SEVERE_MILES:
        ov, cv = _mi_pair(o.severe_mi, c.severe_mi)
        sentence = f"{name} has more Severe miles ({ov} vs {cv})."
    elif criterion is DecidedBy.HIGH_MILES:
        ov, cv = _mi_pair(o.high_mi, c.high_mi)
        sentence = (
            f"{name} ties on Severe miles ({_mi(c.severe_mi)}) but has more High miles "
            f"({ov} vs {cv})."
        )
    elif criterion is DecidedBy.AVERAGE_RISK:
        ov, cv = _avg_pair(o.average_risk, c.average_risk)
        sentence = (
            f"{name} ties on Severe and High miles but has a higher average risk ({ov} vs {cv})."
        )
    elif criterion is DecidedBy.TRAVEL_TIME:
        sentence = (
            f"{name} ties on Severe miles, High miles and average risk but takes longer "
            f"({format_duration(other.travel_time_s)} vs {format_duration(chosen.travel_time_s)})."
        )
    else:
        sentence = f"{name} ties on all four criteria; the routing provider's order decides."

    faster_by = chosen.travel_time_s - other.travel_time_s
    if criterion in (DecidedBy.SEVERE_MILES, DecidedBy.HIGH_MILES, DecidedBy.AVERAGE_RISK):
        if faster_by >= 60:
            sentence += (
                f" It is {format_duration(faster_by)} faster, but travel time is only the "
                "fourth priority."
            )
    if not is_eligible(other):
        sentence += f" It also has {no_travel}, so it cannot be recommended."
    return sentence
