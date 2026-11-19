from cateringhub_core.messaging import STOCK_RESERVED, STOCK_SHORTAGE, InvalidEvent
from django.db import transaction

from .models import Order, ProcessedEvent

STOCK_STATUS = {
    STOCK_RESERVED: Order.Status.STOCK_RESERVED,
    STOCK_SHORTAGE: Order.Status.STOCK_SHORTAGE,
}


@transaction.atomic
def apply_stock_result(event):
    status = STOCK_STATUS.get(event.type)
    attempt = event.payload.get("attempt")
    if status is None or type(attempt) is not int or not 1 <= attempt <= 2_147_483_647:
        raise InvalidEvent("Nieprawidłowy wynik rezerwacji.")
    _, created = ProcessedEvent.objects.get_or_create(pk=event.id)
    if created:
        Order.objects.filter(
            pk=event.order_id,
            stock_attempt__lt=attempt,
            status__in=(Order.Status.SUBMITTED, Order.Status.STOCK_SHORTAGE),
        ).update(status=status, stock_attempt=attempt)
