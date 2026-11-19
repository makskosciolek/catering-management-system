from decimal import Decimal

from rest_framework import serializers

from .models import QUANTITY_PRECISION, Ingredient, Receipt, Recipe, Reservation


class IngredientSerializer(serializers.ModelSerializer):
    minimum = serializers.DecimalField(
        min_value=Decimal(0), default=Decimal(0), **QUANTITY_PRECISION
    )
    available = serializers.DecimalField(read_only=True, **QUANTITY_PRECISION)
    below_minimum = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ingredient
        fields = (
            "id",
            "name",
            "unit",
            "minimum",
            "on_hand",
            "reserved",
            "available",
            "below_minimum",
        )
        read_only_fields = ("id", "on_hand", "reserved")


class QuantityLineInput(serializers.Serializer):
    ingredient_id = serializers.UUIDField()
    quantity = serializers.DecimalField(min_value=Decimal("0.001"), **QUANTITY_PRECISION)


class IngredientLinesInput(serializers.Serializer):
    lines = QuantityLineInput(many=True, allow_empty=False, max_length=50)

    def validate_lines(self, lines):
        if len({line["ingredient_id"] for line in lines}) != len(lines):
            raise serializers.ValidationError("Każdy składnik może wystąpić tylko raz.")
        return lines


class ReceiptInput(IngredientLinesInput):
    id = serializers.UUIDField()
    supplier = serializers.CharField(max_length=150)


class QuantityLineSerializer(serializers.Serializer):
    ingredient_id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(source="ingredient.name", read_only=True)
    unit = serializers.ChoiceField(
        choices=Ingredient.Unit.choices, source="ingredient.unit", read_only=True
    )
    quantity = serializers.DecimalField(read_only=True, **QUANTITY_PRECISION)


class ReceiptSerializer(serializers.ModelSerializer):
    lines = QuantityLineSerializer(many=True, read_only=True)

    class Meta:
        model = Receipt
        fields = ("id", "supplier", "received_at", "lines")
        read_only_fields = fields


class RecipeSerializer(serializers.ModelSerializer):
    lines = QuantityLineSerializer(many=True, read_only=True)

    class Meta:
        model = Recipe
        fields = ("meal_id", "lines")
        read_only_fields = fields


class ShortageSerializer(serializers.Serializer):
    ingredient_id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    unit = serializers.ChoiceField(choices=Ingredient.Unit.choices, read_only=True)
    needed = serializers.CharField(read_only=True)
    available = serializers.CharField(read_only=True)
    missing = serializers.CharField(read_only=True)


class ReservationSerializer(serializers.ModelSerializer):
    lines = QuantityLineSerializer(many=True, read_only=True)
    shortages = ShortageSerializer(many=True, read_only=True)
    missing_recipes = serializers.ListField(child=serializers.UUIDField(), read_only=True)

    class Meta:
        model = Reservation
        fields = (
            "order_id",
            "delivery_date",
            "status",
            "attempt",
            "updated_at",
            "lines",
            "shortages",
            "missing_recipes",
        )
        read_only_fields = fields
