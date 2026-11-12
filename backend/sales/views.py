
from decimal import Decimal
import hashlib
import json

from django.db.models import Sum, F, DecimalField
from django.db import transaction

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db import transaction, IntegrityError

from products.models import Product, StockMovement
from .serializers import CheckoutSerializer, SaleSerializer
from django.utils import timezone

from django.db import transaction, IntegrityError
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from decimal import Decimal
from datetime import date

from django.db.models import Sum, F, DecimalField
from django.utils import timezone

from .models import Sale, SaleItem, Refund
from products.models import Product

from .models import Sale, SaleItem, Refund
from .serializers import (
    RefundRequestSerializer,
    RefundSerializer,
)


class CheckoutView(APIView):

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        checkout_id = data["checkout_id"]
        items = data["items"]
        cash_received = data["cash_received"]

        product_ids = [
            item["product_id"]
            for item in items
        ]

        # Identify the exact cart and cash payment
        payload = {
            "items": sorted(
                items,
                key=lambda item: item["product_id"]
            ),
            "cash_received": f"{cash_received:.2f}",
        }

        fingerprint = hashlib.sha256(
            json.dumps(
                payload,
                sort_keys=True
            ).encode("utf-8")
        ).hexdigest()

        # Return a previous sale if this is a retry
        def existing_checkout():
            sale = Sale.objects.filter(
                checkout_id=checkout_id
            ).first()

            if sale is None:
                return None

            if sale.checkout_fingerprint != fingerprint:
                raise ValidationError({
                    "checkout_id": (
                        "This checkout ID belongs to "
                        "a different cart or payment."
                    )
                })

            return Response(
                SaleSerializer(sale).data,
                status=status.HTTP_200_OK
            )

        previous = existing_checkout()

        if previous is not None:
            return previous

        try:
            with transaction.atomic():

                # Lock product rows
                products = list(
                    Product.objects.select_for_update()
                    .filter(id__in=product_ids)
                    .order_by("id")
                )

                # Check again after acquiring locks
                previous = existing_checkout()

                if previous is not None:
                    return previous

                product_map = {
                    product.id: product
                    for product in products
                }

                total = Decimal("0.00")

                # Validate stock and calculate total
                for item in items:
                    product = product_map.get(
                        item["product_id"]
                    )

                    if product is None:
                        raise ValidationError(
                            "Product not found."
                        )

                    quantity = item["quantity"]

                    if product.stock < quantity:
                        raise ValidationError(
                            f"Insufficient stock for {product.name}."
                        )

                    total += product.price * quantity

                # Validate cash
                if cash_received < total:
                    raise ValidationError({
                        "cash_received": (
                            f"Insufficient cash. Total: {total}"
                        )
                    })

                change = cash_received - total

                # Save the sale
                sale = Sale.objects.create(
                    checkout_id=checkout_id,
                    checkout_fingerprint=fingerprint,
                    total_amount=total,
                    payment_method=Sale.PaymentMethod.CASH,
                    cash_received=cash_received,
                    change_amount=change
                )

                # Save items and update stock
                for item in items:
                    product = product_map[
                        item["product_id"]
                    ]

                    quantity = item["quantity"]

                    SaleItem.objects.create(
                        sale=sale,
                        product=product,
                        quantity=quantity,
                        unit_price=product.price
                    )

                    product.stock -= quantity
                    product.save(
                        update_fields=["stock"]
                    )

                    StockMovement.objects.create(
                        product=product,
                        movement_type=StockMovement.Type.SOLD,
                        quantity=quantity
                    )

        except IntegrityError:
            # Handle simultaneous requests using the same ID
            previous = existing_checkout()

            if previous is not None:
                return previous

            raise

        return Response(
            SaleSerializer(sale).data,
            status=status.HTTP_201_CREATED
        )


class SaleListView(generics.ListAPIView):
    queryset = Sale.objects.prefetch_related(
        "items__product"
    ).order_by("-created_at", "-id")

    serializer_class = SaleSerializer


class SaleDetailView(generics.RetrieveAPIView):
    queryset = Sale.objects.prefetch_related(
        "items__product"
    )

    serializer_class = SaleSerializer


class DashboardView(APIView):

    def get(self, request):
        today = timezone.localdate()

        # Sales created today
        sales = Sale.objects.filter(
            created_at__date=today
        )

        gross_sales = sales.aggregate(
            total=Sum("total_amount")
        )["total"] or Decimal("0.00")

        # Refunds recorded today
        refunds = Refund.objects.filter(
            created_at__date=today
        )

        total_refunds = refunds.aggregate(
            total=Sum("refund_amount")
        )["total"] or Decimal("0.00")

        net_sales = gross_sales - total_refunds

        # Inventory
        total_products = Product.objects.count()

        low_stock = Product.objects.filter(
            stock__lte=5
        ).order_by("stock", "name")

        return Response({
            "date": str(today),

            # Keep original field for compatibility
            "today_sales": str(gross_sales),

            # New financial fields
            "today_refunds": str(total_refunds),
            "today_net_sales": str(net_sales),
            "refund_count": refunds.count(),

            # Existing metrics
            "transaction_count": sales.count(),
            "total_products": total_products,
            "low_stock_count": low_stock.count(),

            "low_stock_products": list(
                low_stock.values(
                    "id",
                    "name",
                    "barcode",
                    "stock"
                )[:10]
            )
        })



