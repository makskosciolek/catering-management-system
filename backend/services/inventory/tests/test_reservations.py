from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

import pytest
from cateringhub_core.messaging import ORDER_SUBMITTED, STOCK_RESERVED, STOCK_SHORTAGE, Event
from cateringhub_inventory.stock.events import apply_order_submitted
from cateringhub_inventory.stock.models import Ingredient, OutboxEvent, ProcessedEvent, Reservation
from cateringhub_inventory.stock.services import save_recipe
from conftest import BASE, authenticated_client, receipt_payload
from django.db import OperationalError, connection


def ingredient(name, on_hand):
    return Ingredient.objects.create(name=name, unit="kg", on_hand=Decimal(on_hand))


def recipe(*lines):
    meal_id = uuid4()
    save_recipe(
        meal_id,
        [{"ingredient_id": item.pk, "quantity": Decimal(quantity)} for item, quantity in lines],
    )
    return meal_id


def submitted(*items):
    return Event(
        uuid4(),
        ORDER_SUBMITTED,
        uuid4(),
        {
            "delivery_date": "2026-11-17",
            "items": [{"meal_id": str(meal), "quantity": portions} for meal, portions in items],
        },
    )


@pytest.mark.django_db
def test_repeated_order_reserves_the_sum_of_recipes_once():
    rice = ingredient("Ryż", "5")
    soup = recipe((rice, "0.300"))
    bowl = recipe((rice, "0.250"))
    event = submitted((soup, 2), (bowl, 3))
    event.payload["customer_id"] = str(uuid4())  # Present on older deliveries.
    apply_order_submitted(event)
    apply_order_submitted(event)
    apply_order_submitted(Event(uuid4(), event.type, event.order_id, event.payload))
    rice.refresh_from_db()
    reservation = Reservation.objects.get(pk=event.order_id)
    assert rice.on_hand == Decimal("5")
    assert rice.reserved == reservation.lines.get().quantity == Decimal("1.350")
    assert reservation.attempt == 1
    assert ProcessedEvent.objects.count() == 2
    assert OutboxEvent.objects.get().event_type == STOCK_RESERVED


@pytest.mark.django_db
def test_shortage_allocates_nothing_and_receipt_allows_retry():
    rice = ingredient("Ryż", "1")
    beans = ingredient("Fasola", "5")
    event = submitted((recipe((rice, "0.500"), (beans, "0.400")), 3))
    apply_order_submitted(event)
    warehouse, headers = authenticated_client("warehouse")
    path = f"{BASE}/reservations/{event.order_id}/"
    shortage = warehouse.get(path).json()
    assert shortage["status"] == "shortage"
    assert shortage["shortages"][0]["missing"] == "0.500"
    assert shortage["lines"] == []
    assert not Ingredient.objects.filter(reserved__gt=0).exists()
    assert OutboxEvent.objects.get().event_type == STOCK_SHORTAGE
    response = warehouse.post(
        f"{BASE}/receipts/", receipt_payload((rice.pk, "0.500")), format="json", **headers
    )
    assert response.status_code == 201
    for _ in range(2):
        retry = warehouse.post(path + "retry/", **headers)
        assert retry.status_code == 200
        assert retry.json()["status"] == "reserved"
        assert retry.json()["attempt"] == 2
    assert OutboxEvent.objects.filter(event_type=STOCK_RESERVED).count() == 1
    rice.refresh_from_db()
    assert rice.reserved == Decimal("1.500")
    assert rice.available == 0


@pytest.mark.django_db
def test_warehouse_can_add_recipe_for_missing_meal_and_manager_can_read_it():
    rice = ingredient("Ryż", "1")
    meal_id = uuid4()
    event = submitted((meal_id, 2))
    apply_order_submitted(event)
    warehouse, headers = authenticated_client("warehouse")
    manager, manager_headers = authenticated_client("manager")
    reservation_path = f"{BASE}/reservations/{event.order_id}/"
    recipe_path = f"{BASE}/recipes/{meal_id}/"
    data = {"lines": [{"ingredient_id": str(rice.pk), "quantity": "0.250"}]}

    assert warehouse.get(reservation_path).json()["missing_recipes"] == [str(meal_id)]
    assert manager.get(recipe_path).status_code == 404
    assert manager.put(recipe_path, data, format="json", **manager_headers).status_code == 403
    assert warehouse.put(recipe_path, data, format="json").status_code == 403
    assert warehouse.put(recipe_path, data, format="json", **headers).status_code == 200
    assert manager.get(recipe_path).json()["lines"][0]["ingredient_id"] == str(rice.pk)
    assert manager.post(reservation_path + "retry/", **manager_headers).status_code == 403
    assert warehouse.post(reservation_path + "retry/", **headers).json()["missing_recipes"] == []
    rice.refresh_from_db()
    assert rice.available == Decimal("0.500")


@pytest.mark.django_db
def test_outbox_failure_rolls_back_the_whole_reservation_and_allows_redelivery():
    rice = ingredient("Ryż", "1")
    event = submitted((recipe((rice, "0.500")), 1))

    with (
        patch.object(OutboxEvent.objects, "create", side_effect=OperationalError),
        pytest.raises(OperationalError),
    ):
        apply_order_submitted(event)

    rice.refresh_from_db()
    assert rice.reserved == 0
    assert not Reservation.objects.filter(pk=event.order_id).exists()
    assert not ProcessedEvent.objects.filter(pk=event.id).exists()
    apply_order_submitted(event)
    rice.refresh_from_db()
    assert rice.reserved == Decimal("0.500")
    assert OutboxEvent.objects.get().event_type == STOCK_RESERVED


@pytest.mark.django_db(transaction=True)
def test_concurrent_orders_do_not_overbook_one_ingredient():
    rice = ingredient("Ryż", "1")
    first = submitted((recipe((rice, "0.750")), 1))
    second = submitted((recipe((rice, "0.750")), 1))
    ready = Barrier(2, timeout=10)

    def allocate_order(event):
        try:
            ready.wait()
            apply_order_submitted(event)
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(allocate_order, (first, second)))

    assert Reservation.objects.filter(status=Reservation.Status.RESERVED).count() == 1
    assert Reservation.objects.filter(status=Reservation.Status.SHORTAGE).count() == 1
    rice.refresh_from_db()
    assert rice.available == Decimal("0.250")
