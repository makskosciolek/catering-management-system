from cateringhub_core.auth import PRODUCTION_WRITE_ROLES
from django.conf import settings
from django.db import connection
from django.db.models import Count, Sum
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import filters, serializers, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Meal, Order
from .production import start_production
from .rules import earliest_delivery_date
from .serializers import CreateOrderSerializer, MealSerializer, OrderSerializer
from .services import cancel_order


@extend_schema(
    responses=inline_serializer(
        "Health",
        {"status": serializers.CharField(), "service": serializers.CharField()},
    )
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return Response({"status": "ok", "service": "orders"})


@extend_schema(exclude=True)
@api_view(["POST"])
@authentication_classes([JWTAuthentication])
def start_fulfillment(request, order_id):
    # Realizacja sprawdza CSRF przed przekazaniem tokenu pracownika w nagłówku.
    if request.user.role not in PRODUCTION_WRITE_ROLES:
        raise PermissionDenied("Ta rola nie może rozpocząć produkcji.")
    start_production(order_id)
    return Response(status=status.HTTP_204_NO_CONTENT)


class MealViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MealSerializer
    queryset = Meal.objects.filter(is_active=True)
    permission_classes = [AllowAny]
    authentication_classes = []
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "description", "allergens"]
    pagination_class = None


@extend_schema_view(
    create=extend_schema(
        request=CreateOrderSerializer,
        responses={
            201: OrderSerializer,
            200: OrderSerializer,
            409: OpenApiResponse(description="Identyfikator zamówienia użyty z innymi danymi."),
        },
    ),
    list=extend_schema(parameters=[OpenApiParameter("delivery_date", OpenApiTypes.DATE)]),
)
class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = [
        "customer__email",
        "customer__first_name",
        "customer__last_name",
        "delivery_address",
    ]

    def get_queryset(self):
        queryset = Order.objects.select_related("customer").prefetch_related("items")
        if getattr(self, "swagger_fake_view", False):
            return queryset.none()
        if not (
            self.request.user.manages_orders
            or self.request.user.role == self.request.user.Role.CUSTOMER
        ):
            raise PermissionDenied("Ta rola nie ma dostępu do zamówień.")
        if not self.request.user.manages_orders:
            queryset = queryset.filter(customer=self.request.user)
        delivery_date = self.request.query_params.get("delivery_date")
        if delivery_date:
            parsed_date = serializers.DateField().run_validation(delivery_date)
            queryset = queryset.filter(delivery_date=parsed_date)
        return queryset

    def create(self, request):
        if request.user.role != request.user.Role.CUSTOMER:
            raise PermissionDenied("Zamówienie można złożyć z konta klienta.")
        serializer = CreateOrderSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        response_status = status.HTTP_201_CREATED if serializer.created else status.HTTP_200_OK
        return Response(OrderSerializer(order).data, status=response_status)

    @extend_schema(
        responses=inline_serializer(
            "DeliveryWindow",
            {
                "earliest_delivery_date": serializers.DateField(),
                "cutoff_hour": serializers.IntegerField(),
            },
        )
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="delivery-window",
        authentication_classes=[],
        permission_classes=[AllowAny],
    )
    def delivery_window(self, request):
        return Response(
            {
                "earliest_delivery_date": earliest_delivery_date().isoformat(),
                "cutoff_hour": settings.ORDER_CUTOFF_HOUR,
            }
        )

    @extend_schema(
        request=None,
        responses={
            200: OrderSerializer,
            409: OpenApiResponse(
                response=inline_serializer(
                    "CancellationConflict", {"detail": serializers.CharField()}
                ),
                description="Produkcja tego zamówienia już się rozpoczęła.",
            ),
        },
    )
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        if request.user.role != request.user.Role.CUSTOMER:
            raise PermissionDenied("Zamówienie może anulować klient, który je złożył.")
        order = cancel_order(order_id=self.get_object().pk, customer=request.user)
        return Response(self.get_serializer(order).data)

    @extend_schema(
        responses=inline_serializer(
            "OrderSummary",
            {"orders": serializers.IntegerField(), "portions": serializers.IntegerField()},
        )
    )
    @action(detail=False, methods=["get"], url_path="summary", pagination_class=None)
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        return Response(
            queryset.aggregate(
                orders=Count("id", distinct=True), portions=Sum("items__quantity", default=0)
            )
        )
