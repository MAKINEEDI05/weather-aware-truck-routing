from django.urls import path

from .views import GeocodeView, HealthView, PlanTripView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("geocode/", GeocodeView.as_view(), name="geocode"),
    path("trips/plan/", PlanTripView.as_view(), name="plan-trip"),
]
