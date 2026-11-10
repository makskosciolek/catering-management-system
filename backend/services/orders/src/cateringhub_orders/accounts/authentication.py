from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication


def enforce_csrf(request):
    SessionAuthentication().enforce_csrf(request)


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.JWT_COOKIE_NAME)
        if not raw_token:
            return None
        token = self.get_validated_token(raw_token)
        user = self.get_user(token)
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            enforce_csrf(request)
        return user, token


class CookieJWTSchema(OpenApiAuthenticationExtension):
    target_class = CookieJWTAuthentication
    name = "cookieAuth"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": settings.JWT_COOKIE_NAME}
