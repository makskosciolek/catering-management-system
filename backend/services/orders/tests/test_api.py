from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock
from uuid import uuid4

import pika
import pytest
from cateringhub_core.messaging import STOCK_RESERVED, STOCK_SHORTAGE, Event, publish_one
from cateringhub_orders.sales.events import apply_stock_result
from cateringhub_orders.sales.models import Meal, Order, OutboxEvent, ProcessedEvent
from cateringhub_orders.sales.rules import earliest_delivery_date
from conftest import BASE, PASSWORD, csrf, login
from django.contrib.auth import get_user_model
from django.utils import timezone

pytestmark = pytest.mark.django_db


@pytest.fixture
def meal():
    return Meal.objects.create(name="Zupa", price="17.50", category=Meal.Category.SOUP)


def order_data(meal):
    return {
        # Pojutrze jest dozwolone niezależnie od godziny uruchomienia testów.
        "delivery_date": (timezone.localdate() + timedelta(days=2)).isoformat(),
        "delivery_address": "Przykładowa 1, Kraków",
        "contact_phone": "000 000 000",
        "items": [{"meal_id": str(meal.id), "quantity": 2}],
    }


def submit(client, data):
    return client.post(f"{BASE}/orders/", data, format="json", HTTP_X_CSRFTOKEN=csrf(client))


def test_registration_rejects_missing_csrf_and_ignores_role_escalation(api):
    payload = {
        "email": "NEW@example.com",
        "password": PASSWORD,
        "first_name": "Anna",
        "last_name": "Testowa",
        "role": "admin",
    }
    endpoint = f"{BASE}/auth/register/"
    assert api.post(endpoint, payload, format="json").status_code == 403
    response = api.post(endpoint, payload, format="json", HTTP_X_CSRFTOKEN=csrf(api))
    assert response.status_code == 201
    user = get_user_model().objects.get(email="new@example.com")
    assert user.role == "customer"
    assert user.password.startswith("argon2$")
    assert user.check_password(PASSWORD)
    duplicate = api.post(
        endpoint, {**payload, "email": "new@example.com"}, format="json", HTTP_X_CSRFTOKEN=csrf(api)
    )
    assert duplicate.status_code == 400


def test_login_cookie_and_logout(api, customer):
    response = login(api, customer)
    assert response.status_code == 200
    assert response.cookies["cateringhub_access"]["httponly"]
    assert "access" not in response.json()
    assert api.get(f"{BASE}/auth/me/").json()["email"] == customer.email
    assert api.post(f"{BASE}/auth/logout/").status_code == 403
    assert api.post(f"{BASE}/auth/logout/", HTTP_X_CSRFTOKEN=csrf(api)).status_code == 204
    assert api.get(f"{BASE}/auth/me/").status_code == 401


def test_order_uses_server_price_and_writes_outbox(api, customer, meal):
    login(api, customer)
    data = {**order_data(meal), "total": "0.01", "status": "delivered"}
    assert api.post(f"{BASE}/orders/", data, format="json").status_code == 403
    result = submit(api, data)
    assert result.status_code == 201
    order = Order.objects.get(pk=result.json()["id"])
    assert order.total == Decimal("35.00")
    assert order.status == "submitted"
    assert order.customer_id == customer.id
    event = OutboxEvent.objects.get(order=order)
    assert event.event_type == "order.submitted"
    assert event.payload == {
        "delivery_date": data["delivery_date"],
        "items": [{"meal_id": str(meal.id), "quantity": 2}],
    }
    assert event.published_at is None


@pytest.mark.parametrize("invalid", ["quantity", "date", "today", "phone", "inactive"])
def test_invalid_order_does_not_write_anything(api, customer, meal, invalid):
    login(api, customer)
    data = order_data(meal)
    if invalid == "quantity":
        data["items"][0]["quantity"] = 0
    elif invalid == "date":
        data["delivery_date"] = (timezone.localdate() - timedelta(days=1)).isoformat()
    elif invalid == "today":
        data["delivery_date"] = timezone.localdate().isoformat()
    elif invalid == "phone":
        data["contact_phone"] = "zadzwonić do recepcji"
    else:
        meal.is_active = False
        meal.save(update_fields=("is_active",))
    assert submit(api, data).status_code == 400
    assert not Order.objects.exists()
    assert not OutboxEvent.objects.exists()


