"""Planner integration with fake providers (no network)."""

from datetime import UTC, datetime, timedelta

import pytest

from trips import planner
from trips.api.presenters import plan_json
from trips.domain.types import LatLon, Place, PlanCommand, RecommendationStatus, RiskLevel
from trips.tests import synthetic_tomtom
from trips.tests.fakes import FakeWeather, install, windy_near_salina

DEPARTURE = datetime(2026, 10, 14, 13, 20, tzinfo=UTC)
NOW = datetime(2026, 10, 12, 10, 0, tzinfo=UTC)


def command(load: float = 20_000, interval: int = 25) -> PlanCommand:
    return PlanCommand(
        origin=Place("Chicago, IL", synthetic_tomtom.CHICAGO),
        destination=Place("Denver, CO", synthetic_tomtom.DENVER),
        departure_utc=DEPARTURE,
        load_lb=load,
        interval_mi=interval,
    )


def codes(result) -> list[str]:
    return [w.code for w in result.warnings]


def weather_codes(result) -> list[str]:
    return [w.code for w in result.warnings if "WEATHER" in w.code]


def weather_message(result, code: str) -> str:
    return next(w.message for w in result.warnings if w.code == code)


def test_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, weather=FakeWeather(windy_near_salina))

    result = planner.plan_trip(command(), now=NOW)

    assert [r.id for r in result.routes] == ["A", "B", "C"]
    for route in result.routes:
        assert route.checkpoints[0].mile == 0
        assert route.checkpoints[0].eta_utc == DEPARTURE.replace(second=0)
        assert sum(c.covered_mi for c in route.checkpoints) == pytest.approx(
            route.distance_mi, abs=0.01
        )
        assert route.arrival_utc == DEPARTURE + timedelta(seconds=route.travel_time_s)
        assert all(c.weather is not None for c in route.checkpoints)
    south = result.routes[2]  # third synthetic corridor passes Salina
    assert south.metrics.high_mi > 0
    assert result.recommendation.status is RecommendationStatus.RECOMMENDED
    assert result.recommendation.route_id != "C"
    assert south.rank == 3
    assert result.corridor.hours == 49
    assert all(len(cell.risk) == 49 for cell in result.corridor.cells)
    assert "FEWER_THAN_THREE_ROUTES" not in codes(result)


def test_heavy_load_turns_high_wind_into_severe(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, weather=FakeWeather(windy_near_salina))

    result = planner.plan_trip(command(load=42_000), now=NOW)

    south = result.routes[2]
    assert south.metrics.severe_mi > 0
    assert south.metrics.high_mi == 0
    assert any(c.risk.load_adjusted for c in south.checkpoints)


def test_no_travel_route_is_ineligible(monkeypatch: pytest.MonkeyPatch) -> None:
    def gale(point: LatLon):
        if 38.5 < point.lat < 39.2 and -99.5 < point.lon < -96.0:
            return 50.0, 0.0, 0.0  # 45–54 mph + > 30,000 lb → No Travel
        return 10.0, 0.0, 0.0

    install(monkeypatch, weather=FakeWeather(gale))

    result = planner.plan_trip(command(load=35_000), now=NOW)

    south = result.routes[2]
    assert south.metrics.no_travel_mi > 0
    assert south.metrics.severe_mi == 0
    assert south.eligible is False
    assert [i.route for i in result.recommendation.ineligible] == ["C"]


@pytest.mark.parametrize("interval", [10, 25, 50])
def test_interval_controls_checkpoint_spacing(monkeypatch, interval: int) -> None:
    install(monkeypatch)

    route = planner.plan_trip(command(interval=interval), now=NOW).routes[0]

    miles = [c.mile for c in route.checkpoints]
    assert miles[1] == interval
    assert miles[-1] == pytest.approx(route.distance_mi, abs=0.01)


def test_fewer_than_three_routes_warns(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, routes_body=synthetic_tomtom.routes_response("middle", "south"))

    result = planner.plan_trip(command(), now=NOW)

    assert len(result.routes) == 2
    assert "FEWER_THAN_THREE_ROUTES" in codes(result)


