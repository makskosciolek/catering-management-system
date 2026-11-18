from uuid import UUID

from django.db import transaction
from rest_framework.exceptions import APIException, ValidationError

from .models import (
    MAX_QUANTITY,
    Ingredient,
    Receipt,
    ReceiptLine,
)


class ReceiptConflict(APIException):
    status_code = 409
    default_detail = "Ten numer przyjęcia już istnieje z innymi danymi. Sprawdź historię."


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
    # A fixed locking order lets concurrent deliveries update overlapping ingredients.
    ingredients = list(
        Ingredient.objects.select_for_update().filter(pk__in=quantities).order_by("pk")
    )
    if len(ingredients) != len(quantities):
        raise ValidationError({"lines": "Wybrany składnik jest niedostępny."})
    for ingredient in ingredients:
        ingredient.on_hand += quantities[ingredient.pk]
        if ingredient.on_hand > MAX_QUANTITY:
            raise ValidationError({"lines": f"Przekroczono maksymalny stan: {ingredient.name}."})
    Ingredient.objects.bulk_update(ingredients, ("on_hand",))
    ReceiptLine.objects.bulk_create([ReceiptLine(receipt=receipt, **line) for line in lines])
    return receipt, True
