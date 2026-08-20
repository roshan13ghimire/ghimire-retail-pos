from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        CASHIER = "CASHIER", "Cashier"
        INVENTORY_MANAGER = "INVENTORY_MANAGER", "Inventory Manager"

    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.CASHIER,
    )

    def __str__(self):
        return self.username