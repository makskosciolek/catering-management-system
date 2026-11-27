from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("operations", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="fulfillmentorder",
            name="status",
            field=models.CharField(
                choices=[
                    ("ready", "Do przygotowania"),
                    ("preparing", "W przygotowaniu"),
                    ("prepared", "Przygotowane"),
                    ("packed", "Spakowane"),
                    ("cancelled", "Anulowane"),
                ],
                default="ready",
                max_length=24,
            ),
        ),
    ]
