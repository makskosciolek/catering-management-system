import re

from rest_framework import serializers

PHONE_PATTERN = re.compile(r"\+?[0-9][0-9 -]*")
MIN_DIGITS = 9
MAX_DIGITS = 15


def normalize_phone(value):
    """Sprawdza numer telefonu i ujednolica odstępy.

    Dopuszczalne są cyfry, spacje, myślniki i opcjonalny znak + na początku.
    Numer musi mieć od 9 do 15 cyfr (polski numer lub numer w formacie
    międzynarodowym E.164).
    """
    value = " ".join(value.split())
    digits = sum(char.isdigit() for char in value)
    if not PHONE_PATTERN.fullmatch(value) or not MIN_DIGITS <= digits <= MAX_DIGITS:
        raise serializers.ValidationError(
            "Podaj poprawny numer telefonu, np. 600 700 800 lub +48 600 700 800."
        )
    return value


class PhoneField(serializers.CharField):
    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        return normalize_phone(value) if value else value
