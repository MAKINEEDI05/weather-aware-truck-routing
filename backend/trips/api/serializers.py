"""Request validation (docs/REQUIREMENTS.md §5). Backend validation is authoritative."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from django.conf import settings
from rest_framework import serializers

from trips.domain.checkpoints import ALLOWED_INTERVALS_MI
from trips.domain.geo import haversine_mi
from trips.domain.types import LatLon, Place, PlanCommand

MIN_SEPARATION_MI = 1.0
DEPARTURE_GRACE = timedelta(minutes=15)  # DEC-31
MAX_LOAD_LB = 100_000  # DEC-6: input sanity bound, not a business rule


class StrictFloatField(serializers.FloatField):
    """A JSON number only: rejects booleans and strings."""

    def to_internal_value(self, data: Any) -> float:
        if isinstance(data, bool) or isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class PlaceSerializer(serializers.Serializer):
    label = serializers.CharField(min_length=1, max_length=200)
    lat = StrictFloatField(min_value=-90, max_value=90)
    lon = StrictFloatField(min_value=-180, max_value=180)


class GeocodeQuerySerializer(serializers.Serializer):
    q = serializers.CharField(min_length=2, max_length=120)


class PlanTripSerializer(serializers.Serializer):
    origin = PlaceSerializer()
    destination = PlaceSerializer()
    departure_time = serializers.CharField()
    load_weight_lb = StrictFloatField(min_value=0, max_value=MAX_LOAD_LB)
    checkpoint_interval_mi = serializers.ChoiceField(choices=ALLOWED_INTERVALS_MI)

    def _now(self) -> datetime:
        return self.context.get("now") or datetime.now(UTC)

    def validate_departure_time(self, value: str) -> datetime:
        try:
            parsed = datetime.fromisoformat(value.strip())
        except ValueError:
            raise serializers.ValidationError(
                "Use ISO 8601 with a UTC offset, e.g. 2026-10-14T08:00:00-05:00.", code="invalid"
            ) from None
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise serializers.ValidationError(
                "Include a UTC offset, e.g. 2026-10-14T08:00:00-05:00.", code="invalid"
            )
        departure = parsed.astimezone(UTC)
        now = self._now()
        days = settings.MAX_DEPARTURE_DAYS_AHEAD
        if departure < now - DEPARTURE_GRACE or departure > now + timedelta(days=days):
            raise serializers.ValidationError(
                f"Choose a departure between now and {days} days from now.",
                code="departure_out_of_range",
            )
        return departure

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        origin = LatLon(attrs["origin"]["lat"], attrs["origin"]["lon"])
        destination = LatLon(attrs["destination"]["lat"], attrs["destination"]["lon"])
        if haversine_mi(origin, destination) < MIN_SEPARATION_MI:
            raise serializers.ValidationError(
                {"destination": ["Origin and destination must be at least 1 mile apart."]},
                code="same_location",
            )
        return attrs

    def to_command(self) -> PlanCommand:
        data = self.validated_data

        def place(raw: dict[str, Any]) -> Place:
            return Place(label=raw["label"], point=LatLon(raw["lat"], raw["lon"]))

        return PlanCommand(
            origin=place(data["origin"]),
            destination=place(data["destination"]),
            departure_utc=data["departure_time"],
            load_lb=data["load_weight_lb"],
            interval_mi=int(data["checkpoint_interval_mi"]),
        )
