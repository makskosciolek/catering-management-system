from django.conf import settings
from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken

from .authentication import enforce_csrf
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


def csrf_failure(request, reason=""):
    return JsonResponse({"detail": "Odśwież stronę i ponów operację."}, status=403)


class CsrfResponseSerializer(serializers.Serializer):
    csrfToken = serializers.CharField()


class CsrfView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(responses=CsrfResponseSerializer)
    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=RegisterSerializer, responses={201: UserSerializer})
    def post(self, request):
        enforce_csrf(request)
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            return Response({"email": ["Konto z tym adresem już istnieje."]}, status=400)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginThrottle(AnonRateThrottle):
    scope = "login"


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    @extend_schema(request=LoginSerializer, responses=UserSerializer)
    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None:
            return Response({"detail": "Nieprawidłowy e-mail lub hasło."}, status=401)
        token = AccessToken.for_user(user)
        token["role"] = user.role
        response = Response(UserSerializer(user).data)
        response.set_cookie(
            settings.JWT_COOKIE_NAME,
            str(token),
            max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
            httponly=True,
            secure=settings.CSRF_COOKIE_SECURE,
            samesite="Lax",
            path=settings.JWT_COOKIE_PATH,
        )
        return response


class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        enforce_csrf(request)
        response = Response(status=204)
        response.delete_cookie(
            settings.JWT_COOKIE_NAME, path=settings.JWT_COOKIE_PATH, samesite="Lax"
        )
        return response


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user
