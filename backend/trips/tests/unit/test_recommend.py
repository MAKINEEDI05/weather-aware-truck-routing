"""Ranking, eligibility and status matrix (docs/TEST_PLAN.md §2.6, cases K1–K17)."""

import random

import pytest

from trips.domain.recommend import RANKING_CRITERIA, format_duration, rank, recommend
from trips.domain.types import DecidedBy, RecommendationStatus
from trips.tests.factories import make_metrics, make_ranked

RECOMMENDED = RecommendationStatus.RECOMMENDED


def test_ranking_key_contains_only_pdf_criteria_and_final_tiebreak() -> None:
    assert RANKING_CRITERIA == (
        DecidedBy.SEVERE_MILES,
        DecidedBy.HIGH_MILES,
        DecidedBy.AVERAGE_RISK,
        DecidedBy.TRAVEL_TIME,
        DecidedBy.PROVIDER_ORDER,
    )


@pytest.mark.parametrize(
    ("a", "b", "decided_by"),
    [
        # K1 Severe decides even though B is worse on every other criterion.
        ((10, 0, 0.5, 100), (0, 50, 1.0, 200), DecidedBy.SEVERE_MILES),
        # K2 High decides.
        ((0, 40, 0.3, 100), (0, 10, 0.9, 300), DecidedBy.HIGH_MILES),
        # K3 Average decides.
        ((0, 0, 0.40, 100), (0, 0, 0.20, 200), DecidedBy.AVERAGE_RISK),
        # K4 Time decides.
        ((0, 0, 0.2, 300), (0, 0, 0.2, 200), DecidedBy.TRAVEL_TIME),
    ],
)
def test_first_differing_criterion_decides(a: tuple, b: tuple, decided_by: DecidedBy) -> None:
    result = recommend([make_ranked("A", *a), make_ranked("B", *b)])

    assert result.status is RECOMMENDED
    assert result.ranking == ("B", "A")
    assert result.route_id == "B"
    assert result.comparisons[0].other_route == "A"
    assert result.comparisons[0].decided_by is decided_by


def test_k5_full_tie_uses_provider_order() -> None:
    result = recommend([make_ranked("B", 0, 0, 0.2, 100), make_ranked("A", 0, 0, 0.2, 100)])

    assert result.ranking == ("A", "B")
    assert result.comparisons[0].decided_by is DecidedBy.PROVIDER_ORDER
    assert "provider's order decides" in result.explanation


def test_k6_travel_time_never_overrides_risk() -> None:
    result = recommend([make_ranked("A", 0, 5, 0.3, 180_000), make_ranked("B", 0, 6, 0.3, 18_000)])

    assert result.route_id == "A"
    assert result.comparisons[0].decided_by is DecidedBy.HIGH_MILES
    assert "fourth priority" in result.explanation


def test_k7_float_noise_ties_at_hundredths() -> None:
    result = recommend(
        [make_ranked("A", 0, 10.004, 0.5, 100), make_ranked("B", 0, 10.001, 0.2, 200)]
    )

    assert result.route_id == "B"
    assert result.comparisons[0].decided_by is DecidedBy.AVERAGE_RISK


def test_k8_null_average_sorts_last() -> None:
    result = recommend([make_ranked("A", 0, 0, None, 100), make_ranked("B", 0, 0, 0.5, 200)])

    assert result.ranking == ("B", "A")
    assert result.comparisons[0].decided_by is DecidedBy.AVERAGE_RISK
    assert result.comparisons[0].other_value is None


def test_k9_no_travel_keeps_rank_but_is_not_eligible() -> None:
    result = recommend(
        [make_ranked("A", 0, 0, 0.1, 100, no_travel=5), make_ranked("B", 0, 20, 1.0, 200)]
    )

    assert result.ranking == ("A", "B")
    assert result.route_id == "B"
    assert [(i.route, i.no_travel_mi) for i in result.ineligible] == [("A", 5)]
    comparison = result.comparisons[0]
    assert (comparison.other_route, comparison.other_rank, comparison.other_eligible) == (
        "A",
        1,
        False,
    )
    assert comparison.decided_by is DecidedBy.HIGH_MILES
    assert (comparison.recommended_value, comparison.other_value) == (20, 0)


def test_k10_no_travel_miles_are_not_severe_miles() -> None:
    route = make_ranked("A", 0, 0, 1.2, 100, no_travel=30)

    assert route.metrics.severe_mi == 0
    assert recommend([route]).status is RecommendationStatus.NO_ELIGIBLE_ROUTE


def test_k11_all_routes_no_travel() -> None:
    result = recommend(
        [
            make_ranked("A", 0, 0, 0.5, 100, no_travel=5),
            make_ranked("B", 0, 0, 0.3, 100, no_travel=2),
            make_ranked("C", 10, 0, 0.1, 100, no_travel=9),
        ]
    )

    assert result.status is RecommendationStatus.NO_ELIGIBLE_ROUTE
    assert result.route_id is None
    assert result.ranking == ("B", "A", "C")  # PDF ranking unchanged
    assert result.comparisons == ()
    assert "every route has No Travel conditions" in result.explanation
    assert "Route B 2.0 mi" in result.explanation


def test_k12_all_weather_unknown() -> None:
    result = recommend(
        [make_ranked("A", 0, 0, None, 100, unknown=100), make_ranked("B", 0, 0, None, 50)]
    )

    assert result.status is RecommendationStatus.NO_WEATHER_DATA
    assert result.route_id is None
    assert result.ranking == ("B", "A")


