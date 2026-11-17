
from rest_framework import serializers
from .models import Product
from .models import StockMovement, Category, Supplier
from decimal import Decimal
from .models import Supplier


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "barcode",
            "price",
            "stock",
            "reorder_level",
            "category",
"category_name",
        ]

    category_name = serializers.CharField(
    source="category.name",
    read_only=True
)
    def validate(self, attrs):
        if self.instance is not None and "stock" in attrs:
            raise serializers.ValidationError({
                "stock": "Use the stock receiving API instead."
            })
        return attrs

class ReceiveStockSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)

    supplier = serializers.PrimaryKeyRelatedField(
    queryset=Supplier.objects.all(),
    required=False,
    )

    purchase_unit_cost = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
    )

    reference = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )

    receipt_request_id = serializers.UUIDField(
    required=False
)
    def validate(self, attrs):
        supplier = attrs.get("supplier")
        cost = attrs.get("purchase_unit_cost")

        if (supplier is None) != (cost is None):
            raise serializers.ValidationError(
                "Supplier and purchase unit cost must be provided together."
            )

        return attrs


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True
    )
    performed_by_username = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "product",
            "product_name",
            "movement_type",
            "quantity",
            "created_at",
            "performed_by_username",
            "supplier",
            "supplier_name",
            "purchase_unit_cost",
            "total_purchase_cost",
            "reference",
        ]
    supplier_name = serializers.CharField(
    source="supplier.name",
    read_only=True,
)

    total_purchase_cost = serializers.SerializerMethodField()
    def get_total_purchase_cost(self, obj):
        if (
            obj.movement_type != StockMovement.Type.RECEIVED
            or obj.purchase_unit_cost is None
        ):
            return None

        return str(
            obj.purchase_unit_cost * obj.quantity
        )
        

    def get_performed_by_username(self, obj):
        if obj.performed_by_id:
            return obj.performed_by.username
        return None


class StockAdjustmentSerializer(serializers.Serializer):
    counted_stock = serializers.IntegerField(min_value=0)

    reason = serializers.CharField(
        max_length=255,
        allow_blank=False,
        trim_whitespace=True
    )

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "address",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]