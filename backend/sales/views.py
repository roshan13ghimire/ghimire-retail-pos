
from decimal import Decimal

from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError

from products.models import Product
from .models import Sale, SaleItem
from .serializers import CheckoutSerializer, SaleSerializer
from rest_framework import generics


class CheckoutView(APIView):

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items = serializer.validated_data["items"]
        product_ids = [item["product_id"] for item in items]

        with transaction.atomic():

            # Lock products until checkout finishes
            products = Product.objects.select_for_update().filter(
                id__in=product_ids
            ).order_by("id")

            product_map = {p.id: p for p in products}

            # Validate all products and stock first
            for item in items:
                product = product_map.get(item["product_id"])

                if product is None:
                    raise ValidationError(
                        "One or more products do not exist."
                    )

                if product.stock < item["quantity"]:
                    raise ValidationError(
                        f"Not enough stock for {product.name}."
                    )

            # Create sale
            sale = Sale.objects.create()
            total = Decimal("0.00")

            for item in items:
                product = product_map[item["product_id"]]
                quantity = item["quantity"]

                SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    quantity=quantity,
                    unit_price=product.price
                )

                # Deduct stock
                product.stock -= quantity
                product.save(update_fields=["stock"])

                total += product.price * quantity

            sale.total_amount = total
            sale.save(update_fields=["total_amount"])

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
