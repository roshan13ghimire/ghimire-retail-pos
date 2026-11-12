
from rest_framework import viewsets
from .models import Product
from .serializers import ProductSerializer

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Product, StockMovement
from .serializers import ReceiveStockSerializer
from rest_framework import generics
from .serializers import StockMovementSerializer
from .serializers import StockAdjustmentSerializer
from rest_framework.exceptions import ValidationError

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by("name")
    serializer_class = ProductSerializer


class ReceiveStockView(APIView):

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

            # Record the stock movement
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


class StockMovementListView(generics.ListAPIView):
    queryset = StockMovement.objects.select_related(
        "product"
    ).order_by("-created_at", "-id")

    serializer_class = StockMovementSerializer

class StockAdjustmentView(APIView):

    def post(self, request, pk):
        serializer = StockAdjustmentSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        counted_stock = serializer.validated_data["counted_stock"]
        reason = serializer.validated_data["reason"]

        with transaction.atomic():

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

            # Update stock to the actual count
            product.stock = counted_stock
            product.save(update_fields=["stock"])

            # Record why stock changed
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
