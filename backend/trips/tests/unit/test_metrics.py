import pytest

from trips.domain.metrics import route_metrics
from trips.domain.types import RiskLevel
from trips.tests.factories import make_checkpoint

L, M, H, S, NT, U = (
    RiskLevel.LOW,
    RiskLevel.MODERATE,
    RiskLevel.HIGH,
    RiskLevel.SEVERE,
    RiskLevel.NO_TRAVEL,
    RiskLevel.UNKNOWN,
)


def test_miles_per_level_and_average() -> None:
    checkpoints = [
        make_checkpoint(L, 5),
        make_checkpoint(M, 10),
        make_checkpoint(H, 10),
        make_checkpoint(S, 10),
        make_checkpoint(L, 5),
    ]

    metrics = route_metrics(checkpoints, 40)

    assert (metrics.low_mi, metrics.moderate_mi, metrics.high_mi, metrics.severe_mi) == (
        10,
        10,
        10,
        10,
    )
    assert metrics.no_travel_mi == 0
    assert metrics.unknown_mi == 0
    assert metrics.known_mi == 40
    # (0×10 + 1×10 + 2×10 + 3×10) / 40 = 1.5
    assert metrics.average_risk == 1.5
    assert metrics.distance_mi == 40


def test_no_travel_is_not_counted_as_severe() -> None:  # K10
    metrics = route_metrics([make_checkpoint(NT, 30), make_checkpoint(L, 70)], 100)

    assert metrics.severe_mi == 0
    assert metrics.no_travel_mi == 30
    assert metrics.no_travel_count == 1
    assert metrics.average_risk == pytest.approx(1.2)  # 4 × 30 / 100


def test_average_uses_known_miles_only() -> None:
    metrics = route_metrics([make_checkpoint(H, 50), make_checkpoint(U, 50)], 100)

    assert metrics.unknown_mi == 50
    assert metrics.known_mi == 50
    assert metrics.average_risk == 2.0
    assert metrics.unknown_count == 1


def test_all_unknown_has_no_average() -> None:
    metrics = route_metrics([make_checkpoint(U, 60), make_checkpoint(U, 40)], 100)

    assert metrics.average_risk is None
    assert metrics.known_mi == 0
    assert metrics.unknown_count == metrics.checkpoint_count == 2


def test_rounding() -> None:
    metrics = route_metrics([make_checkpoint(H, 10.004), make_checkpoint(L, 20.0)], 30.004)

    assert metrics.high_mi == 10.0
    assert metrics.distance_mi == 30.0
    assert metrics.average_risk == pytest.approx(round(2 * 10.004 / 30.004, 4))


def test_empty_route_is_rejected() -> None:
    with pytest.raises(ValueError):
        route_metrics([], 10)
