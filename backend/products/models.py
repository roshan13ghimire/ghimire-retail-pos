
from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator


class Product(models.Model):
    name = models.CharField(max_length=150)
    barcode = models.CharField(max_length=50, unique=True)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))]
    )
    stock = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name


class StockMovement(models.Model):

    class Type(models.TextChoices):
        RECEIVED = "RECEIVED", "Received"
        SOLD = "SOLD", "Sold"
        ADJUST_IN = "ADJUST_IN", "Adjustment Increase"
        ADJUST_OUT = "ADJUST_OUT", "Adjustment Decrease"
        RETURNED = "RETURNED", "Customer Return"


    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="stock_movements"
    )

    movement_type = models.CharField(
        max_length=10,
        choices=Type.choices
    )

    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )
    reason = models.CharField(
        max_length=255,
        blank=True,
        default=""
        )

    def __str__(self):
        return (
            f"{self.product.name}: "
            f"{self.movement_type} {self.quantity}"
        )



