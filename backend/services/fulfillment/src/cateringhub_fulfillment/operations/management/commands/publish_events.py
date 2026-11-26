from cateringhub_core.messaging import FULFILLMENT_QUEUE
from cateringhub_core.worker import EventWorkerCommand

from ...events import apply_fulfillment_event
from ...models import OutboxEvent


class Command(EventWorkerCommand):
    help = "Publikuje zdarzenia Realizacji i opcjonalnie odbiera zdarzenia o zamówieniach."
    outbox_model = OutboxEvent
    queue = FULFILLMENT_QUEUE

    def apply_event(self, event):
        apply_fulfillment_event(event)
