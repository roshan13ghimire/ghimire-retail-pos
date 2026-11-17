
from rest_framework import serializers
from .models import Product
from .models import StockMovement


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "barcode",
            "price",
            "stock",
        ]
    def validate(self, attrs):
        if self.instance is not None and "stock" in attrs:
            raise serializers.ValidationError({
                "stock": "Use the stock receiving API instead."
            })
        return attrs

class ReceiveStockSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


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
        ]
    

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