def test_k13_partial_unknown_is_still_recommended() -> None:
    result = recommend(
        [make_ranked("A", 0, 0, 0.1, 100, unknown=30), make_ranked("B", 0, 0, 0.05, 100)]
    )

    assert result.status is RECOMMENDED
    assert result.route_id == "B"


def test_k14_single_route() -> None:
    result = recommend([make_ranked("A", 0, 10, 0.4, 100)])

    assert result.status is RECOMMENDED
    assert result.route_id == "A"
    assert result.explanation == "Route A is recommended."


def test_k15_deterministic_for_shuffled_input() -> None:
    routes = [
        make_ranked("A", 0, 5, 0.3, 300),
        make_ranked("B", 0, 5, 0.3, 200),
        make_ranked("C", 2, 0, 0.1, 100),
    ]
    expected = recommend(routes)
    rng = random.Random(7)
    for _ in range(10):
        shuffled = routes[:]
        rng.shuffle(shuffled)
        assert recommend(shuffled) == expected
    assert expected.ranking == ("B", "A", "C")


def test_k16_explanation_names_no_travel_and_criteria() -> None:
    result = recommend(
        [
            make_ranked("A", 0, 0, 0.1, 100, no_travel=8.3),
            make_ranked("B", 0, 20, 1.0, 200),
            make_ranked("C", 25, 0, 0.5, 150),
        ]
    )

    assert result.explanation == (
        "Route B is recommended. "
        "Route A ranks higher (fewer High miles, 0.0 vs 20.0) but has 8.3 mi of No Travel "
        "conditions, so it cannot be recommended. "
        "Route C has more Severe miles (25.0 vs 0.0)."
    )


def test_k17_explanation_shows_two_decimals_when_needed() -> None:
    result = recommend([make_ranked("A", 0, 25.04, 0.3, 100), make_ranked("B", 0, 25.0, 0.3, 200)])

    assert result.route_id == "B"
    assert "(25.04 vs 25.00)" in result.explanation


def test_explanation_for_lost_on_high_includes_time_note() -> None:
    result = recommend(
        [make_ranked("A", 0, 50, 0.25, 54_120), make_ranked("C", 0, 25, 0.17, 56_100)]
    )

    assert result.explanation == (
        "Route C is recommended. Route A ties on Severe miles (0.0) but has more High miles "
        "(50.0 vs 25.0). It is 33 min faster, but travel time is only the fourth priority."
    )


def test_ineligible_route_ranked_below_is_flagged() -> None:
    result = recommend(
        [make_ranked("A", 0, 0, 0.1, 100), make_ranked("B", 25, 0, 0.4, 100, no_travel=25)]
    )

    assert "It also has 25.0 mi of No Travel conditions" in result.explanation


def test_rank_orders_all_routes() -> None:
    routes = [make_ranked("A", 1, 0, 0, 1), make_ranked("B", 0, 0, 0, 2)]

    assert [r.id for r in rank(routes)] == ["B", "A"]


def test_eligibility_uses_checkpoint_counts_not_rounded_miles() -> None:
    route = make_ranked("A", 0, 0, 0.1, 100)
    tiny_no_travel = type(route)(
        id="A",
        provider_index=0,
        metrics=make_metrics(no_travel=0.0, no_travel_count=1),
        travel_time_s=100,
    )

    assert recommend([tiny_no_travel]).status is RecommendationStatus.NO_ELIGIBLE_ROUTE


@pytest.mark.parametrize(
    ("seconds", "text"),
    [(59, "1 min"), (1980, "33 min"), (56_100, "15 h 35 m"), (3600, "1 h 00 m")],
)
def test_format_duration(seconds: int, text: str) -> None:
    assert format_duration(seconds) == text


def test_empty_input_is_rejected() -> None:
    with pytest.raises(ValueError):
        recommend([])


@pytest.mark.parametrize(
    ("ineligible_a", "b", "phrase"),
    [
        ((0, 0, 0.1, 100), (10, 0, 0.1, 100), "fewer Severe miles, 0.0 vs 10.0"),
        ((0, 0, 0.1, 100), (0, 0, 0.3, 100), "lower average risk, 0.10 vs 0.30"),
        ((0, 0, 0.1, 3600), (0, 0, 0.1, 7200), "shorter travel time, 1 h 00 m vs 2 h 00 m"),
        ((0, 0, 0.1, 100), (0, 0, 0.1, 100), "the routing provider's order on a full tie"),
    ],
)
def test_explains_why_a_higher_ranked_route_is_not_recommended(
    ineligible_a: tuple, b: tuple, phrase: str
) -> None:
    result = recommend([make_ranked("A", *ineligible_a, no_travel=4), make_ranked("B", *b)])

    assert result.ranking == ("A", "B")
    assert result.route_id == "B"
    assert f"Route A ranks higher ({phrase}) but has 4.0 mi of No Travel" in result.explanation


def test_explains_average_and_time_losses() -> None:
    by_average = recommend([make_ranked("A", 0, 0, 0.123, 100), make_ranked("B", 0, 0, 0.125, 50)])
    by_time = recommend([make_ranked("A", 0, 0, 0.1, 3600), make_ranked("B", 0, 0, 0.1, 5400)])

    assert (
        "Route B ties on Severe and High miles but has a higher average risk (0.125 vs 0.123)."
        in (by_average.explanation)
    )
    assert "It is 1 min faster" not in by_average.explanation
    assert by_time.explanation.endswith("takes longer (1 h 30 m vs 1 h 00 m).")
