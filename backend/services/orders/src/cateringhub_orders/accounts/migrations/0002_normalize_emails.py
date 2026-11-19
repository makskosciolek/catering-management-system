from django.db import migrations


def normalize_emails(apps, schema_editor):
    """Ujednolica adresy zapisane wcześniej z wielkimi literami, np. w panelu Django."""
    User = apps.get_model("accounts", "User")
    for user in User.objects.only("pk", "email"):
        normalized = user.email.strip().casefold()
        if normalized != user.email:
            User.objects.filter(pk=user.pk).update(email=normalized)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [migrations.RunPython(normalize_emails, migrations.RunPython.noop)]
