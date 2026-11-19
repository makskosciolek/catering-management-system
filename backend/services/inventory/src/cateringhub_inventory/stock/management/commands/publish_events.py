from cateringhub_core.messaging import INVENTORY_QUEUE
from cateringhub_core.worker import EventWorkerCommand

from ...events import apply_order_submitted
from ...models import OutboxEvent


class Command(EventWorkerCommand):
    help = "Publikuje wyniki rezerwacji i opcjonalnie odbiera zamówienia."
    outbox_model = OutboxEvent
    queue = INVENTORY_QUEUE

    def apply_event(self, event):
        apply_order_submitted(event)
