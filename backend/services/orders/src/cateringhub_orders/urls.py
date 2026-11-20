from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from .accounts.views import (
    CsrfView,
    LoginView,
    LogoutView,
    ProfileView,
    RegisterView,
    SessionIdentityView,
)
from .sales.views import MealViewSet, OrderViewSet, health

router = DefaultRouter()
router.register("menu", MealViewSet)
router.register("orders", OrderViewSet, basename="order")
urlpatterns = [
    path("api/orders/admin/", admin.site.urls),
    path("api/orders/v1/health/", health),
    path("api/orders/v1/auth/csrf/", CsrfView.as_view()),
    path("api/orders/v1/auth/register/", RegisterView.as_view()),
    path("api/orders/v1/auth/login/", LoginView.as_view()),
    path("api/orders/v1/auth/logout/", LogoutView.as_view()),
    path("api/orders/v1/auth/me/", ProfileView.as_view()),
    path("api/orders/v1/auth/session/", SessionIdentityView.as_view()),
    path("api/orders/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/orders/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/orders/v1/", include(router.urls)),
]
