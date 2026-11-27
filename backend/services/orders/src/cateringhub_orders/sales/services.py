from decimal import Decimal
from uuid import uuid4

from cateringhub_core.messaging import ORDER_CANCELLED, ORDER_SUBMITTED
from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework.exceptions import APIException, NotFound, ValidationError

from .models import Meal, Order, OrderItem, OutboxEvent
from .rules import earliest_delivery_date


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
        # A retry must see the previous attempt before checking the current cutoff.
        type(customer).objects.select_for_update(no_key=True).get(pk=customer.pk)
        existing = Order.objects.filter(pk=id).first()
        if existing is not None:
            return repeated_order(existing, customer, items, delivery), False
    earliest = earliest_delivery_date()
    if delivery["delivery_date"] < earliest:
        raise ValidationError(
            {
                "delivery_date": f"Najwcześniejszy możliwy termin dostawy to {earliest:%d.%m.%Y}. "
                "Zamówienia na następny dzień przyjmujemy "
                f"do godziny {settings.ORDER_CUTOFF_HOUR}:00."
            }
        )
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
        existing = Order.objects.filter(pk=id).first()
        if existing is None:
            raise
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


@transaction.atomic
def cancel_order(*, order_id, customer):
    order = Order.objects.select_for_update().filter(pk=order_id, customer=customer).first()
    if order is None:
        raise NotFound()
    if order.status == Order.Status.CANCELLED:
        return order
    if not order.can_cancel:
        if order.status not in Order.CANCELLABLE_STATUSES:
            raise OrderConflict("Produkcja ruszyła. Zamówienia nie można już anulować.")
        raise ValidationError({"delivery_date": "Minął termin anulowania tego zamówienia."})
    order.status = Order.Status.CANCELLED
    order.save(update_fields=["status"])
    OutboxEvent.objects.create(
        order=order,
        event_type=ORDER_CANCELLED,
        payload={"delivery_date": order.delivery_date.isoformat()},
    )
    return order
