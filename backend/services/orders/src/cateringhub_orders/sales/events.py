from cateringhub_core.messaging import (
    ORDER_PACKED,
    ORDER_PREPARED,
    ORDER_READY_FOR_FULFILLMENT,
    STOCK_RESERVED,
    STOCK_SHORTAGE,
    InvalidEvent,
)
from django.db import transaction

from .models import Order, OutboxEvent, ProcessedEvent
from .production import production_payload

STOCK_STATUS = {
    STOCK_RESERVED: Order.Status.STOCK_RESERVED,
    STOCK_SHORTAGE: Order.Status.STOCK_SHORTAGE,
}
PRODUCTION_PROGRESS = {
    ORDER_PREPARED: (Order.Status.PREPARED, (Order.Status.PREPARING,)),
    ORDER_PACKED: (Order.Status.PACKED, (Order.Status.PREPARING, Order.Status.PREPARED)),
}


@transaction.atomic
def apply_stock_result(event):
    status = STOCK_STATUS.get(event.type)
    attempt = event.payload.get("attempt")
    if status is None or type(attempt) is not int or not 1 <= attempt <= 2_147_483_647:
        raise InvalidEvent("Nieprawidłowy wynik rezerwacji.")
    if not ProcessedEvent.objects.get_or_create(pk=event.id)[1]:
        return
    order = (
        Order.objects.select_for_update()
        .filter(
            pk=event.order_id,
            stock_attempt__lt=attempt,
            status__in=(Order.Status.SUBMITTED, Order.Status.STOCK_SHORTAGE),
        )
        .first()
    )
    if order is None:
        return
    order.status = status
    order.stock_attempt = attempt
    order.save(update_fields=["status", "stock_attempt"])
    if status == Order.Status.STOCK_RESERVED:
        OutboxEvent.objects.create(
            order=order,
            event_type=ORDER_READY_FOR_FULFILLMENT,
            payload=production_payload(order),
        )


@transaction.atomic
def apply_production_result(event):
    status, allowed_before = PRODUCTION_PROGRESS[event.type]
    if ProcessedEvent.objects.get_or_create(pk=event.id)[1]:
        Order.objects.filter(pk=event.order_id, status__in=allowed_before).update(status=status)


def apply_order_event(event):
    if event.type in STOCK_STATUS:
        apply_stock_result(event)
    elif event.type in PRODUCTION_PROGRESS:
        apply_production_result(event)
    else:
        raise InvalidEvent("Zamówienia nie obsługują tego typu zdarzenia.")
