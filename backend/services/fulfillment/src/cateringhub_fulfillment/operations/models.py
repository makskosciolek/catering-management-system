import uuid

from django.db import models


class FulfillmentOrder(models.Model):
    class Status(models.TextChoices):
        READY = "ready", "Do przygotowania"
        PREPARING = "preparing", "W przygotowaniu"
        PREPARED = "prepared", "Przygotowane"
        PACKED = "packed", "Spakowane"
        CANCELLED = "cancelled", "Anulowane"

    order_id = models.UUIDField(primary_key=True, editable=False)
    delivery_date = models.DateField(db_index=True)
    items = models.JSONField(default=list)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.READY)


class ProcessedEvent(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    received_at = models.DateTimeField(auto_now_add=True)


class OutboxEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_id = models.UUIDField()
    event_type = models.CharField(max_length=100)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    next_publish_at = models.DateTimeField(null=True, blank=True)
