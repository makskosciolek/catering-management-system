from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from .operations.views import ProductionViewSet, health, session

router = SimpleRouter(use_regex_path=False)
router.register("production", ProductionViewSet, basename="production")
urlpatterns = [
    path("api/fulfillment/v1/health/", health),
    path("api/fulfillment/v1/session/", session),
    path("api/fulfillment/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/fulfillment/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/fulfillment/v1/", include(router.urls)),
]
