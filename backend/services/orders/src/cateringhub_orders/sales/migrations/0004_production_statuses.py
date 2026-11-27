from django.db import migrations, models
from django.utils import timezone


def queue_existing_reservations(apps, schema_editor):
    Order = apps.get_model("sales", "Order")
    OutboxEvent = apps.get_model("sales", "OutboxEvent")
    database = schema_editor.connection.alias
    orders = (
        Order.objects.using(database)
        .select_for_update()
        .filter(status="stock_reserved", delivery_date__gte=timezone.localdate())
        .prefetch_related("items")
    )
    for order in orders.iterator(chunk_size=200):
        OutboxEvent.objects.using(database).get_or_create(
            order_id=order.pk,
            event_type="order.ready_for_fulfillment",
            defaults={
                "payload": {
                    "delivery_date": order.delivery_date.isoformat(),
                    "items": [
                        {
                            "meal_id": str(item.meal_id),
                            "meal_name": item.meal_name,
                            "quantity": item.quantity,
                        }
                        for item in order.items.all()
                    ],
                }
            },
        )


class Migration(migrations.Migration):
    dependencies = [("sales", "0003_reservation_lifecycle_and_publication_retry")]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("submitted", "Oczekuje na magazyn"),
                    ("stock_reserved", "Składniki zarezerwowane"),
                    ("stock_shortage", "Brak składników lub receptury"),
                    ("preparing", "W przygotowaniu"),
                    ("prepared", "Przygotowane"),
                    ("packed", "Spakowane"),
                    ("cancelled", "Anulowane"),
                ],
                default="submitted",
                max_length=24,
            ),
        ),
        migrations.RunPython(queue_existing_reservations, migrations.RunPython.noop),
    ]
