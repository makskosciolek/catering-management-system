from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .validators import PhoneField

User = get_user_model()


class NormalizedEmailField(serializers.EmailField):
    def to_internal_value(self, data):
        return super().to_internal_value(data).strip().casefold()


class UserSerializer(serializers.ModelSerializer):
    phone = PhoneField(max_length=30, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "phone", "role")
        read_only_fields = ("id", "email", "role")


class RegisterSerializer(serializers.ModelSerializer):
    email = NormalizedEmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    phone = PhoneField(max_length=30, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("email", "password", "first_name", "last_name", "phone")
        extra_kwargs = {"first_name": {"required": True}, "last_name": {"required": True}}

    def validate(self, attrs):
        if User.objects.filter(email=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "Konto z tym adresem już istnieje."})
        try:
            validate_password(
                attrs["password"], User(**{k: v for k, v in attrs.items() if k != "password"})
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = NormalizedEmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)
