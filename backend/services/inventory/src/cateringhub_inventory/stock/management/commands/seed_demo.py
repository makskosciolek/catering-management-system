from decimal import Decimal

from cateringhub_core.demo import demo_id
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from ...models import Ingredient, Receipt, Recipe
from ...services import record_receipt, save_recipe

STOCK = (
    ("kurczak", "Mięso z kurczaka", "kg", "3.0", "24"),
    ("kasza", "Kasza bulgur", "kg", "2.0", "12"),
    ("warzywa", "Mieszanka warzyw", "kg", "3.0", "20"),
    ("dynia", "Dynia", "kg", "2.0", "12"),
    ("ciecierzyca", "Ciecierzyca", "kg", "1.0", "7"),
    ("mieso", "Mięso mielone", "kg", "1.5", "10"),
    ("ziemniaki", "Ziemniaki", "kg", "2.0", "16"),
    ("pomidory", "Pomidory", "kg", "2.0", "10"),
    ("makaron", "Makaron", "kg", "1.0", "5"),
    ("feta", "Ser feta", "kg", "0.75", "4"),
    ("bulion", "Bulion", "l", "2.0", "18"),
)
RECIPES = {
    "kurczak": {"kurczak": "0.170", "kasza": "0.090", "warzywa": "0.140"},
    "bowl": {"dynia": "0.160", "ciecierzyca": "0.100", "kasza": "0.080"},
    "klopsiki": {"mieso": "0.155", "ziemniaki": "0.160", "pomidory": "0.100", "warzywa": "0.050"},
    "krem": {"pomidory": "0.220", "bulion": "0.120"},
    "rosol": {"bulion": "0.280", "makaron": "0.040", "kurczak": "0.050"},
    "salatka": {"warzywa": "0.170", "pomidory": "0.075", "feta": "0.050"},
}


class Command(BaseCommand):
    help = "Dodaje demonstracyjne składniki, przyjęcie i receptury."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Dane demonstracyjne wymagają DJANGO_DEBUG=true.")
        ingredients = {}
        for slug, name, unit, minimum, _ in STOCK:
            ingredient_id = demo_id(f"ingredient/{slug}")
            if Ingredient.objects.filter(name=name).exclude(pk=ingredient_id).exists():
                name = f"{name} (demo {ingredient_id.hex[:8]})"
            ingredient, _ = Ingredient.objects.get_or_create(
                id=ingredient_id,
                defaults={"name": name, "unit": unit, "minimum": Decimal(minimum)},
            )
            ingredients[slug] = ingredient.pk
        receipt_id = demo_id("initial-stock")
        if not Receipt.objects.filter(pk=receipt_id).exists():
            record_receipt(
                id=receipt_id,
                supplier="Dostawa startowa SmakBox",
                received_by=demo_id("magazyn@smakbox.example"),
                lines=[
                    {"ingredient_id": ingredients[slug], "quantity": Decimal(quantity)}
                    for slug, _, _, _, quantity in STOCK
                ],
            )
        for meal, recipe in RECIPES.items():
            meal_id = demo_id(meal)
            if not Recipe.objects.filter(pk=meal_id).exists():
                save_recipe(
                    meal_id,
                    [
                        {"ingredient_id": ingredients[slug], "quantity": Decimal(quantity)}
                        for slug, quantity in recipe.items()
                    ],
                )
        self.stdout.write(self.style.SUCCESS("Przygotowano demonstracyjny magazyn."))
