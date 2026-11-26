from uuid import uuid4

import pytest
from cateringhub_core.messaging import (
    ORDER_CANCELLED,
    ORDER_READY_FOR_FULFILLMENT,
    Event,
    InvalidEvent,
)
from cateringhub_fulfillment.operations.events import apply_fulfillment_event
from cateringhub_fulfillment.operations.models import FulfillmentOrder, ProcessedEvent

DELIVERY_DATE = "2026-12-01"


def ready_event(order_id, **extra):
    return Event(
        uuid4(),
        ORDER_READY_FOR_FULFILLMENT,
        order_id,
        {
            "delivery_date": DELIVERY_DATE,
            "items": [{"meal_id": str(uuid4()), "meal_name": "Zupa", "quantity": 3, **extra}],
        },
    )


@pytest.mark.django_db
def test_ready_order_is_recorded_once_and_without_customer_data():
    event = ready_event(uuid4(), contact_phone="123456789")
    apply_fulfillment_event(event)
    apply_fulfillment_event(event)
    order = FulfillmentOrder.objects.get(pk=event.order_id)
    assert order.status == FulfillmentOrder.Status.READY
    assert order.items == [
        {key: value for key, value in event.payload["items"][0].items() if key != "contact_phone"}
    ]
    assert ProcessedEvent.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize("cancel_first", [False, True])
def test_late_ready_event_cannot_reopen_cancelled_order(cancel_first):
    order_id = uuid4()
    ready = ready_event(order_id)
    cancel = Event(uuid4(), ORDER_CANCELLED, order_id, {"delivery_date": DELIVERY_DATE})
    for event in (cancel, ready) if cancel_first else (ready, cancel):
        apply_fulfillment_event(event)
    assert FulfillmentOrder.objects.get(pk=order_id).status == FulfillmentOrder.Status.CANCELLED
    assert ProcessedEvent.objects.count() == 2


@pytest.mark.django_db
def test_invalid_payload_is_rejected_without_recording_it():
    event = ready_event(uuid4(), quantity=0)
    with pytest.raises(InvalidEvent):
        apply_fulfillment_event(event)
    assert not FulfillmentOrder.objects.exists()
    assert not ProcessedEvent.objects.exists()
