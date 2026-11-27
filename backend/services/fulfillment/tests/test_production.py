from datetime import date, timedelta
from uuid import UUID, uuid4

import pytest
from cateringhub_core.config import JWT_COOKIE_NAME
from cateringhub_core.messaging import ORDER_PACKED, ORDER_PREPARED
from cateringhub_core.session import SessionIdentity
from cateringhub_fulfillment.operations.models import FulfillmentOrder, OutboxEvent
from django.conf import settings
from django.http import HttpRequest
from django.middleware.csrf import get_token
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

BASE = "/api/fulfillment/v1/production/"
DAY = date(2026, 12, 1)
Status = FulfillmentOrder.Status


@pytest.fixture
def sign_in(monkeypatch):
    def lookup(raw_token):
        token = AccessToken(raw_token)
        return SessionIdentity(UUID(token["user_id"]), token["role"])

    monkeypatch.setattr("cateringhub_core.session.check_session", lookup)

    def login(role):
        token = AccessToken()
        token["user_id"] = str(uuid4())
        token["role"] = role
        request = HttpRequest()
        csrf_token = get_token(request)
        client = APIClient(enforce_csrf_checks=True)
        client.cookies[JWT_COOKIE_NAME] = str(token)
        client.cookies[settings.CSRF_COOKIE_NAME] = request.META["CSRF_COOKIE"]
        return client, {"HTTP_X_CSRFTOKEN": csrf_token}

    return login


@pytest.mark.django_db
def test_production_filters_by_date_and_counts_portions_across_pages(sign_in):
    item = {"meal_id": str(uuid4()), "meal_name": "Zupa", "quantity": 2}
    FulfillmentOrder.objects.bulk_create(
        [FulfillmentOrder(order_id=uuid4(), delivery_date=DAY, items=[item]) for _ in range(20)]
        + [
            FulfillmentOrder(
                order_id=uuid4(), delivery_date=DAY, items=[item], status=Status.PACKED
            ),
            FulfillmentOrder(
                order_id=uuid4(), delivery_date=DAY, items=[item], status=Status.CANCELLED
            ),
            FulfillmentOrder(order_id=uuid4(), delivery_date=DAY + timedelta(days=1), items=[item]),
        ]
    )
    warehouse, _ = sign_in("warehouse")
    assert warehouse.get(BASE).status_code == 400
    assert warehouse.get(BASE + "summary/", {"delivery_date": "2026-02-30"}).status_code == 400
    result = warehouse.get(BASE, {"delivery_date": DAY}).json()
    assert result["count"] == 21
    assert len(result["results"]) == 20
    assert set(result["results"][0]) == {"order_id", "delivery_date", "status", "items"}
    assert warehouse.get(BASE + "summary/", {"delivery_date": DAY}).json() == [
        {**item, "quantity": 42}
    ]


@pytest.mark.django_db
def test_production_transitions_require_permissions_and_are_idempotent(sign_in):
    order = FulfillmentOrder.objects.create(
        order_id=uuid4(), delivery_date=DAY, status=Status.PREPARING
    )
    prefix = f"{BASE}{order.pk}/"
    kitchen, csrf = sign_in("kitchen")
    warehouse, warehouse_csrf = sign_in("warehouse")
    driver, _ = sign_in("driver")
    assert driver.get(BASE, {"delivery_date": DAY}).status_code == 403
    assert warehouse.post(prefix + "prepare/", **warehouse_csrf).status_code == 403
    assert kitchen.post(prefix + "prepare/").status_code == 403
    assert kitchen.post(prefix + "pack/", **csrf).status_code == 409

    for action, status in (("prepare", "prepared"), ("pack", "packed"), ("prepare", "packed")):
        for _ in range(2):
            response = kitchen.post(f"{prefix}{action}/", **csrf)
            assert response.status_code == 200
            assert response.json()["status"] == status
    assert list(
        OutboxEvent.objects.order_by("created_at").values_list("event_type", flat=True)
    ) == [
        ORDER_PREPARED,
        ORDER_PACKED,
    ]


@pytest.mark.django_db
def test_orders_timeout_leaves_production_start_retryable(sign_in, monkeypatch):
    order = FulfillmentOrder.objects.create(order_id=uuid4(), delivery_date=DAY)
    kitchen, csrf = sign_in("kitchen")

    def timeout(*args, **kwargs):
        raise TimeoutError

    monkeypatch.setattr("cateringhub_fulfillment.operations.production.urlopen", timeout)
    assert kitchen.post(f"{BASE}{order.pk}/start/", **csrf).status_code == 503
    order.refresh_from_db()
    assert order.status == Status.READY
    assert not OutboxEvent.objects.exists()