def test_partial_weather_marks_unknown(monkeypatch: pytest.MonkeyPatch) -> None:
    weather = FakeWeather(fail=lambda p: p.lon < -100.0)
    install(monkeypatch, weather=weather)

    result = planner.plan_trip(command(), now=NOW)

    assert "WEATHER_PARTIAL" in codes(result)
    assert "CORRIDOR_WEATHER_PARTIAL" in codes(result)
    assert "INCOMPLETE_WEATHER_DATA" in codes(result)
    assert "per-minute" not in " ".join(w.message for w in result.warnings)
    route = result.routes[0]
    unknown = [c for c in route.checkpoints if c.risk.overall is RiskLevel.UNKNOWN]
    assert unknown and all(c.weather is None for c in unknown)
    assert route.metrics.unknown_mi > 0
    assert result.recommendation.status is RecommendationStatus.RECOMMENDED


def test_no_weather_at_all(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, weather=FakeWeather(fail=lambda _: True))

    result = planner.plan_trip(command(), now=NOW)

    assert "WEATHER_UNAVAILABLE" in codes(result)
    assert result.recommendation.status is RecommendationStatus.NO_WEATHER_DATA
    assert all(set(cell.risk) == {-1} for cell in result.corridor.cells)


def test_weather_window_covers_heatmap_and_latest_arrival(monkeypatch) -> None:
    slow = synthetic_tomtom.routes_response("middle", "north", "south", speeds=(15, 55, 55))
    weather = install(monkeypatch, routes_body=slow)

    result = planner.plan_trip(command(), now=NOW)

    _, start, end = weather.calls[0]
    assert start == DEPARTURE.replace(minute=0)
    assert end - start >= timedelta(hours=48)
    latest = max(r.arrival_utc for r in result.routes)
    assert end >= latest


def test_deterministic(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, weather=FakeWeather(windy_near_salina))

    first = plan_json(planner.plan_trip(command(), now=NOW))
    second = plan_json(planner.plan_trip(command(), now=NOW))

    assert first == second


def test_checkpoint_weather_is_fetched_before_heatmap_cells(monkeypatch) -> None:
    weather = install(monkeypatch)

    result = planner.plan_trip(command(), now=NOW)

    checkpoints = {c.point for r in result.routes for c in r.checkpoints}
    cells = {LatLon(c.lat, c.lon) for c in result.corridor.cells}
    assert [count for count, _, _ in weather.calls] == [len(checkpoints), len(cells)]
    assert weather.calls[0][1:] == weather.calls[1][1:]  # one shared time window


def test_missing_heatmap_cells_do_not_mark_checkpoints_partial(monkeypatch) -> None:
    # Regression: a rate-limited cell batch must not degrade the recommendation (VF-11).
    install(monkeypatch, weather=FakeWeather(windy_near_salina, fail_calls=(1,), rate_limited=True))

    result = planner.plan_trip(command(), now=NOW)

    assert result.recommendation.status is RecommendationStatus.RECOMMENDED
    assert weather_codes(result) == ["CORRIDOR_WEATHER_PARTIAL"]
    assert "per-minute limit" in weather_message(result, "CORRIDOR_WEATHER_PARTIAL")
    assert all(
        c.risk.overall is not RiskLevel.UNKNOWN for r in result.routes for c in r.checkpoints
    )
    assert all(set(cell.risk) == {-1} for cell in result.corridor.cells)


def test_rate_limited_checkpoint_weather_says_to_wait(monkeypatch) -> None:
    install(monkeypatch, weather=FakeWeather(fail_calls=(0, 1), rate_limited=True))

    result = planner.plan_trip(command(), now=NOW)

    assert result.recommendation.status is RecommendationStatus.NO_WEATHER_DATA
    assert weather_codes(result) == ["WEATHER_UNAVAILABLE", "CORRIDOR_WEATHER_PARTIAL"]
    assert "wait about a minute" in weather_message(result, "WEATHER_UNAVAILABLE")
    # The hint is given once.
    assert "per-minute" not in weather_message(result, "CORRIDOR_WEATHER_PARTIAL")
