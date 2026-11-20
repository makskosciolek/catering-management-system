from decimal import Decimal
from uuid import uuid4

from django.db import models

QUANTITY_PRECISION = {"max_digits": 12, "decimal_places": 3}
MAX_QUANTITY = Decimal("999999999.999")


class Ingredient(models.Model):
    class Unit(models.TextChoices):
        KG = "kg", "kg"
        LITRE = "l", "l"
        PIECE = "pcs", "szt."

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    unit = models.CharField(max_length=3, choices=Unit.choices)
    minimum = models.DecimalField(default=0, **QUANTITY_PRECISION)
    on_hand = models.DecimalField(default=0, **QUANTITY_PRECISION)
    reserved = models.DecimalField(default=0, **QUANTITY_PRECISION)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(on_hand__gte=models.F("reserved"), reserved__gte=0),
                name="ingredient_balance_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(minimum__gte=0), name="ingredient_minimum_nonnegative"
            ),
        ]

    @property
    def available(self):
        return self.on_hand - self.reserved

    @property
    def below_minimum(self):
        return self.available < self.minimum


class Receipt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    supplier = models.CharField(max_length=150)
    received_at = models.DateTimeField(auto_now_add=True)
    received_by = models.UUIDField(editable=False)

    class Meta:
        ordering = ("-received_at", "-id")


class ReceiptLine(models.Model):
    receipt = models.ForeignKey(Receipt, related_name="lines", on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    quantity = models.DecimalField(**QUANTITY_PRECISION)

    class Meta:
        ordering = ("ingredient__name",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="receiptline_quantity_positive"
            ),
            models.UniqueConstraint(fields=("receipt", "ingredient"), name="receipt_ingredient"),
        ]


class Recipe(models.Model):
    meal_id = models.UUIDField(primary_key=True)


class RecipeLine(models.Model):
    recipe = models.ForeignKey(Recipe, related_name="lines", on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    quantity = models.DecimalField(**QUANTITY_PRECISION)

    class Meta:
        ordering = ("ingredient__name",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="recipeline_quantity_positive"
            ),
            models.UniqueConstraint(fields=("recipe", "ingredient"), name="recipe_ingredient"),
        ]


class Reservation(models.Model):
    class Status(models.TextChoices):
        RESERVED = "reserved", "Zarezerwowano"
        SHORTAGE = "shortage", "Brak"
        CANCELLED = "cancelled", "Anulowano"
        CONSUMED = "consumed", "Zużyto"

    order_id = models.UUIDField(primary_key=True)
    delivery_date = models.DateField()
    requested_items = models.JSONField()
    status = models.CharField(max_length=9, choices=Status.choices, default=Status.SHORTAGE)
    shortages = models.JSONField(default=list)
    missing_recipes = models.JSONField(default=list)
    attempt = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-order_id")


class ReservationLine(models.Model):
    reservation = models.ForeignKey(Reservation, related_name="lines", on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    quantity = models.DecimalField(**QUANTITY_PRECISION)

    class Meta:
        ordering = ("ingredient__name",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="reservationline_quantity_positive"
            ),
            models.UniqueConstraint(
                fields=("reservation", "ingredient"), name="reservation_ingredient"
            ),
        ]


class ProcessedEvent(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    received_at = models.DateTimeField(auto_now_add=True)


class OutboxEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    event_type = models.CharField(max_length=100)
    order_id = models.UUIDField()
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    next_publish_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("created_at",)
