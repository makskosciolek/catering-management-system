from cateringhub_core.messaging import ORDER_CANCELLED, ORDER_READY_FOR_FULFILLMENT, InvalidEvent
from django.db import transaction
from rest_framework import serializers

from .models import FulfillmentOrder, ProcessedEvent


class DeliveryDatePayload(serializers.Serializer):
    delivery_date = serializers.DateField()


class OrderItemPayload(serializers.Serializer):
    meal_id = serializers.UUIDField()
    meal_name = serializers.CharField(max_length=150)
    quantity = serializers.IntegerField(min_value=1, max_value=1000)


class ReadyOrderPayload(DeliveryDatePayload):
    items = OrderItemPayload(many=True, allow_empty=False, max_length=50)

    def validate_items(self, value):
        if len({item["meal_id"] for item in value}) != len(value):
            raise serializers.ValidationError("Powtórzone danie.")
        return value


@transaction.atomic
def apply_fulfillment_event(event):
    if event.type == ORDER_READY_FOR_FULFILLMENT:
        payload = ReadyOrderPayload(data=event.payload)
    elif event.type == ORDER_CANCELLED:
        payload = DeliveryDatePayload(data=event.payload)
    else:
        raise InvalidEvent("Realizacja nie obsługuje tego typu zdarzenia.")
    if not payload.is_valid():
        raise InvalidEvent("Nieprawidłowe dane zamówienia dla Realizacji.")
    if not ProcessedEvent.objects.get_or_create(pk=event.id)[1]:
        return

    order, _ = FulfillmentOrder.objects.select_for_update().get_or_create(
        pk=event.order_id,
        defaults={
            "delivery_date": payload.validated_data["delivery_date"],
            "items": payload.data.get("items", []),
        },
    )
    if event.type == ORDER_CANCELLED and order.status != FulfillmentOrder.Status.CANCELLED:
        order.status = FulfillmentOrder.Status.CANCELLED
        order.save(update_fields=["status"])
