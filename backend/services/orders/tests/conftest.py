import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

BASE = "/api/orders/v1"
PASSWORD = "Course-demo-check-2026!"


@pytest.fixture(autouse=True)
def reset_throttles():
    cache.clear()


@pytest.fixture
def api():
    return APIClient(enforce_csrf_checks=True)


@pytest.fixture
def customer(db):
    return get_user_model().objects.create_user(
        "client@example.com", PASSWORD, first_name="Jan", last_name="Testowy"
    )


def csrf(client):
    return client.get(f"{BASE}/auth/csrf/").json()["csrfToken"]


def login(client, user):
    return client.post(
        f"{BASE}/auth/login/",
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_X_CSRFTOKEN=csrf(client),
    )
