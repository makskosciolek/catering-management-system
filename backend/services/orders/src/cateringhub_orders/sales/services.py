from decimal import Decimal

from cateringhub_core.messaging import ORDER_SUBMITTED
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Meal, Order, OrderItem, OutboxEvent


@transaction.atomic
def create_order(*, customer, items, **delivery):
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
    order = Order.objects.create(customer=customer, total=total, **delivery)
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
    return order
