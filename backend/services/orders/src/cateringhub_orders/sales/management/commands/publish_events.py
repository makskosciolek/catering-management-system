from cateringhub_core.messaging import ORDERS_QUEUE
from cateringhub_core.worker import EventWorkerCommand

from ...events import apply_order_event
from ...models import OutboxEvent


class Command(EventWorkerCommand):
    help = "Publikuje zdarzenia zamówień i odbiera wyniki rezerwacji oraz produkcji."
    outbox_model = OutboxEvent
    queue = ORDERS_QUEUE

    def apply_event(self, event):
        apply_order_event(event)
