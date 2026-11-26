from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    responses=inline_serializer(
        "FulfillmentHealth",
        {"status": serializers.CharField(), "service": serializers.CharField()},
    )
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return Response({"status": "ok", "service": "fulfillment"})


@extend_schema(
    responses=inline_serializer(
        "FulfillmentSession", {"id": serializers.UUIDField(), "role": serializers.CharField()}
    )
)
@api_view(["GET"])
def session(request):
    return Response({"id": str(request.user.pk), "role": request.user.role})
