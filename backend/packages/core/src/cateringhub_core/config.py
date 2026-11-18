import os
from datetime import timedelta

JWT_COOKIE_NAME = "cateringhub_access"
JWT_COOKIE_PATH = "/api"


def jwt_settings():
    return {
        "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
        "SIGNING_KEY": os.environ["JWT_SIGNING_KEY"],
        "ALGORITHM": "HS256",
        "ISSUER": "cateringhub-orders",
        "AUTH_HEADER_TYPES": ("Bearer",),
    }


def postgres_database(service):
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": service,
        "USER": f"catering_{service}",
        "PASSWORD": os.environ[f"{service.upper()}_DB_PASSWORD"],
        "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.environ.get("POSTGRES_PORT", "55432"),
    }
