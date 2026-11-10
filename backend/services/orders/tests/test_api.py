import pytest
from conftest import BASE, PASSWORD, csrf, login
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db


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
