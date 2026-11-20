from rest_framework import serializers

from ..accounts.validators import PhoneField
from .models import Meal, Order, OrderItem
from .services import create_order


class MealSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meal
        fields = ("id", "name", "description", "price", "category", "allergens", "is_vegetarian")
        read_only_fields = fields


class OrderItemSerializer(serializers.ModelSerializer):
    meal_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ("meal_id", "meal_name", "unit_price", "quantity")
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.get_full_name", read_only=True)
    customer_email = serializers.EmailField(source="customer.email", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "customer_name",
            "customer_email",
            "delivery_date",
            "delivery_address",
            "contact_phone",
            "note",
            "status",
            "total",
            "created_at",
            "items",
        )
        read_only_fields = fields


class OrderLineInput(serializers.Serializer):
    meal_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, max_value=1000)


class CreateOrderSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(
        required=False,
        help_text="Identyfikator próby złożenia zamówienia nadany przez klienta. "
        "Ponowienie z tym samym identyfikatorem i danymi zwraca zapisane zamówienie.",
    )
    items = OrderLineInput(many=True, allow_empty=False, max_length=50)
    contact_phone = PhoneField(max_length=30, label="Telefon kontaktowy")

    class Meta:
        model = Order
        fields = ("id", "delivery_date", "delivery_address", "contact_phone", "note", "items")

    def validate_items(self, value):
        if len({item["meal_id"] for item in value}) != len(value):
            raise serializers.ValidationError("Każde danie może wystąpić tylko raz.")
        return value

    def create(self, validated_data):
        order, self.created = create_order(customer=self.context["request"].user, **validated_data)
        return order
