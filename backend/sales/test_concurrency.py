
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import connection, connections, close_old_connections
from django.test import TransactionTestCase

from rest_framework.test import APIClient

from products.models import Product, StockMovement
from .models import Sale, SaleItem, Refund


User = get_user_model()


class POSConcurrencyTests(TransactionTestCase):

    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("These tests require PostgreSQL.")

        cashier_group = Group.objects.create(name="Cashier")
        manager_group = Group.objects.create(name="Manager")

        self.cashier = User.objects.create_user(
            username="concurrent_cashier",
            password="TestPassword123!"
        )
        self.cashier.groups.add(cashier_group)

        self.manager = User.objects.create_user(
            username="concurrent_manager",
            password="TestPassword123!"
        )
        self.manager.groups.add(manager_group)

        self.product = Product.objects.create(
            name="Concurrency Test Product",
            barcode="CONCURRENT1001",
            price=Decimal("12.50"),
            stock=2
        )

    def parallel_posts(self, url, first, second, user):
        """
        Send two API requests using separate threads
        and separate PostgreSQL connections.
        """
        barrier = Barrier(3)

        def send_request(payload):
            close_old_connections()

            try:
                client = APIClient()

                # Load a separate user instance
                thread_user = User.objects.get(pk=user.pk)

                client.force_authenticate(
                    user=thread_user
                )

                # Wait until both requests are ready
                barrier.wait(timeout=15)

                response = client.post(
                    url,
                    payload,
                    format="json"
                )

                return response.status_code, response.json()

            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as executor:
            future1 = executor.submit(send_request, first)
            future2 = executor.submit(send_request, second)

            # Release both requests together
            barrier.wait(timeout=15)

            return (
                future1.result(timeout=30),
                future2.result(timeout=30)
            )

    def checkout_payload(self, checkout_id):
        return {
            "checkout_id": str(checkout_id),
            "items": [
                {
                    "product_id": self.product.id,
                    "quantity": 2
                }
            ],
            "cash_received": "30.00"
        }

    # TEST 1
    # Same checkout ID submitted simultaneously
    def test_simultaneous_duplicate_checkout(self):
        payload = self.checkout_payload(uuid4())

        first, second = self.parallel_posts(
            "/api/sales/checkout/",
            payload,
            payload,
            self.cashier
        )

        self.assertEqual(
            sorted([first[0], second[0]]),
            [200, 201]
        )

        self.assertEqual(
            first[1]["id"],
            second[1]["id"]
        )

        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(SaleItem.objects.count(), 1)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)

        self.assertEqual(
            StockMovement.objects.filter(
                movement_type=StockMovement.Type.SOLD
            ).count(),
            1
        )

    # TEST 2
    # Two different customers compete for last stock
    def test_simultaneous_stock_competition(self):
        first_payload = self.checkout_payload(uuid4())
        second_payload = self.checkout_payload(uuid4())

        first, second = self.parallel_posts(
            "/api/sales/checkout/",
            first_payload,
            second_payload,
            self.cashier
        )

        self.assertEqual(
            sorted([first[0], second[0]]),
            [201, 400]
        )

        self.assertEqual(Sale.objects.count(), 1)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)

        self.assertEqual(
            StockMovement.objects.filter(
                movement_type=StockMovement.Type.SOLD
            ).count(),
            1
        )

    def create_refundable_sale(self):
        product = Product.objects.create(
            name="Return Test Product",
            barcode="CONCURRENT2001",
            price=Decimal("20.00"),
            stock=7
        )

        sale = Sale.objects.create(
            total_amount=Decimal("60.00"),
            payment_method=Sale.PaymentMethod.CASH,
            cash_received=Decimal("60.00"),
            change_amount=Decimal("0.00")
        )

        sale_item = SaleItem.objects.create(
            sale=sale,
            product=product,
            quantity=3,
            unit_price=Decimal("20.00")
        )

        return product, sale_item

    def refund_payload(
        self,
        sale_item,
        request_id,
        quantity,
        restock
    ):
        return {
            "refund_request_id": str(request_id),
            "sale_item_id": sale_item.id,
            "quantity": quantity,
            "restock": restock,
            "reason": "Concurrency test return"
        }

    # TEST 3
    # Same refund request submitted simultaneously
    def test_simultaneous_duplicate_refund(self):
        product, sale_item = self.create_refundable_sale()

        payload = self.refund_payload(
            sale_item,
            uuid4(),
            quantity=1,
            restock=True
        )

        first, second = self.parallel_posts(
            "/api/sales/refunds/",
            payload,
            payload,
            self.manager
        )

        self.assertEqual(
            sorted([first[0], second[0]]),
            [200, 201]
        )

        self.assertEqual(
            first[1]["id"],
            second[1]["id"]
        )

        self.assertEqual(Refund.objects.count(), 1)

        product.refresh_from_db()
        self.assertEqual(product.stock, 8)

        self.assertEqual(
            StockMovement.objects.filter(
                product=product,
                movement_type=StockMovement.Type.RETURNED
            ).count(),
            1
        )

    # TEST 4
    # Separate refunds must not exceed purchased quantity
    def test_simultaneous_excessive_refunds(self):
        product, sale_item = self.create_refundable_sale()

        first_payload = self.refund_payload(
            sale_item,
            uuid4(),
            quantity=2,
            restock=False
        )

        second_payload = self.refund_payload(
            sale_item,
            uuid4(),
            quantity=2,
            restock=False
        )

        first, second = self.parallel_posts(
            "/api/sales/refunds/",
            first_payload,
            second_payload,
            self.manager
        )

        self.assertEqual(
            sorted([first[0], second[0]]),
            [201, 400]
        )

        self.assertEqual(Refund.objects.count(), 1)

        refund = Refund.objects.first()

        self.assertEqual(refund.quantity, 2)
        self.assertEqual(
            refund.refund_amount,
            Decimal("40.00")
        )

        product.refresh_from_db()
        self.assertEqual(product.stock, 7)
