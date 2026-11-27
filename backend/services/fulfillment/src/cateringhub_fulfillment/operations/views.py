from cateringhub_core.config import JWT_COOKIE_NAME
from django.db import connection
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import FulfillmentOrder
from .permissions import ProductionPermission
from .production import advance_production, production_totals, request_production_start
from .serializers import ProductionOrderSerializer, ProductionPortionSerializer

DELIVERY_DATE = OpenApiParameter("delivery_date", OpenApiTypes.DATE, required=True)
CSRF_HEADER = OpenApiParameter(
    name="X-CSRFToken",
    location=OpenApiParameter.HEADER,
    required=True,
    description="Token z odpowiedzi GET /api/orders/v1/auth/csrf/.",
)
PRODUCTION_ERROR = inline_serializer("ProductionError", {"detail": serializers.CharField()})
PRODUCTION_CONFLICT = OpenApiResponse(
    response=PRODUCTION_ERROR, description="Operacja nie pasuje do postępu zamówienia."
)


@extend_schema(
    responses=inline_serializer(
        "FulfillmentHealth",
        {"status": serializers.CharField(), "service": serializers.CharField()},
    )
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return Response({"status": "ok", "service": "fulfillment"})


@extend_schema(
    responses=inline_serializer(
        "FulfillmentSession", {"id": serializers.UUIDField(), "role": serializers.CharField()}
    )
)
@api_view(["GET"])
def session(request):
    return Response({"id": str(request.user.pk), "role": request.user.role})


@extend_schema_view(list=extend_schema(parameters=[DELIVERY_DATE]))
class ProductionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = FulfillmentOrder.objects.order_by("order_id")
    serializer_class = ProductionOrderSerializer
    permission_classes = [ProductionPermission]
    lookup_field = "order_id"
    lookup_value_converter = "uuid"

    def get_queryset(self):
        orders = super().get_queryset()
        if self.action in ("list", "summary") and not getattr(self, "swagger_fake_view", False):
            delivery_date = serializers.DateField().run_validation(
                self.request.query_params.get("delivery_date", serializers.empty)
            )
            return orders.filter(delivery_date=delivery_date).exclude(
                status=FulfillmentOrder.Status.CANCELLED
            )
        return orders

    @extend_schema(parameters=[DELIVERY_DATE], responses=ProductionPortionSerializer(many=True))
    @action(detail=False, pagination_class=None)
    def summary(self, request):
        portions = production_totals(self.get_queryset())
        return Response(ProductionPortionSerializer(portions, many=True).data)

    @extend_schema(
        parameters=[CSRF_HEADER],
        request=None,
        responses={
            202: inline_serializer(
                "ProductionStartAccepted",
                {"status": serializers.ChoiceField(choices=["accepted"])},
            ),
            409: PRODUCTION_CONFLICT,
            503: OpenApiResponse(
                response=PRODUCTION_ERROR, description="Brak odpowiedzi z Zamówień. Ponów operację."
            ),
        },
    )
    @action(detail=True, methods=["post"])
    def start(self, request, order_id=None):
        request_production_start(self.get_object(), request.COOKIES[JWT_COOKIE_NAME])
        return Response({"status": "accepted"}, status=status.HTTP_202_ACCEPTED)

    @extend_schema(
        parameters=[CSRF_HEADER],
        request=None,
        responses={200: ProductionOrderSerializer, 409: PRODUCTION_CONFLICT},
    )
    @action(detail=True, methods=["post"])
    def prepare(self, request, order_id=None):
        order = advance_production(order_id, FulfillmentOrder.Status.PREPARED)
        return Response(self.get_serializer(order).data)

    @extend_schema(
        parameters=[CSRF_HEADER],
        request=None,
        responses={200: ProductionOrderSerializer, 409: PRODUCTION_CONFLICT},
    )
    @action(detail=True, methods=["post"])
    def pack(self, request, order_id=None):
        order = advance_production(order_id, FulfillmentOrder.Status.PACKED)
        return Response(self.get_serializer(order).data)
