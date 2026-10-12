from django.urls import include, path

from trips.api.views import HealthView

urlpatterns = [
    path("api/v1/", include("trips.api.urls")),
    # Unversioned alias of the health check; the versioned path is the API contract (DEC-43).
    path("api/health/", HealthView.as_view(), name="health-unversioned"),
]

handler404 = "trips.api.exceptions.json_404"
handler500 = "trips.api.exceptions.json_500"
