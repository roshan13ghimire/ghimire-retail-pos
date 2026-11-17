
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import viewsets, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import Product, StockMovement, Category
from .serializers import CategorySerializer

from .models import Supplier
from .serializers import SupplierSerializer
from accounts.permissions import IsPOSStaff
from django.db import IntegrityError, transaction

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

    @staticmethod
    def same_delivery(
        movement,
        product_id,
        quantity,
        supplier,
        purchase_unit_cost,
        reference,
    ):
        supplier_id = (
            supplier.id if supplier is not None else None
        )

        return (
            movement.movement_type
            == StockMovement.Type.RECEIVED
            and movement.product_id == int(product_id)
            and movement.quantity == quantity
            and movement.supplier_id == supplier_id
            and movement.purchase_unit_cost == purchase_unit_cost
            and movement.reference == reference
        )

    @staticmethod
    def build_response(movement, current_stock, replayed=False):
        cost = movement.purchase_unit_cost

        total_cost = (
            movement.quantity * cost
            if cost is not None
            else None
        )

        return Response({
            "message": (
                "Delivery already recorded. No additional stock added."
                if replayed
                else "Stock received successfully"
            ),
            "product_id": movement.product_id,
            "quantity_added": (
                0 if replayed else movement.quantity
            ),
            "original_quantity_received": movement.quantity,
            "current_stock": current_stock,
            "stock_movement_id": movement.id,
            "receipt_request_id": (
                str(movement.receipt_request_id)
                if movement.receipt_request_id
                else None
            ),
            "supplier_id": movement.supplier_id,
            "purchase_unit_cost": (
                str(cost) if cost is not None else None
            ),
            "total_purchase_cost": (
                str(total_cost)
                if total_cost is not None
                else None
            ),
            "reference": movement.reference,
            "already_processed": replayed,
        })

    def handle_existing(
        self,
        movement,
        product_id,
        quantity,
        supplier,
        purchase_unit_cost,
        reference,
    ):
        if not self.same_delivery(
            movement,
            product_id,
            quantity,
            supplier,
            purchase_unit_cost,
            reference,
        ):
            return Response(
                {
                    "detail": (
                        "This receipt request ID was already "
                        "used for a different stock delivery."
                    )
                },
                status=409,
            )

        # This is the current inventory balance, not
        # necessarily the balance at original receiving time.
        current_stock = Product.objects.get(
            pk=product_id
        ).stock

        return self.build_response(
            movement,
            current_stock,
            replayed=True,
        )

    def post(self, request, pk):
        serializer = ReceiveStockSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        quantity = serializer.validated_data["quantity"]
        supplier = serializer.validated_data.get("supplier")

        purchase_unit_cost = (
            serializer.validated_data.get(
                "purchase_unit_cost"
            )
        )

        reference = serializer.validated_data.get(
            "reference", ""
        )

        request_id = serializer.validated_data.get(
            "receipt_request_id"
        )

        try:
            with transaction.atomic():

                # Lock the product row to serialize
                # receiving operations for this product.
                product = get_object_or_404(
                    Product.objects.select_for_update(),
                    pk=pk,
                )

                # Check whether this delivery was
                # already recorded.
                if request_id is not None:
                    existing = (
                        StockMovement.objects.filter(
                            receipt_request_id=request_id
                        ).first()
                    )

                    if existing is not None:
                        return self.handle_existing(
                            existing,
                            pk,
                            quantity,
                            supplier,
                            purchase_unit_cost,
                            reference,
                        )

                # Receive inventory exactly once
                # for this request ID.
                product.stock += quantity
                product.save(update_fields=["stock"])

                movement = StockMovement.objects.create(
                    product=product,
                    movement_type=StockMovement.Type.RECEIVED,
                    quantity=quantity,
                    supplier=supplier,
                    purchase_unit_cost=purchase_unit_cost,
                    reference=reference,
                    receipt_request_id=request_id,
                    performed_by=request.user,
                )

        except IntegrityError:
            # A concurrent request may have inserted
            # the same unique receipt_request_id.
            #
            # The atomic transaction has been rolled back,
            # including its stock increase.

            if request_id is None:
                raise

            existing = StockMovement.objects.filter(
                receipt_request_id=request_id
            ).first()

            # Do not hide an unrelated database error.
            if existing is None:
                raise

            return self.handle_existing(
                existing,
                pk,
                quantity,
                supplier,
                purchase_unit_cost,
                reference,
            )

        return self.build_response(
            movement,
            product.stock,
            replayed=False,
        )


# -----------------------------------------
# 3. Stock Movement History
# Admin and Manager Only
# -----------------------------------------
class StockMovementListView(generics.ListAPIView):
    permission_classes = [IsManagerOrAdmin]

    queryset = StockMovement.objects.select_related(
        "product",
        "performed_by"
    ).order_by("-created_at", "-id")

    serializer_class = StockMovementSerializer

    queryset = (
    StockMovement.objects
    .select_related(
        "product",
        "performed_by",
        "supplier",
    )
    .order_by("-created_at", "-id")
)


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

            # Record inventory adjustment and employee
            StockMovement.objects.create(
                product=product,
                movement_type=movement_type,
                quantity=abs(difference),
                reason=reason,
                performed_by=request.user
            )

        return Response({
            "message": "Stock adjusted successfully",
            "product_id": product.id,
            "previous_stock": old_stock,
            "current_stock": counted_stock,
            "difference": difference
        })
class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer

    # Categories cannot be deleted through this API.
    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "head",
        "options",
    ]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsPOSStaff()]

        return [IsManagerOrAdmin()]

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by("name")
    serializer_class = SupplierSerializer

    # Do not allow suppliers to be deleted through the API
    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "head",
        "options",
    ]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsPOSStaff()]

        return [IsManagerOrAdmin()]