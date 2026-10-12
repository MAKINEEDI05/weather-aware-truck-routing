from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from trips import planner
from trips.services import tomtom

from .exceptions import LocationNotFound
from .presenters import geocode_json, plan_json
from .serializers import GeocodeQuerySerializer, PlanTripSerializer


class HealthView(APIView):
    """Liveness check for hosts and the frontend (§9.1). Never calls external providers."""

    def get(self, request: Request) -> Response:
        return Response({"status": "ok", "version": settings.APP_VERSION})


class GeocodeView(APIView):
    """US place candidates for a free-text query (TomTom Geocode)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "geocode"

    def get(self, request: Request) -> Response:
        query = GeocodeQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        places = tomtom.geocode(query.validated_data["q"])
        if not places:
            raise LocationNotFound()
        return Response({"results": [geocode_json(place) for place in places]})


class PlanTripView(APIView):
    """Routes, checkpoint risk, recommendation and corridor heatmap for one trip."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "plan"

    def post(self, request: Request) -> Response:
        serializer = PlanTripSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = planner.plan_trip(serializer.to_command())
        return Response(plan_json(result))
