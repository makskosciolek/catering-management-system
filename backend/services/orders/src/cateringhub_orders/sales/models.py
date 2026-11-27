import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from .rules import earliest_delivery_date


class Meal(models.Model):
    class Category(models.TextChoices):
        MAIN = "main", "Danie główne"
        SOUP = "soup", "Zupa"
        SALAD = "salad", "Sałatka"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField("nazwa", max_length=150)
    description = models.TextField("opis", blank=True)
    price = models.DecimalField(
        "cena", max_digits=8, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    category = models.CharField(max_length=12, choices=Category.choices)
    allergens = models.CharField("alergeny", max_length=200, blank=True)
    is_vegetarian = models.BooleanField("wegetariańskie", default=False)
    is_active = models.BooleanField("aktywne", default=True)

    class Meta:
        ordering = ("category", "name")
        constraints = [
            models.CheckConstraint(condition=models.Q(price__gt=0), name="meal_price_positive")
        ]

    def __str__(self):
        return self.name


class Order(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Oczekuje na magazyn"
        STOCK_RESERVED = "stock_reserved", "Składniki zarezerwowane"
        STOCK_SHORTAGE = "stock_shortage", "Brak składników lub receptury"
        PREPARING = "preparing", "W przygotowaniu"
        PREPARED = "prepared", "Przygotowane"
        PACKED = "packed", "Spakowane"
        CANCELLED = "cancelled", "Anulowane"

    CANCELLABLE_STATUSES = frozenset(
        {Status.SUBMITTED, Status.STOCK_RESERVED, Status.STOCK_SHORTAGE}
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    delivery_date = models.DateField("data dostawy")
    delivery_address = models.CharField("adres dostawy", max_length=300)
    contact_phone = models.CharField("telefon kontaktowy", max_length=30)
    note = models.CharField("uwagi", max_length=500, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.SUBMITTED)
    stock_attempt = models.PositiveIntegerField(default=0)
    total = models.DecimalField(max_digits=16, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("customer", "-created_at")),
            models.Index(fields=("delivery_date",)),
        ]

    @property
    def can_cancel(self):
        return (
            self.status in self.CANCELLABLE_STATUSES
            and self.delivery_date >= earliest_delivery_date()
        )


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    meal = models.ForeignKey(Meal, on_delete=models.PROTECT)
    meal_name = models.CharField(max_length=150)
    unit_price = models.DecimalField(max_digits=8, decimal_places=2)
    quantity = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("order", "meal"), name="unique_order_meal"),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="order_quantity_positive"
            ),
        ]


class OutboxEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=100)
    order = models.ForeignKey(Order, on_delete=models.PROTECT)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    next_publish_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("created_at",)


class ProcessedEvent(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    received_at = models.DateTimeField(auto_now_add=True)
