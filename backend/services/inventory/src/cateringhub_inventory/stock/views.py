from django.db import connection, transaction
from django.db.models import Prefetch
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import generics, mixins, serializers, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import (
    Ingredient,
    Receipt,
    ReceiptLine,
    Recipe,
    RecipeLine,
    Reservation,
    ReservationLine,
)
from .serializers import (
    IngredientLinesInput,
    IngredientSerializer,
    ReceiptInput,
    ReceiptSerializer,
    RecipeSerializer,
    ReservationSerializer,
)
from .services import record_receipt, retry_reservation, save_recipe

CSRF_HEADER = OpenApiParameter(
    name="X-CSRFToken",
    location=OpenApiParameter.HEADER,
    required=True,
    description="Token z odpowiedzi GET /api/orders/v1/auth/csrf/.",
)


@extend_schema(
    responses=inline_serializer(
        "Health", {"status": serializers.CharField(), "service": serializers.CharField()}
    )
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return Response({"status": "ok", "service": "inventory"})


@extend_schema_view(create=extend_schema(parameters=[CSRF_HEADER]))
class IngredientViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Ingredient.objects.all()
    serializer_class = IngredientSerializer
    pagination_class = None


class ReceiptViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Receipt.objects.prefetch_related(
        Prefetch("lines", queryset=ReceiptLine.objects.select_related("ingredient"))
    )
    serializer_class = ReceiptSerializer

    @extend_schema(
        parameters=[CSRF_HEADER],
        request=ReceiptInput,
        responses={
            200: ReceiptSerializer,
            201: ReceiptSerializer,
            400: OpenApiResponse(description="Nieprawidłowe dane przyjęcia."),
            409: OpenApiResponse(description="Identyfikator przyjęcia użyty z innymi danymi."),
        },
    )
    def create(self, request):
        form = ReceiptInput(data=request.data)
        form.is_valid(raise_exception=True)
        receipt, created = record_receipt(**form.validated_data, received_by=request.user.pk)
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        receipt = self.get_queryset().get(pk=receipt.pk)
        return Response(self.get_serializer(receipt).data, status=response_status)


class RecipeView(generics.RetrieveAPIView):
    queryset = Recipe.objects.prefetch_related(
        Prefetch("lines", queryset=RecipeLine.objects.select_related("ingredient"))
    )
    serializer_class = RecipeSerializer
    lookup_field = "meal_id"

    @extend_schema(
        parameters=[CSRF_HEADER], request=IngredientLinesInput, responses=RecipeSerializer
    )
    @transaction.atomic
    def put(self, request, meal_id):
        form = IngredientLinesInput(data=request.data)
        form.is_valid(raise_exception=True)
        recipe = save_recipe(meal_id, form.validated_data["lines"])
        return Response(self.get_serializer(self.get_queryset().get(pk=recipe.pk)).data)


class ReservationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Reservation.objects.prefetch_related(
        Prefetch("lines", queryset=ReservationLine.objects.select_related("ingredient"))
    )
    serializer_class = ReservationSerializer
    lookup_field = "order_id"
    lookup_value_converter = "uuid"

    @extend_schema(parameters=[CSRF_HEADER], request=None, responses=ReservationSerializer)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def retry(self, request, order_id):
        try:
            reservation = retry_reservation(order_id)
        except Reservation.DoesNotExist as exc:
            raise NotFound() from exc
        return Response(self.get_serializer(self.get_queryset().get(pk=reservation.pk)).data)
