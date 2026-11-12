
from decimal import Decimal

from rest_framework import serializers
from .models import Sale, SaleItem,Refund


class CheckoutItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class CheckoutSerializer(serializers.Serializer):
    items = CheckoutItemSerializer(
        many=True,
        allow_empty=False
    )

    cash_received = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00")
    )
    checkout_id = serializers.UUIDField()

    def validate_items(self, items):
        product_ids = [
            item["product_id"]
            for item in items
        ]

        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError(
                "Each product can appear only once."
            )

        return items


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True
    )

    class Meta:
        model = SaleItem
        fields = [
            "id",
            "product",
            "product_name",
            "quantity",
            "unit_price",
        ]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = Sale
        fields = [
            "id",
            "total_amount",
            "payment_method",
            "cash_received",
            "change_amount",
            "created_at",
            "items",
        ]

class RefundRequestSerializer(serializers.Serializer):
    refund_request_id = serializers.UUIDField()
    sale_item_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)
    restock = serializers.BooleanField()

    reason = serializers.CharField(
        max_length=255,
        allow_blank=False,
        trim_whitespace=True
    )


class RefundSerializer(serializers.ModelSerializer):
    sale_id = serializers.IntegerField(
        source="sale_item.sale_id",
        read_only=True
    )

    product_name = serializers.CharField(
        source="sale_item.product.name",
        read_only=True
    )

    class Meta:
        model = Refund
        fields = [
            "id",
            "refund_request_id",
            "sale_item",
            "sale_id",
            "product_name",
            "quantity",
            "refund_amount",
            "restock",
            "reason",
            "created_at",
        ]
