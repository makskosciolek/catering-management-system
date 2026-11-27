from cateringhub_core.messaging import (
    ORDER_CANCELLED,
    ORDER_PREPARATION_STARTED,
    ORDER_READY_FOR_FULFILLMENT,
    InvalidEvent,
)
from django.db import transaction
from rest_framework import serializers

from .models import FulfillmentOrder, ProcessedEvent
from .serializers import ProductionItemSerializer

Status = FulfillmentOrder.Status
EVENT_STATUS = {
    ORDER_READY_FOR_FULFILLMENT: Status.READY,
    ORDER_PREPARATION_STARTED: Status.PREPARING,
    ORDER_CANCELLED: Status.CANCELLED,
}


class DeliveryDatePayload(serializers.Serializer):
    delivery_date = serializers.DateField()


class ReadyOrderPayload(DeliveryDatePayload):
    items = ProductionItemSerializer(many=True, allow_empty=False, max_length=50)

    def validate_items(self, value):
        if len({item["meal_id"] for item in value}) != len(value):
            raise serializers.ValidationError("Powtórzone danie.")
        return value


@transaction.atomic
def apply_fulfillment_event(event):
    status = EVENT_STATUS.get(event.type)
    if status is None:
        raise InvalidEvent("Realizacja nie obsługuje tego typu zdarzenia.")
    payload_type = DeliveryDatePayload if status == Status.CANCELLED else ReadyOrderPayload
    payload = payload_type(data=event.payload)
    if not payload.is_valid():
        raise InvalidEvent("Nieprawidłowe dane zamówienia dla Realizacji.")
    if not ProcessedEvent.objects.get_or_create(pk=event.id)[1]:
        return

    order, created = FulfillmentOrder.objects.select_for_update().get_or_create(
        pk=event.order_id,
        defaults={
            "delivery_date": payload.validated_data["delivery_date"],
            "items": payload.data.get("items", []),
            "status": status,
        },
    )
    if created or status == order.status:
        return
    if status == Status.CANCELLED or (status == Status.PREPARING and order.status == Status.READY):
        order.status = status
        order.save(update_fields=["status"])
