
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

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "product",
            "product_name",
            "movement_type",
            "quantity",
            "created_at",
        ]


class StockAdjustmentSerializer(serializers.Serializer):
    counted_stock = serializers.IntegerField(min_value=0)

    reason = serializers.CharField(
        max_length=255,
        allow_blank=False,
        trim_whitespace=True
    )

