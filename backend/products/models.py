from django.db import models
import uuid


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Brand(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Unit(models.Model):
    name = models.CharField(max_length=50, unique=True)
    abbreviation = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.abbreviation})"

def generate_sku():
    return f"PRD-{uuid.uuid4().hex[:8].upper()}"

class Product(models.Model):
    name = models.CharField(max_length=200)

    sku = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
        default=generate_sku,
    )

    barcode = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )

    brand = models.ForeignKey(
        Brand,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )

    unit = models.ForeignKey(
        Unit,
        on_delete=models.PROTECT,
        related_name="products",
    )

    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    vat_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )

    track_stock = models.BooleanField(default=True)

    track_expiry = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.sku})"