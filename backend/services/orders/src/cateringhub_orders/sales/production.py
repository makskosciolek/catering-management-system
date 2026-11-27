from cateringhub_core.messaging import ORDER_PREPARATION_STARTED
from django.db import transaction
from django.shortcuts import get_object_or_404

from .models import Order, OutboxEvent
from .services import OrderConflict

STARTED_STATUSES = {Order.Status.PREPARING, Order.Status.PREPARED, Order.Status.PACKED}


def production_payload(order):
    return {
        "delivery_date": order.delivery_date.isoformat(),
        "items": [
            {"meal_id": str(item.meal_id), "meal_name": item.meal_name, "quantity": item.quantity}
            for item in order.items.all()
        ],
    }


@transaction.atomic
def start_production(order_id):
    order = get_object_or_404(Order.objects.select_for_update(), pk=order_id)
    if order.status in STARTED_STATUSES:
        return
    if order.status != Order.Status.STOCK_RESERVED:
        raise OrderConflict("Produkcję można rozpocząć po potwierdzeniu rezerwacji.")
    order.status = Order.Status.PREPARING
    order.save(update_fields=["status"])
    OutboxEvent.objects.create(
        order=order, event_type=ORDER_PREPARATION_STARTED, payload=production_payload(order)
    )
