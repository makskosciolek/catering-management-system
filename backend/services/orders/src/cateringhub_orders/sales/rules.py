from datetime import timedelta

from django.conf import settings
from django.utils import timezone


def earliest_delivery_date(now=None):
    """Zwraca najwcześniejszą datę dostawy możliwą do zamówienia.

    Kuchnia planuje produkcję wieczorem dnia poprzedniego, dlatego zamówienie
    na jutro można złożyć do godziny granicznej (domyślnie 18:00). Po tej
    godzinie najbliższy możliwy termin to pojutrze. Dostawy na bieżący dzień
    nie są przyjmowane.
    """
    now = timezone.localtime(now)
    days = 1 if now.hour < settings.ORDER_CUTOFF_HOUR else 2
    return now.date() + timedelta(days=days)
