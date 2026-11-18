from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import SAFE_METHODS
from rest_framework_simplejwt.authentication import (
    JWTAuthentication,
    JWTStatelessUserAuthentication,
)

from .config import JWT_COOKIE_NAME


def enforce_csrf(request):
    SessionAuthentication().enforce_csrf(request)


class CookieJWT:
    def authenticate(self, request):
        raw_token = request.COOKIES.get(JWT_COOKIE_NAME)
        if not raw_token:
            return None
        token = self.get_validated_token(raw_token)
        user = self.get_user(token)
        if request.method not in SAFE_METHODS:
            enforce_csrf(request)
        return user, token


class CookieJWTAuthentication(CookieJWT, JWTAuthentication):
    pass


class StatelessCookieJWTAuthentication(CookieJWT, JWTStatelessUserAuthentication):
    pass


class CookieJWTSchema(OpenApiAuthenticationExtension):
    target_class = CookieJWT
    match_subclasses = True
    name = "cookieAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": JWT_COOKIE_NAME}
