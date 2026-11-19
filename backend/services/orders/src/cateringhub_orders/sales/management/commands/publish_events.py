from cateringhub_core.messaging import ORDERS_STOCK_QUEUE
from cateringhub_core.worker import EventWorkerCommand

from ...events import apply_stock_result
from ...models import OutboxEvent


class Command(EventWorkerCommand):
    help = "Publikuje zdarzenia zamówień i opcjonalnie odbiera wyniki rezerwacji."
    outbox_model = OutboxEvent
    queue = ORDERS_STOCK_QUEUE

    def apply_event(self, event):
        apply_stock_result(event)
