
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import (
    validate_password,
)
from django.contrib.auth.validators import (
    UnicodeUsernameValidator,
)
from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)

from rest_framework import serializers


User = get_user_model()


class StaffCreateSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
        validators=[UnicodeUsernameValidator()]
    )

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False
    )

    role = serializers.ChoiceField(
        choices=["Cashier", "Manager"]
    )

    def validate_username(self, value):
        if User.objects.filter(
            username__iexact=value
        ).exists():
            raise serializers.ValidationError(
                "This username already exists."
            )

        return value

    def validate(self, attrs):
        user = User(username=attrs["username"])

        try:
            validate_password(
                attrs["password"],
                user=user
            )
        except DjangoValidationError as error:
            raise serializers.ValidationError({
                "password": error.messages
            })

        return attrs


class StaffStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()
