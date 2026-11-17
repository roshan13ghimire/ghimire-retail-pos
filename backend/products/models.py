
from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings

class Category(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True
    )

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name
    
class Supplier(models.Model):
    name = models.CharField(
        max_length=150,
        unique=True
    )
    phone = models.CharField(
        max_length=30,
        blank=True
    )
    email = models.EmailField(
        blank=True
    )
    address = models.TextField(
        blank=True
    )
    notes = models.TextField(
        blank=True
    )
    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
    
class Product(models.Model):
    name = models.CharField(max_length=150)
    barcode = models.CharField(max_length=50, unique=True)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))]
    )
    stock = models.PositiveIntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=5)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="products"
    )


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
    performed_by = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="pos_stock_movements"
)
    supplier = models.ForeignKey(
    "products.Supplier",
    on_delete=models.PROTECT,
    null=True,
    blank=True,
    related_name="stock_movements",
)

    purchase_unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    reference = models.CharField(
        max_length=100,
        blank=True,
    )
    receipt_request_id = models.UUIDField(
    null=True,
    blank=True,
    unique=True,
    editable=False,
)

    def __str__(self):
        return (
            f"{self.product.name}: "
            f"{self.movement_type} {self.quantity}"
        )



