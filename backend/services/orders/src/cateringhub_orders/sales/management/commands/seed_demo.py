from datetime import timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from ...models import Meal, Order
from ...services import create_order

DEMO_PASSWORD = "SmakBox-demo-2026!"
MEALS = (
    (
        "kurczak",
        "Kurczak z pieca",
        "Pieczony kurczak, kasza bulgur i warzywa z ziołami.",
        "34.90",
        Meal.Category.MAIN,
        "gluten",
        False,
    ),
    (
        "bowl",
        "Bowl z pieczoną dynią",
        "Bulgur, dynia, ciecierzyca i dressing cytrynowy.",
        "31.90",
        Meal.Category.MAIN,
        "gluten, sezam",
        True,
    ),
    (
        "klopsiki",
        "Klopsiki w sosie pomidorowym",
        "Pulpeciki, purée ziemniaczane i fasolka.",
        "33.50",
        Meal.Category.MAIN,
        "mleko, jaja",
        False,
    ),
    (
        "krem",
        "Krem z pomidorów",
        "Zupa z pieczonych pomidorów z bazylią i grzankami.",
        "16.90",
        Meal.Category.SOUP,
        "gluten",
        True,
    ),
    (
        "rosol",
        "Rosół z makaronem",
        "Bulion drobiowy, marchew i makaron jajeczny.",
        "17.50",
        Meal.Category.SOUP,
        "gluten, jaja, seler",
        False,
    ),
    (
        "salatka",
        "Sałatka z fetą",
        "Miks sałat, pomidory, ogórek i feta z oliwą.",
        "23.90",
        Meal.Category.SALAD,
        "mleko",
        True,
    ),
)


def demo_id(name):
    return uuid5(NAMESPACE_URL, f"cateringhub/demo/{name}")


class Command(BaseCommand):
    help = "Przygotowuje menu i konta demonstracyjne bez zmiany istniejących danych."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Dane demonstracyjne są dostępne tylko z DJANGO_DEBUG=true.")
        user_model = get_user_model()
        for prefix, first, last, role in (
            ("klient", "Jan", "Zieliński", user_model.Role.CUSTOMER),
            ("anna", "Anna", "Wiśniewska", user_model.Role.CUSTOMER),
            ("manager", "Marta", "Nowak", user_model.Role.MANAGER),
            ("magazyn", "Ewa", "Lis", user_model.Role.WAREHOUSE),
            ("admin", "Ola", "Krawczyk", user_model.Role.ADMIN),
        ):
            email = f"{prefix}@smakbox.example"
            if not user_model.objects.filter(email=email).exists():
                extra = (
                    {"is_staff": True, "is_superuser": True}
                    if role == user_model.Role.ADMIN
                    else {}
                )
                user_model.objects.create_user(
                    email,
                    DEMO_PASSWORD,
                    id=demo_id(email),
                    first_name=first,
                    last_name=last,
                    role=role,
                    **extra,
                )
        for slug, name, desc, price, category, allergens, vegetarian in MEALS:
            Meal.objects.get_or_create(
                id=demo_id(slug),
                defaults={
                    "name": name,
                    "description": desc,
                    "price": Decimal(price),
                    "category": category,
                    "allergens": allergens,
                    "is_vegetarian": vegetarian,
                },
            )
        for prefix, slug in (("klient", "kurczak"), ("anna", "bowl")):
            order_id = demo_id(f"order/{prefix}")
            if not Order.objects.filter(id=order_id).exists():
                create_order(
                    id=order_id,
                    customer=user_model.objects.get(email=f"{prefix}@smakbox.example"),
                    items=[{"meal_id": demo_id(slug), "quantity": 2}],
                    delivery_date=timezone.localdate() + timedelta(days=1),
                    delivery_address="ul. Przykładowa 12, Kraków",
                    contact_phone="000 000 000",
                    note="Dane demonstracyjne",
                )
        self.stdout.write(self.style.SUCCESS("Dane demonstracyjne gotowe."))
