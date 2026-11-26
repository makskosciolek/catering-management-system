from uuid import UUID, uuid4

import pytest
from cateringhub_core.config import JWT_COOKIE_NAME
from cateringhub_core.session import SessionIdentity
from django.conf import settings
from django.http import HttpRequest
from django.middleware.csrf import get_token
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

BASE = "/api/inventory/v1"


@pytest.fixture(autouse=True)
def current_identity(monkeypatch):
    def lookup(raw_token):
        token = AccessToken(raw_token)
        return SessionIdentity(UUID(token["user_id"]), token["role"])

    monkeypatch.setattr("cateringhub_core.session.check_session", lookup)


def authenticated_client(role, user_id=None):
    token = AccessToken()
    token["user_id"] = str(user_id or uuid4())
    token["role"] = role
    request = HttpRequest()
    csrf_token = get_token(request)
    client = APIClient(enforce_csrf_checks=True)
    client.cookies[JWT_COOKIE_NAME] = str(token)
    client.cookies[settings.CSRF_COOKIE_NAME] = request.META["CSRF_COOKIE"]
    return client, {"HTTP_X_CSRFTOKEN": csrf_token}


def receipt_payload(*lines):
    return {
        "id": str(uuid4()),
        "supplier": "Dostawca testowy",
        "lines": [
            {"ingredient_id": str(ingredient_id), "quantity": quantity}
            for ingredient_id, quantity in lines
        ],
    }
