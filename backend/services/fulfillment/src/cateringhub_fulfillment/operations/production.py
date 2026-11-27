from urllib.error import HTTPError
from urllib.request import Request, urlopen

from cateringhub_core.messaging import ORDER_PACKED, ORDER_PREPARED
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, AuthenticationFailed, NotFound, PermissionDenied

from .models import FulfillmentOrder, OutboxEvent

Status = FulfillmentOrder.Status
TRANSITIONS = {
    Status.PREPARED: (Status.PREPARING, ORDER_PREPARED),
    Status.PACKED: (Status.PREPARED, ORDER_PACKED),
}


class ProductionConflict(APIException):
    status_code = 409
    default_detail = "Bieżący status zamówienia nie pozwala wykonać tej operacji."


class OrdersUnavailable(APIException):
    status_code = 503
    default_detail = "Zamówienia są chwilowo niedostępne. Ponów rozpoczęcie produkcji."


def request_production_start(order, access_token):
    if order.status == Status.CANCELLED:
        raise ProductionConflict("Zamówienie zostało anulowane.")
    if order.status != Status.READY:
        return
    url = f"{settings.ORDERS_API_URL}/internal/fulfillment/orders/{order.pk}/start/"
    request = Request(url, method="POST")
    request.add_unredirected_header("Authorization", f"Bearer {access_token}")
    try:
        with urlopen(request, timeout=2) as response:
            if response.status != 204 or response.geturl() != url:
                raise OrdersUnavailable()
    except HTTPError as exc:
        if exc.code == 401:
            raise AuthenticationFailed("Sesja wygasła lub konto jest nieaktywne.") from exc
        if exc.code == 403:
            raise PermissionDenied("Ta rola nie może rozpocząć produkcji.") from exc
        if exc.code == 404:
            raise NotFound("Zamówienia nie znaleziono.") from exc
        if exc.code == 409:
            raise ProductionConflict("Zamówienie nie ma już aktywnej rezerwacji.") from exc
        raise OrdersUnavailable() from exc
    except OSError as exc:
        raise OrdersUnavailable() from exc


@transaction.atomic
def advance_production(order_id, target):
    order = get_object_or_404(FulfillmentOrder.objects.select_for_update(), pk=order_id)
    previous, event_type = TRANSITIONS[target]
    if order.status == target or (target == Status.PREPARED and order.status == Status.PACKED):
        return order
    if order.status != previous:
        raise ProductionConflict()
    order.status = target
    order.save(update_fields=["status"])
    OutboxEvent.objects.create(order_id=order.pk, event_type=event_type, payload={})
    return order


def production_totals(orders):
    totals = {}
    for items in orders.values_list("items", flat=True).iterator():
        for item in items:
            portion = totals.setdefault(item["meal_id"], {**item, "quantity": 0})
            portion["quantity"] += item["quantity"]
    return sorted(totals.values(), key=lambda item: (item["meal_name"].casefold(), item["meal_id"]))
