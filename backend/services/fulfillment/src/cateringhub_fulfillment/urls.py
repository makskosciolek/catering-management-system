from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from .operations.views import health, session

urlpatterns = [
    path("api/fulfillment/v1/health/", health),
    path("api/fulfillment/v1/session/", session),
    path("api/fulfillment/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/fulfillment/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
]
