from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

import pytest
from cateringhub_core.messaging import (
    ORDER_CANCELLED,
    ORDER_PACKED,
    ORDER_PREPARATION_STARTED,
    ORDER_PREPARED,
    ORDER_READY_FOR_FULFILLMENT,
    STOCK_RESERVED,
    Event,
)
from cateringhub_orders.sales.events import apply_order_event
from cateringhub_orders.sales.models import Meal, Order, OrderItem, OutboxEvent
from cateringhub_orders.sales.production import start_production
from cateringhub_orders.sales.services import OrderConflict, cancel_order
from conftest import PASSWORD, login
from django.contrib.auth import get_user_model
from django.db import OperationalError, connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken


@pytest.fixture
def meal(db):
    return Meal.objects.create(name="Zupa", price="17.50", category=Meal.Category.SOUP)


def stored_order(customer, meal, status=Order.Status.STOCK_RESERVED, *, delivery_date=None):
    order = Order.objects.create(
        customer=customer,
        delivery_date=delivery_date or timezone.localdate() + timedelta(days=2),
        delivery_address="Dane do dostawy",
        contact_phone="500600700",
        total="35.00",
        status=status,
    )
    OrderItem.objects.create(
        order=order, meal=meal, meal_name=meal.name, unit_price=meal.price, quantity=2
    )
    return order


@pytest.mark.django_db
def test_stock_confirmation_queues_the_order_snapshot_in_the_same_transaction(customer, meal):
    order = stored_order(customer, meal, Order.Status.SUBMITTED)
    Meal.objects.filter(pk=meal.pk).update(name="Nowa nazwa zupy")
    event = Event(uuid4(), STOCK_RESERVED, order.pk, {"attempt": 1})

    with (
        patch.object(OutboxEvent.objects, "create", side_effect=OperationalError),
        pytest.raises(OperationalError),
    ):
        apply_order_event(event)
    order.refresh_from_db()
    assert order.status == Order.Status.SUBMITTED

    apply_order_event(event)
    apply_order_event(event)
    apply_order_event(Event(uuid4(), STOCK_RESERVED, order.pk, {"attempt": 2}))
    ready = OutboxEvent.objects.get(order=order, event_type=ORDER_READY_FOR_FULFILLMENT)
    assert ready.payload == {
        "delivery_date": order.delivery_date.isoformat(),
        "items": [{"meal_id": str(meal.pk), "meal_name": "Zupa", "quantity": 2}],
    }


@pytest.mark.django_db
def test_start_requires_a_bearer_token_and_current_production_role(api, customer, meal):
    order = stored_order(customer, meal)
    path = f"/internal/fulfillment/orders/{order.pk}/start/"
    user = get_user_model().objects.create_user("kitchen@example.com", PASSWORD, role="kitchen")
    assert login(api, user).status_code == 200
    assert api.post(path).status_code == 401
    bearer = {"HTTP_AUTHORIZATION": f"Bearer {AccessToken.for_user(user)}"}
    for _ in range(2):
        assert api.post(path, **bearer).status_code == 204
    order.refresh_from_db()
    assert order.status == Order.Status.PREPARING
    assert (
        OutboxEvent.objects.filter(order=order, event_type=ORDER_PREPARATION_STARTED).count() == 1
    )

    user.role = "warehouse"
    user.save(update_fields=["role"])
    assert api.post(path, **bearer).status_code == 403


@pytest.mark.django_db
def test_late_production_and_stock_messages_do_not_undo_packing(customer, meal):
    order = stored_order(customer, meal)
    start_production(order.pk)
    apply_order_event(Event(uuid4(), ORDER_PACKED, order.pk, {}))
    apply_order_event(Event(uuid4(), ORDER_PREPARED, order.pk, {}))
    apply_order_event(Event(uuid4(), STOCK_RESERVED, order.pk, {"attempt": 2}))
    order.refresh_from_db()
    assert order.status == Order.Status.PACKED
    assert order.can_cancel is False


@pytest.mark.django_db(transaction=True)
def test_cancellation_and_production_start_cannot_both_win(customer, meal):
    order = stored_order(customer, meal)
    ready = Barrier(2, timeout=10)

    def compete(operation):
        try:
            ready.wait()
            operation()
            return True
        except OrderConflict:
            return False
        finally:
            connection.close()

    def start():
        start_production(order.pk)

    def cancel():
        cancel_order(order_id=order.pk, customer=customer)

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(compete, (start, cancel))) == [False, True]

    order.refresh_from_db()
    expected_event = {
        Order.Status.CANCELLED: ORDER_CANCELLED,
        Order.Status.PREPARING: ORDER_PREPARATION_STARTED,
    }[order.status]
    assert OutboxEvent.objects.get(order=order).event_type == expected_event


@pytest.mark.django_db(transaction=True)
def test_upgrade_preserves_the_production_queue_for_existing_reservations(customer, meal):
    before = ("sales", "0003_reservation_lifecycle_and_publication_retry")
    after = ("sales", "0004_production_statuses")
    MigrationExecutor(connection).migrate([before])
    try:
        today = timezone.localdate()
        current = stored_order(customer, meal, delivery_date=today)
        future = stored_order(customer, meal)
        stored_order(customer, meal, delivery_date=today - timedelta(days=1))
        stored_order(customer, meal, Order.Status.STOCK_SHORTAGE)
        stored_order(customer, meal, Order.Status.CANCELLED)
        MigrationExecutor(connection).migrate([after])

        queued = OutboxEvent.objects.filter(event_type=ORDER_READY_FOR_FULFILLMENT)
        assert set(queued.values_list("order_id", flat=True)) == {current.pk, future.pk}
        assert queued.get(order=current).payload["items"] == [
            {"meal_id": str(meal.pk), "meal_name": meal.name, "quantity": 2}
        ]
    finally:
        MigrationExecutor(connection).migrate([after])
