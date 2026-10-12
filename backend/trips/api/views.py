from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Liveness check for hosts and the frontend (§9.1). Never calls external providers."""

    def get(self, request: Request) -> Response:
        return Response({"status": "ok", "version": settings.APP_VERSION})
