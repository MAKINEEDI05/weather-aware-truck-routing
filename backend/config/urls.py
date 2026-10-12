from django.urls import include, path

from trips.api.views import HealthView

urlpatterns = [
    path("api/v1/", include("trips.api.urls")),
    # Unversioned alias of the health check; the versioned path is the API contract (§9.1).
    path("api/health/", HealthView.as_view(), name="health-unversioned"),
]
