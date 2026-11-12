
from django.db import models
from django.core.validators import MinValueValidator
from products.models import Product



class Sale(models.Model):

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    payment_method = models.CharField(
        max_length=10,
        choices=PaymentMethod.choices,
        blank=True,
        default=""
    )

    cash_received = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    change_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    checkout_id = models.UUIDField(
        unique=True,
        null=True,
        blank=True
    )

    checkout_fingerprint = models.CharField(
        max_length=64,
        blank=True,
        default=""
    )


    def __str__(self):
        return f"Sale #{self.id}"



class SaleItem(models.Model):
    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name="items"
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT
    )
    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

class Refund(models.Model):
    refund_request_id = models.UUIDField(
        unique=True
    )

    sale_item = models.ForeignKey(
        SaleItem,
        on_delete=models.PROTECT,
        related_name="refunds"
    )

    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )

    refund_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    restock = models.BooleanField()

    reason = models.CharField(max_length=255)

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"Refund #{self.id}"
