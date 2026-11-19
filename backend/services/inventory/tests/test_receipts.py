from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from uuid import uuid4

import pytest
from cateringhub_inventory.stock.models import MAX_QUANTITY, Ingredient, Receipt
from conftest import BASE, authenticated_client, receipt_payload
from django.db import connection
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_is_public_and_other_endpoints_require_a_token():
    client = APIClient()
    assert client.get(f"{BASE}/health/").json() == {"status": "ok", "service": "inventory"}
    assert client.get(f"{BASE}/ingredients/").status_code == 401
    assert client.get(f"{BASE}/receipts/").status_code == 401


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("role", "read_status", "write_status"),
    [
        ("customer", 403, 403),
        ("manager", 200, 403),
        ("warehouse", 200, 201),
        ("admin", 200, 201),
    ],
)
def test_warehouse_permissions(role, read_status, write_status):
    client, headers = authenticated_client(role)
    ingredient = Ingredient.objects.create(name="Kasza", unit=Ingredient.Unit.KG)
    assert client.get(f"{BASE}/ingredients/").status_code == read_status
    assert client.get(f"{BASE}/receipts/").status_code == read_status
    ingredient_data = {"name": "Olej", "unit": "l"}
    assert client.post(f"{BASE}/ingredients/", ingredient_data, format="json").status_code == 403
    assert (
        client.post(f"{BASE}/ingredients/", ingredient_data, format="json", **headers).status_code
        == write_status
    )
    assert (
        client.post(
            f"{BASE}/receipts/", receipt_payload((ingredient.pk, "1.000")), format="json", **headers
        ).status_code
        == write_status
    )


@pytest.mark.django_db
def test_receipt_credits_stock_and_replay_requires_the_same_data_and_actor():
    actor_id = uuid4()
    client, headers = authenticated_client("warehouse", actor_id)
    first = client.post(
        f"{BASE}/ingredients/",
        {"name": "Ryż", "unit": "kg", "minimum": "2.000"},
        format="json",
        **headers,
    )
    assert first.status_code == 201
    assert first.json()["below_minimum"] is True
    second = Ingredient.objects.create(name="Olej", unit=Ingredient.Unit.LITRE)
    data = receipt_payload((first.json()["id"], "2.000"), (second.pk, "3.250"))

    response = client.post(f"{BASE}/receipts/", data, format="json", **headers)
    assert response.status_code == 201
    assert Receipt.objects.get(pk=data["id"]).received_by == actor_id

    data["lines"].reverse()
    replay = client.post(f"{BASE}/receipts/", data, format="json", **headers)
    assert replay.status_code == 200
    assert replay.json() == response.json()
    other_client, other_headers = authenticated_client("warehouse")
    assert (
        other_client.post(f"{BASE}/receipts/", data, format="json", **other_headers).status_code
        == 409
    )
    assert (
        client.post(
            f"{BASE}/receipts/", {**data, "supplier": "Inny dostawca"}, format="json", **headers
        ).status_code
        == 409
    )
    assert client.get(f"{BASE}/receipts/").json()["results"] == [response.json()]
    stock = {item["name"]: item for item in client.get(f"{BASE}/ingredients/").json()}
    assert stock["Ryż"]["on_hand"] == stock["Ryż"]["available"] == "2.000"
    assert stock["Ryż"]["below_minimum"] is False
    assert stock["Olej"]["available"] == "3.250"


@pytest.mark.django_db
@pytest.mark.parametrize("invalid_line", ["unknown", "overflow", "duplicate", "zero"])
def test_invalid_receipt_leaves_inventory_unchanged(invalid_line):
    client, headers = authenticated_client("warehouse")
    first = Ingredient.objects.create(name="Ryż", unit=Ingredient.Unit.KG)
    second = Ingredient.objects.create(
        name="Olej", unit=Ingredient.Unit.LITRE, on_hand=MAX_QUANTITY
    )
    lines = {
        "unknown": (uuid4(), "1"),
        "overflow": (second.pk, "0.001"),
        "duplicate": (first.pk, "1"),
        "zero": (second.pk, "0"),
    }
    data = receipt_payload((first.pk, "2"), lines[invalid_line])

    assert client.post(f"{BASE}/receipts/", data, format="json", **headers).status_code == 400
    assert not Receipt.objects.filter(pk=data["id"]).exists()
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.on_hand == 0
    assert second.on_hand == MAX_QUANTITY


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_receipt", [True, False])
def test_concurrent_receipts_credit_each_delivery_once(same_receipt):
    rice = Ingredient.objects.create(name="Ryż", unit=Ingredient.Unit.KG)
    oil = Ingredient.objects.create(name="Olej", unit=Ingredient.Unit.LITRE)
    first = receipt_payload((rice.pk, "2.000"), (oil.pk, "5.000"))
    second = first if same_receipt else receipt_payload((oil.pk, "7.000"), (rice.pk, "3.000"))
    actor_id = uuid4()
    ready = Barrier(2, timeout=10)

    def submit(data):
        try:
            client, headers = authenticated_client("warehouse", actor_id)
            ready.wait()
            return client.post(f"{BASE}/receipts/", data, format="json", **headers).status_code
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = sorted(executor.map(submit, (first, second)))

    rice.refresh_from_db()
    oil.refresh_from_db()
    if same_receipt:
        assert statuses == [200, 201]
        assert Receipt.objects.count() == 1
        assert rice.on_hand == Decimal("2.000")
        assert oil.on_hand == Decimal("5.000")
    else:
        assert statuses == [201, 201]
        assert Receipt.objects.count() == 2
        assert rice.on_hand == Decimal("5.000")
        assert oil.on_hand == Decimal("12.000")
