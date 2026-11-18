from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from .stock.views import IngredientViewSet, ReceiptViewSet, health

router = SimpleRouter(use_regex_path=False)
router.register("ingredients", IngredientViewSet)
router.register("receipts", ReceiptViewSet)

urlpatterns = [
    path("api/inventory/v1/health/", health),
    path("api/inventory/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/inventory/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/inventory/v1/", include(router.urls)),
]
