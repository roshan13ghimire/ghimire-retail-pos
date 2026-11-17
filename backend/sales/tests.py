
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from rest_framework.test import APITestCase, APIClient

from products.models import Product, StockMovement
from .models import Sale, SaleItem,Refund


User = get_user_model()


class CheckoutTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        cashier_group = Group.objects.create(
            name="Cashier"
        )

        cls.cashier = User.objects.create_user(
            username="checkoutcashier",
            password="TestPassword123!"
        )
        cls.cashier.groups.add(cashier_group)

        cls.product = Product.objects.create(
            name="Test Product",
            barcode="TEST1001",
            price=Decimal("12.50"),
            stock=10
        )

    def setUp(self):
        # Authenticate as Cashier for each test
        self.client.force_authenticate(
            user=self.cashier
        )

    def checkout_payload(
        self,
        checkout_id=None,
        quantity=2,
        cash_received="30.00"
    ):
        return {
            "checkout_id": str(
                checkout_id or uuid4()
            ),
            "items": [
                {
                    "product_id": self.product.id,
                    "quantity": quantity
                }
            ],
            "cash_received": cash_received
        }

    # 1. Successful checkout
    def test_successful_checkout(self):
        payload = self.checkout_payload()

        response = self.client.post(
            "/api/sales/checkout/",
            payload,
            format="json"
        )

        self.assertEqual(response.status_code, 201)

        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(SaleItem.objects.count(), 1)

        sale = Sale.objects.first()

        self.assertEqual(
            sale.total_amount,
            Decimal("25.00")
        )
        self.assertEqual(
            sale.cash_received,
            Decimal("30.00")
        )
        self.assertEqual(
            sale.change_amount,
            Decimal("5.00")
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 8)

        self.assertEqual(
            StockMovement.objects.filter(
                product=self.product,
                movement_type=StockMovement.Type.SOLD,
                quantity=2
            ).count(),
            1
        )

    # 2. Duplicate checkout must not create another sale
    def test_duplicate_checkout(self):
        checkout_id = uuid4()

        payload = self.checkout_payload(
            checkout_id=checkout_id
        )

        first = self.client.post(
            "/api/sales/checkout/",
            payload,
            format="json"
        )

        second = self.client.post(
            "/api/sales/checkout/",
            payload,
            format="json"
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)

        self.assertEqual(
            first.data["id"],
            second.data["id"]
        )

        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(SaleItem.objects.count(), 1)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 8)

        self.assertEqual(
            StockMovement.objects.filter(
                movement_type=StockMovement.Type.SOLD
            ).count(),
            1
        )

    # 3. Reusing checkout ID with different payment is invalid
    def test_checkout_id_cannot_be_reused_with_new_payment(self):
        checkout_id = uuid4()

        first_payload = self.checkout_payload(
            checkout_id=checkout_id,
            cash_received="30.00"
        )

        first = self.client.post(
            "/api/sales/checkout/",
            first_payload,
            format="json"
        )

        self.assertEqual(first.status_code, 201)

        changed_payload = self.checkout_payload(
            checkout_id=checkout_id,
            cash_received="40.00"
        )

        second = self.client.post(
            "/api/sales/checkout/",
            changed_payload,
            format="json"
        )

        self.assertEqual(second.status_code, 400)
        self.assertEqual(Sale.objects.count(), 1)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 8)

    # 4. Insufficient cash
    def test_insufficient_cash(self):
        payload = self.checkout_payload(
            cash_received="10.00"
        )

        response = self.client.post(
            "/api/sales/checkout/",
            payload,
            format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Sale.objects.count(), 0)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

        self.assertFalse(
            StockMovement.objects.filter(
                movement_type=StockMovement.Type.SOLD
            ).exists()
        )

    # 5. Insufficient inventory
    def test_insufficient_stock(self):
        payload = self.checkout_payload(
            quantity=15,
            cash_received="200.00"
        )

        response = self.client.post(
            "/api/sales/checkout/",
            payload,
            format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Sale.objects.count(), 0)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

        self.assertFalse(
            StockMovement.objects.filter(
                movement_type=StockMovement.Type.SOLD
            ).exists()
        )

    # 6. Anonymous user cannot checkout
    def test_anonymous_checkout_is_rejected(self):
        anonymous_client = APIClient()

        payload = self.checkout_payload()

        response = anonymous_client.post(
            "/api/sales/checkout/",
            payload,
            format="json"
        )

        self.assertIn(
            response.status_code,
            [401, 403]
        )

        self.assertEqual(Sale.objects.count(), 0)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

    def test_checkout_records_cashier(self):
        response = self.client.post(
            "/api/sales/checkout/",
            self.checkout_payload(),
            format="json"
        )

        self.assertEqual(response.status_code, 201)

        sale = Sale.objects.get()
        self.assertEqual(
            sale.created_by_id,
            self.cashier.id
        )
    def test_sale_stock_movement_records_cashier(self):
        response = self.client.post(
            "/api/sales/checkout/",
            self.checkout_payload(),
            format="json"
        )

        self.assertEqual(response.status_code, 201)

        movement = StockMovement.objects.get(
            movement_type=StockMovement.Type.SOLD
        )

        self.assertEqual(
            movement.performed_by_id,
            self.cashier.id
        )

class RefundTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        manager_group = Group.objects.create(
            name="Manager"
        )

        cashier_group = Group.objects.create(
            name="Cashier"
        )

        cls.manager = User.objects.create_user(
            username="refundmanager",
            password="TestPassword123!"
        )
        cls.manager.groups.add(manager_group)

        cls.cashier = User.objects.create_user(
            username="refundcashier",
            password="TestPassword123!"
        )
        cls.cashier.groups.add(cashier_group)

        # Product currently has 7 units in stock
        cls.product = Product.objects.create(
            name="Test Rice",
            barcode="REFUND1001",
            price=Decimal("20.00"),
            stock=7
        )

        # Existing cash sale: 3 units at 20 each
        cls.sale = Sale.objects.create(
            total_amount=Decimal("60.00"),
            payment_method=Sale.PaymentMethod.CASH,
            cash_received=Decimal("60.00"),
            change_amount=Decimal("0.00")
        )

        cls.sale_item = SaleItem.objects.create(
            sale=cls.sale,
            product=cls.product,
            quantity=3,
            unit_price=Decimal("20.00")
        )

    def setUp(self):
        self.client.force_authenticate(
            user=self.manager
        )

    def refund_payload(
        self,
        request_id=None,
        quantity=1,
        restock=True,
        reason="Customer returned item"
    ):
        return {
            "refund_request_id": str(
                request_id or uuid4()
            ),
            "sale_item_id": self.sale_item.id,
            "quantity": quantity,
            "restock": restock,
            "reason": reason
        }

    def submit_refund(self, payload):
        return self.client.post(
            "/api/sales/refunds/",
            payload,
            format="json"
        )

    # 1. Sellable return restores inventory
    def test_sellable_refund(self):
        # Current product price changes after sale
        self.product.price = Decimal("25.00")
        self.product.save(update_fields=["price"])

        response = self.submit_refund(
            self.refund_payload(
                quantity=1,
                restock=True
            )
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Refund.objects.count(), 1)

        refund = Refund.objects.first()

        # Must use original selling price
        self.assertEqual(
            refund.refund_amount,
            Decimal("20.00")
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 8)

        movement = StockMovement.objects.get(
            product=self.product
        )

        self.assertEqual(
            movement.movement_type,
            StockMovement.Type.RETURNED
        )

        self.assertEqual(movement.quantity, 1)

        # Original sale must remain unchanged
        self.sale.refresh_from_db()

        self.assertEqual(
            self.sale.total_amount,
            Decimal("60.00")
        )

    # 2. Damaged return does not restore stock
    def test_damaged_refund(self):
        response = self.submit_refund(
            self.refund_payload(
                quantity=2,
                restock=False,
                reason="Damaged packaging"
            )
        )

        self.assertEqual(response.status_code, 201)

        refund = Refund.objects.first()

        self.assertEqual(
            refund.refund_amount,
            Decimal("40.00")
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 7)

        self.assertEqual(
            StockMovement.objects.count(),
            0
        )

    # 3. Partial returns cannot exceed purchased quantity
    def test_partial_refunds(self):
        first = self.submit_refund(
            self.refund_payload(
                quantity=2,
                restock=False
            )
        )

        second = self.submit_refund(
            self.refund_payload(
                quantity=1,
                restock=False
            )
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)

        # All 3 units have now been refunded
        third = self.submit_refund(
            self.refund_payload(
                quantity=1,
                restock=False
            )
        )

        self.assertEqual(third.status_code, 400)

        self.assertEqual(Refund.objects.count(), 2)

        self.assertEqual(
            sum(
                refund.quantity
                for refund in Refund.objects.all()
            ),
            3
        )

    # 4. Cannot refund more than originally purchased
    def test_excessive_refund(self):
        response = self.submit_refund(
            self.refund_payload(quantity=4)
        )

        self.assertEqual(response.status_code, 400)

        self.assertEqual(Refund.objects.count(), 0)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 7)

    # 5. Duplicate refund cannot restore stock twice
    def test_duplicate_refund(self):
        request_id = uuid4()

        payload = self.refund_payload(
            request_id=request_id,
            quantity=1,
            restock=True
        )

        first = self.submit_refund(payload)
        second = self.submit_refund(payload)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)

        self.assertEqual(
            first.data["id"],
            second.data["id"]
        )

        self.assertEqual(Refund.objects.count(), 1)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 8)

        self.assertEqual(
            StockMovement.objects.filter(
                movement_type=StockMovement.Type.RETURNED
            ).count(),
            1
        )

    # 6. Same request ID cannot be reused
    # with different refund details
    def test_reused_refund_id(self):
        request_id = uuid4()

        first = self.submit_refund(
            self.refund_payload(
                request_id=request_id,
                quantity=1,
                restock=False
            )
        )

        second = self.submit_refund(
            self.refund_payload(
                request_id=request_id,
                quantity=2,
                restock=False
            )
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)

        self.assertEqual(Refund.objects.count(), 1)

    # 7. Refund reason is required
    def test_refund_requires_reason(self):
        response = self.submit_refund(
            self.refund_payload(reason="")
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Refund.objects.count(), 0)

    # 8. Cashier cannot process refunds
    def test_cashier_cannot_refund(self):
        self.client.force_authenticate(
            user=self.cashier
        )

        response = self.submit_refund(
            self.refund_payload()
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Refund.objects.count(), 0)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 7)

    # 9. Unauthenticated users cannot refund
    def test_anonymous_cannot_refund(self):
        self.client.force_authenticate(user=None)

        response = self.submit_refund(
            self.refund_payload()
        )

        self.assertIn(
            response.status_code,
            [401, 403]
        )

        self.assertEqual(Refund.objects.count(), 0)

    # 10. Manager can view refund history
    def test_manager_can_view_refunds(self):
        self.submit_refund(
            self.refund_payload(
                quantity=1,
                restock=False
            )
        )

        response = self.client.get(
            "/api/sales/refunds/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

        self.assertEqual(
            response.data[0]["refund_amount"],
            "20.00"
        )

    def test_refund_records_employee(self):
        response = self.submit_refund(
            self.refund_payload(
                quantity=1,
                restock=False
            )
        )

        self.assertEqual(response.status_code, 201)

        refund = Refund.objects.get()
        self.assertEqual(
            refund.processed_by_id,
            self.manager.id
        )
    def test_return_stock_movement_records_manager(self):
        response = self.submit_refund(
            self.refund_payload(
                quantity=1,
                restock=True
            )
        )

        self.assertEqual(response.status_code, 201)

        movement = StockMovement.objects.get(
            movement_type=StockMovement.Type.RETURNED
        )

        self.assertEqual(
            movement.performed_by_id,
            self.manager.id
        )
