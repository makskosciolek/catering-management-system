from cateringhub_core.messaging import ORDER_SUBMITTED, InvalidEvent
from django.db import transaction
from rest_framework import serializers

from .models import ProcessedEvent, Reservation
from .services import allocate


class RequestedItem(serializers.Serializer):
    meal_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, max_value=1000)


class OrderSubmittedPayload(serializers.Serializer):
    delivery_date = serializers.DateField()
    items = RequestedItem(many=True, allow_empty=False, max_length=50)

    def validate_items(self, value):
        if len({item["meal_id"] for item in value}) != len(value):
            raise serializers.ValidationError("Powtórzone danie.")
        return value


@transaction.atomic
def apply_order_submitted(event):
    if event.type != ORDER_SUBMITTED:
        raise InvalidEvent("Zasoby nie obsługują tego typu zdarzenia.")
    payload = OrderSubmittedPayload(data=event.payload)
    if not payload.is_valid():
        raise InvalidEvent("Nieprawidłowa data dostawy lub pozycje zamówienia.")
    _, received = ProcessedEvent.objects.get_or_create(pk=event.id)
    if not received:
        return
    reservation, created = Reservation.objects.get_or_create(
        pk=event.order_id,
        defaults={
            "delivery_date": payload.validated_data["delivery_date"],
            "requested_items": payload.data["items"],
        },
    )
    if created:
        allocate(reservation)
