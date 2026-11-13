
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import viewsets, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import Product, StockMovement

from .serializers import (
    ProductSerializer,
    ReceiveStockSerializer,
    StockMovementSerializer,
    StockAdjustmentSerializer,
)

from accounts.permissions import (
    ProductPermission,
    IsManagerOrAdmin,
)


# -----------------------------------------
# 1. Product Management
# -----------------------------------------
class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by("name")
    serializer_class = ProductSerializer

    permission_classes = [ProductPermission]


# -----------------------------------------
# 2. Receive Stock
# Admin and Manager Only
# -----------------------------------------
class ReceiveStockView(APIView):
    permission_classes = [IsManagerOrAdmin]

    def post(self, request, pk):
        serializer = ReceiveStockSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        quantity = serializer.validated_data["quantity"]

        with transaction.atomic():

            # Lock product while updating stock
            product = get_object_or_404(
                Product.objects.select_for_update(),
                pk=pk
            )

            # Increase available stock
            product.stock += quantity
            product.save(update_fields=["stock"])

            # Record stock movement
            StockMovement.objects.create(
                product=product,
                movement_type=StockMovement.Type.RECEIVED,
                quantity=quantity
            )

        return Response({
            "message": "Stock received successfully",
            "product_id": product.id,
            "quantity_added": quantity,
            "current_stock": product.stock
        })


# -----------------------------------------
# 3. Stock Movement History
# Admin and Manager Only
# -----------------------------------------
class StockMovementListView(generics.ListAPIView):
    permission_classes = [IsManagerOrAdmin]

    queryset = StockMovement.objects.select_related(
        "product"
    ).order_by("-created_at", "-id")

    serializer_class = StockMovementSerializer


# -----------------------------------------
# 4. Stock Adjustment
# Admin and Manager Only
# -----------------------------------------
class StockAdjustmentView(APIView):
    permission_classes = [IsManagerOrAdmin]

    def post(self, request, pk):
        serializer = StockAdjustmentSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        counted_stock = serializer.validated_data[
            "counted_stock"
        ]

        reason = serializer.validated_data["reason"]

        with transaction.atomic():

            # Lock product while updating stock
            product = get_object_or_404(
                Product.objects.select_for_update(),
                pk=pk
            )

            old_stock = product.stock
            difference = counted_stock - old_stock

            if difference == 0:
                raise ValidationError(
                    "Stock already matches the physical count."
                )

            if difference > 0:
                movement_type = StockMovement.Type.ADJUST_IN
            else:
                movement_type = StockMovement.Type.ADJUST_OUT

            # Update stock to actual count
            product.stock = counted_stock
            product.save(update_fields=["stock"])

            # Record inventory adjustment
            StockMovement.objects.create(
                product=product,
                movement_type=movement_type,
                quantity=abs(difference),
                reason=reason
            )

        return Response({
            "message": "Stock adjusted successfully",
            "product_id": product.id,
            "previous_stock": old_stock,
            "current_stock": counted_stock,
            "difference": difference
        })
