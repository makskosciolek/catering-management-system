from decimal import Decimal
from uuid import uuid4

from cateringhub_core.messaging import ORDER_SUBMITTED
from django.db import IntegrityError, transaction
from rest_framework.exceptions import APIException, ValidationError

from .models import Meal, Order, OrderItem, OutboxEvent


class OrderConflict(APIException):
    status_code = 409
    default_detail = (
        "Zamówienie o tym identyfikatorze zostało już zapisane z innymi danymi. "
        "Sprawdź listę swoich zamówień."
    )


def repeated_order(order, customer, items, delivery):
    """Zwraca zapisane zamówienie, jeśli ponowne żądanie ma te same dane."""
    same_order = (
        order.customer_id == customer.id
        and all(getattr(order, field) == value for field, value in delivery.items())
        and dict(order.items.values_list("meal_id", "quantity"))
        == {item["meal_id"]: item["quantity"] for item in items}
    )
    if not same_order:
        raise OrderConflict()
    return order


@transaction.atomic
def create_order(*, customer, items, id=None, **delivery):
    """Zapisuje zamówienie, pozycje i zdarzenie w jednej transakcji.

    Klient przekazuje identyfikator próby złożenia zamówienia (``id``). Jeżeli
    pierwsze żądanie zostało zapisane, ale odpowiedź nie dotarła do
    przeglądarki, ponowienie z tym samym identyfikatorem i tymi samymi danymi
    zwraca istniejące zamówienie zamiast tworzyć drugie. Zwraca parę
    ``(zamówienie, czy_utworzono)``.
    """
    delivery = {"note": "", **delivery}
    if id is not None:
        existing = Order.objects.filter(pk=id).first()
        if existing is not None:
            return repeated_order(existing, customer, items, delivery), False
    meals = {
        meal.id: meal
        for meal in Meal.objects.select_for_update()
        .filter(
            id__in=[item["meal_id"] for item in items],
            is_active=True,
        )
        .order_by("id")
    }
    if len(meals) != len(items):
        raise ValidationError({"items": "Wybrane danie jest niedostępne. Odśwież menu."})
    total = sum(
        (meals[item["meal_id"]].price * item["quantity"] for item in items), Decimal("0.00")
    )
    try:
        with transaction.atomic():
            order = Order.objects.create(
                id=id or uuid4(), customer=customer, total=total, **delivery
            )
    except IntegrityError:
        if id is None:
            raise
        # Równoległe żądanie z tym samym identyfikatorem zapisało zamówienie pierwsze.
        existing = Order.objects.get(pk=id)
        return repeated_order(existing, customer, items, delivery), False
    OrderItem.objects.bulk_create(
        [
            OrderItem(
                order=order,
                meal=meals[item["meal_id"]],
                meal_name=meals[item["meal_id"]].name,
                unit_price=meals[item["meal_id"]].price,
                quantity=item["quantity"],
            )
            for item in items
        ]
    )
    OutboxEvent.objects.create(
        event_type=ORDER_SUBMITTED,
        order=order,
        payload={
            "delivery_date": order.delivery_date.isoformat(),
            "items": [
                {"meal_id": str(item["meal_id"]), "quantity": item["quantity"]} for item in items
            ],
        },
    )
    return order, True
