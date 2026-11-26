import json
from dataclasses import dataclass
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import UUID

from django.conf import settings
from rest_framework.exceptions import APIException, AuthenticationFailed

from .auth import StatelessCookieJWTAuthentication
from .config import JWT_COOKIE_NAME


class IdentityServiceUnavailable(APIException):
    status_code = 503
    default_detail = "Nie można teraz sprawdzić uprawnień w serwisie Zamówień."


@dataclass(frozen=True)
class SessionIdentity:
    pk: UUID
    role: str
    is_authenticated = True


def check_session(raw_token):
    request = Request(settings.ORDERS_API_URL + "/api/orders/v1/auth/session/")
    request.add_unredirected_header("Cookie", f"{JWT_COOKIE_NAME}={raw_token}")
    try:
        with urlopen(request, timeout=2) as response:
            data = json.load(response)
        if not isinstance(data["role"], str):
            raise ValueError("Nieprawidłowa rola w odpowiedzi.")
        return SessionIdentity(UUID(data["id"]), data["role"])
    except HTTPError as exc:
        if exc.code == 401:
            raise AuthenticationFailed("Sesja wygasła lub konto jest nieaktywne.") from exc
        raise IdentityServiceUnavailable() from exc
    except (OSError, ValueError, TypeError, KeyError) as exc:
        raise IdentityServiceUnavailable() from exc


class CurrentCookieJWTAuthentication(StatelessCookieJWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        current_user = check_session(request.COOKIES[JWT_COOKIE_NAME])
        if str(current_user.pk) != str(user.pk):
            raise AuthenticationFailed("Sesja nie należy do tego użytkownika.")
        return current_user, token