class DailySalesReportView(APIView):

    def get(self, request):
        date_text = request.query_params.get("date")

        if date_text:
            try:
                report_date = date.fromisoformat(date_text)
            except ValueError:
                return Response(
                    {"error": "Invalid date. Use YYYY-MM-DD."},
                    status=400
                )
        else:
            report_date = timezone.localdate()

        # Sales made on the selected date
        sales = Sale.objects.filter(
            created_at__date=report_date
        )

        gross_sales = sales.aggregate(
            total=Sum("total_amount")
        )["total"] or Decimal("0.00")

        # Refunds recorded on the selected date
        refunds = Refund.objects.filter(
            created_at__date=report_date
        )

        total_refunds = refunds.aggregate(
            total=Sum("refund_amount")
        )["total"] or Decimal("0.00")

        net_sales = gross_sales - total_refunds

        # Original product sales breakdown
        product_rows = (
            SaleItem.objects.filter(
                sale__created_at__date=report_date
            )
            .values("product_id", "product__name")
            .annotate(
                quantity_sold=Sum("quantity"),
                sales_amount=Sum(
                    F("quantity") * F("unit_price"),
                    output_field=DecimalField(
                        max_digits=16,
                        decimal_places=2
                    )
                )
            )
            .order_by("-quantity_sold", "product__name")
        )

        products = [
            {
                "product_id": row["product_id"],
                "product_name": row["product__name"],
                "quantity_sold": row["quantity_sold"],
                "sales_amount": str(row["sales_amount"])
            }
            for row in product_rows
        ]

        total_items = sum(
            product["quantity_sold"]
            for product in products
        )

        return Response({
            "date": str(report_date),

            # Original sales field
            "total_sales": str(gross_sales),

            # New refund-aware metrics
            "total_refunds": str(total_refunds),
            "net_sales": str(net_sales),
            "refund_count": refunds.count(),

            # Existing statistics
            "transaction_count": sales.count(),
            "total_items_sold": total_items,
            "products_sold_count": len(products),

            # Gross product sales breakdown
            "products": products
        })


class RefundView(APIView):

    # View previously recorded refunds
    def get(self, request):
        refunds = Refund.objects.select_related(
            "sale_item__sale",
            "sale_item__product"
        ).order_by("-created_at", "-id")

        return Response(
            RefundSerializer(refunds, many=True).data
        )

    # Record a refund
    def post(self, request):
        serializer = RefundRequestSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        request_id = data["refund_request_id"]
        sale_item_id = data["sale_item_id"]
        quantity = data["quantity"]
        restock = data["restock"]
        reason = data["reason"]

        # Recognize an earlier successful request
        def find_previous():
            refund = Refund.objects.filter(
                refund_request_id=request_id
            ).first()

            if refund is None:
                return None

            if (
                refund.sale_item_id != sale_item_id
                or refund.quantity != quantity
                or refund.restock != restock
                or refund.reason != reason
            ):
                raise ValidationError({
                    "refund_request_id":
                    "This ID was used for a different refund."
                })

            return refund

        previous = find_previous()

        if previous is not None:
            return Response(
                RefundSerializer(previous).data,
                status=status.HTTP_200_OK
            )

        try:
            with transaction.atomic():

                # Lock the purchased item to prevent
                # simultaneous over-refunding
                sale_item = get_object_or_404(
                    SaleItem.objects.select_for_update(),
                    pk=sale_item_id
                )

                # Check again after acquiring the lock
                previous = find_previous()

                if previous is not None:
                    return Response(
                        RefundSerializer(previous).data,
                        status=status.HTTP_200_OK
                    )

                # Only recorded cash sales are supported
                if (
                    sale_item.sale.payment_method
                    != Sale.PaymentMethod.CASH
                ):
                    raise ValidationError(
                        "Only recorded cash sales can be refunded."
                    )

                # Calculate previously returned quantity
                already_returned = (
                    Refund.objects.filter(
                        sale_item=sale_item
                    ).aggregate(
                        total=Sum("quantity")
                    )["total"] or 0
                )

                remaining = (
                    sale_item.quantity - already_returned
                )

                if quantity > remaining:
                    raise ValidationError({
                        "quantity":
                        f"Only {remaining} units remain refundable."
                    })

                # Use original purchase price
                amount = sale_item.unit_price * quantity

                refund = Refund.objects.create(
                    refund_request_id=request_id,
                    sale_item=sale_item,
                    quantity=quantity,
                    refund_amount=amount,
                    restock=restock,
                    reason=reason
                )

                # Return sellable items to inventory
                if restock:
                    product = Product.objects.select_for_update().get(
                        pk=sale_item.product_id
                    )

                    product.stock += quantity
                    product.save(
                        update_fields=["stock"]
                    )

                    StockMovement.objects.create(
                        product=product,
                        movement_type=StockMovement.Type.RETURNED,
                        quantity=quantity,
                        reason=f"Refund #{refund.id}"
                    )

        except IntegrityError:
            # Another request may have saved
            # the same refund ID concurrently
            previous = find_previous()

            if previous is not None:
                return Response(
                    RefundSerializer(previous).data,
                    status=status.HTTP_200_OK
                )

            raise

        return Response(
            RefundSerializer(refund).data,
            status=status.HTTP_201_CREATED
        )