def test_order_visibility_for_customer_and_manager(api, customer, meal):
    login(api, customer)
    order_id = submit(api, order_data(meal)).json()["id"]
    user_model = get_user_model()
    other = user_model.objects.create_user("other@example.com", PASSWORD)
    manager = user_model.objects.create_user("manager@example.com", PASSWORD, role="manager")
    login(api, other)
    assert api.get(f"{BASE}/orders/").json()["count"] == 0
    assert api.get(f"{BASE}/orders/{order_id}/").status_code == 404
    login(api, manager)
    assert api.get(f"{BASE}/orders/{order_id}/").status_code == 200
    assert api.get(f"{BASE}/orders/summary/").json() == {"orders": 1, "portions": 2}
    assert submit(api, order_data(meal)).status_code == 403


def test_publish_failure_preserves_pending_event(api, customer, meal):
    login(api, customer)
    assert submit(api, order_data(meal)).status_code == 201
    channel = Mock()
    channel.basic_publish.side_effect = pika.exceptions.UnroutableError([])
    with pytest.raises(pika.exceptions.UnroutableError):
        publish_one(channel, OutboxEvent)
    assert OutboxEvent.objects.get().published_at is None
    channel.basic_publish.side_effect = None
    assert publish_one(channel, OutboxEvent) is True
    assert OutboxEvent.objects.get().published_at is not None
    assert publish_one(channel, OutboxEvent) is False


def test_late_stock_result_does_not_overwrite_reservation(api, customer, meal):
    login(api, customer)
    order = Order.objects.get(pk=submit(api, order_data(meal)).json()["id"])
    shortage = Event(uuid4(), STOCK_SHORTAGE, order.id, {"attempt": 1})
    reserved = Event(uuid4(), STOCK_RESERVED, order.id, {"attempt": 2})
    apply_stock_result(reserved)
    apply_stock_result(shortage)
    apply_stock_result(reserved)
    order.refresh_from_db()
    assert order.status == Order.Status.STOCK_RESERVED
    assert order.stock_attempt == 2
    assert ProcessedEvent.objects.count() == 2


@pytest.mark.parametrize(("hour", "days"), [(0, 1), (17, 1), (18, 2), (23, 2)])
def test_earliest_delivery_date_depends_on_cutoff_hour(hour, days):
    now = timezone.make_aware(datetime(2026, 11, 19, hour, 59))
    assert earliest_delivery_date(now) == date(2026, 11, 19) + timedelta(days=days)


def test_next_day_order_rejected_after_cutoff(api, customer, meal, settings):
    settings.ORDER_CUTOFF_HOUR = 0
    login(api, customer)
    data = order_data(meal)
    data["delivery_date"] = (timezone.localdate() + timedelta(days=1)).isoformat()
    response = submit(api, data)
    assert response.status_code == 400
    assert "delivery_date" in response.json()
    assert not Order.objects.exists()
    data["delivery_date"] = (timezone.localdate() + timedelta(days=2)).isoformat()
    assert submit(api, data).status_code == 201


def test_phone_is_validated_and_normalized(api, customer):
    login(api, customer)
    profile = f"{BASE}/auth/me/"
    for phone in ("123", "600 700 800 wew. 12", "+48 600 700 800 900 100 1"):
        response = api.patch(profile, {"phone": phone}, format="json", HTTP_X_CSRFTOKEN=csrf(api))
        assert response.status_code == 400
        assert "phone" in response.json()
    response = api.patch(
        profile, {"phone": " +48  600-700-800 "}, format="json", HTTP_X_CSRFTOKEN=csrf(api)
    )
    assert response.status_code == 200
    assert response.json()["phone"] == "+48 600-700-800"
    response = api.patch(profile, {"phone": ""}, format="json", HTTP_X_CSRFTOKEN=csrf(api))
    assert response.status_code == 200
