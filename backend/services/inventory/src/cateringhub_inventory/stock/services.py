from collections import defaultdict
from decimal import Decimal
from uuid import UUID

from cateringhub_core.messaging import STOCK_RESERVED, STOCK_SHORTAGE
from django.db import transaction
from rest_framework.exceptions import APIException, ValidationError

from .models import (
    MAX_QUANTITY,
    Ingredient,
    OutboxEvent,
    Receipt,
    ReceiptLine,
    Recipe,
    RecipeLine,
    Reservation,
    ReservationLine,
)


class ReceiptConflict(APIException):
    status_code = 409
    default_detail = "Ten numer przyjęcia już istnieje z innymi danymi. Sprawdź historię."


def lock_ingredients(ids):
    # Receipts and reservations acquire overlapping row locks in the same order.
    return list(Ingredient.objects.select_for_update().filter(pk__in=ids).order_by("pk"))


@transaction.atomic
def record_receipt(*, id, supplier, lines, received_by):
    received_by = UUID(str(received_by))
    quantities = {line["ingredient_id"]: line["quantity"] for line in lines}
    receipt, created = Receipt.objects.get_or_create(
        id=id, defaults={"supplier": supplier, "received_by": received_by}
    )
    if not created:
        same_receipt = (
            receipt.supplier == supplier
            and receipt.received_by == received_by
            and dict(receipt.lines.values_list("ingredient_id", "quantity")) == quantities
        )
        if not same_receipt:
            raise ReceiptConflict()
        return receipt, False
    ingredients = lock_ingredients(quantities)
    if len(ingredients) != len(quantities):
        raise ValidationError({"lines": "Wybrany składnik jest niedostępny."})
    for ingredient in ingredients:
        ingredient.on_hand += quantities[ingredient.pk]
        if ingredient.on_hand > MAX_QUANTITY:
            raise ValidationError({"lines": f"Przekroczono maksymalny stan: {ingredient.name}."})
    Ingredient.objects.bulk_update(ingredients, ("on_hand",))
    ReceiptLine.objects.bulk_create([ReceiptLine(receipt=receipt, **line) for line in lines])
    return receipt, True


@transaction.atomic
def save_recipe(meal_id, lines):
    ingredient_ids = [line["ingredient_id"] for line in lines]
    if Ingredient.objects.filter(pk__in=ingredient_ids).count() != len(lines):
        raise ValidationError({"lines": "Wybrany składnik jest niedostępny."})
    recipe, _ = Recipe.objects.select_for_update().get_or_create(meal_id=meal_id)
    recipe.lines.all().delete()
    RecipeLine.objects.bulk_create([RecipeLine(recipe=recipe, **line) for line in lines])
    return recipe


def allocate(reservation):
    # The caller owns the reservation row; recipe locks prevent a concurrent rewrite.
    recipes = {
        str(recipe.meal_id): list(recipe.lines.all())
        for recipe in Recipe.objects.select_for_update()
        .filter(meal_id__in=[item["meal_id"] for item in reservation.requested_items])
        .order_by("meal_id")
        .prefetch_related("lines")
    }
    demand = defaultdict(Decimal)
    missing_recipes = []
    for item in reservation.requested_items:
        lines = recipes.get(item["meal_id"])
        if not lines:
            missing_recipes.append(item["meal_id"])
            continue
        for line in lines:
            demand[line.ingredient_id] += line.quantity * item["quantity"]

    ingredients = lock_ingredients(demand)
    shortages = [
        {
            "ingredient_id": str(ingredient.pk),
            "name": ingredient.name,
            "unit": ingredient.unit,
            "needed": str(demand[ingredient.pk]),
            "available": str(ingredient.available),
            "missing": str(demand[ingredient.pk] - ingredient.available),
        }
        for ingredient in sorted(ingredients, key=lambda item: item.name)
        if demand[ingredient.pk] > ingredient.available
    ]
    reservation.attempt += 1
    reservation.shortages = shortages
    reservation.missing_recipes = missing_recipes
    payload = {"attempt": reservation.attempt}
    if shortages or missing_recipes:
        reservation.status = Reservation.Status.SHORTAGE
        event_type = STOCK_SHORTAGE
    else:
        for ingredient in ingredients:
            ingredient.reserved += demand[ingredient.pk]
        Ingredient.objects.bulk_update(ingredients, ("reserved",))
        ReservationLine.objects.bulk_create(
            [
                ReservationLine(reservation=reservation, ingredient_id=key, quantity=quantity)
                for key, quantity in demand.items()
            ]
        )
        reservation.status = Reservation.Status.RESERVED
        event_type = STOCK_RESERVED
        payload.update(
            delivery_date=reservation.delivery_date.isoformat(), items=reservation.requested_items
        )
    reservation.save(
        update_fields=("attempt", "shortages", "missing_recipes", "status", "updated_at")
    )
    OutboxEvent.objects.create(
        order_id=reservation.order_id, event_type=event_type, payload=payload
    )


@transaction.atomic
def retry_reservation(order_id):
    reservation = Reservation.objects.select_for_update().get(pk=order_id)
    if reservation.status == Reservation.Status.SHORTAGE:
        allocate(reservation)
    return reservation
