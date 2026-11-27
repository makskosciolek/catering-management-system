from rest_framework import serializers

from .models import FulfillmentOrder


class ProductionItemSerializer(serializers.Serializer):
    meal_id = serializers.UUIDField()
    meal_name = serializers.CharField(max_length=150)
    quantity = serializers.IntegerField(min_value=1, max_value=1000)


class ProductionOrderSerializer(serializers.ModelSerializer):
    items = ProductionItemSerializer(many=True, read_only=True)

    class Meta:
        model = FulfillmentOrder
        fields = ("order_id", "delivery_date", "status", "items")
        read_only_fields = fields


class ProductionPortionSerializer(serializers.Serializer):
    meal_id = serializers.UUIDField()
    meal_name = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)
