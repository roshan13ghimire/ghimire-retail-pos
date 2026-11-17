
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from rest_framework.test import APITestCase

from .models import Product, StockMovement


User = get_user_model()


class InventoryTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        manager_group = Group.objects.create(
            name="Manager"
        )

        cashier_group = Group.objects.create(
            name="Cashier"
        )

        cls.manager = User.objects.create_user(
            username="inventorymanager",
            password="TestPassword123!"
        )
        cls.manager.groups.add(manager_group)

        cls.cashier = User.objects.create_user(
            username="inventorycashier",
            password="TestPassword123!"
        )
        cls.cashier.groups.add(cashier_group)

        cls.product = Product.objects.create(
            name="Test Rice",
            barcode="RICE1001",
            price=Decimal("50.00"),
            stock=10
        )

    def setUp(self):
        self.client.force_authenticate(
            user=self.manager
        )

    def receive_url(self):
        return (
            f"/api/products/{self.product.id}/"
            "receive-stock/"
        )

    def adjust_url(self):
        return (
            f"/api/products/{self.product.id}/"
            "adjust-stock/"
        )

    # 1. Receiving stock increases quantity
    def test_receive_stock(self):
        response = self.client.post(
            self.receive_url(),
            {"quantity": 5},
            format="json"
        )

        self.assertEqual(response.status_code, 200)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 15)

        movement = StockMovement.objects.get(
            product=self.product
        )

        self.assertEqual(
            movement.movement_type,
            StockMovement.Type.RECEIVED
        )
        self.assertEqual(movement.quantity, 5)

    # 2. Invalid quantity cannot be received
    def test_invalid_receive_quantity(self):
        response = self.client.post(
            self.receive_url(),
            {"quantity": -5},
            format="json"
        )

        self.assertEqual(response.status_code, 400)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

        self.assertEqual(
            StockMovement.objects.count(),
            0
        )

    # 3. Adjust stock upward
    def test_adjust_stock_up(self):
        response = self.client.post(
            self.adjust_url(),
            {
                "counted_stock": 15,
                "reason": "Physical count correction"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 200)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 15)

        movement = StockMovement.objects.get(
            product=self.product
        )

        self.assertEqual(
            movement.movement_type,
            StockMovement.Type.ADJUST_IN
        )
        self.assertEqual(movement.quantity, 5)
        self.assertEqual(
            movement.reason,
            "Physical count correction"
        )

    # 4. Adjust stock downward
    def test_adjust_stock_down(self):
        response = self.client.post(
            self.adjust_url(),
            {
                "counted_stock": 7,
                "reason": "3 damaged items"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 200)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 7)

        movement = StockMovement.objects.get(
            product=self.product
        )

        self.assertEqual(
            movement.movement_type,
            StockMovement.Type.ADJUST_OUT
        )
        self.assertEqual(movement.quantity, 3)

    # 5. Reason is required for adjustments
    def test_adjustment_requires_reason(self):
        response = self.client.post(
            self.adjust_url(),
            {
                "counted_stock": 5,
                "reason": ""
            },
            format="json"
        )

        self.assertEqual(response.status_code, 400)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

        self.assertEqual(
            StockMovement.objects.count(),
            0
        )

    # 6. Stock cannot become negative
    def test_negative_stock_is_rejected(self):
        response = self.client.post(
            self.adjust_url(),
            {
                "counted_stock": -3,
                "reason": "Invalid count"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 400)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

    # 7. Cashier cannot modify inventory
    def test_cashier_cannot_modify_stock(self):
        self.client.force_authenticate(
            user=self.cashier
        )

        receive_response = self.client.post(
            self.receive_url(),
            {"quantity": 5},
            format="json"
        )

        adjust_response = self.client.post(
            self.adjust_url(),
            {
                "counted_stock": 5,
                "reason": "Unauthorized adjustment"
            },
            format="json"
        )

        self.assertEqual(
            receive_response.status_code, 403
        )
        self.assertEqual(
            adjust_response.status_code, 403
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

        self.assertEqual(
            StockMovement.objects.count(),
            0
        )

    # 8. Stock cannot be edited directly
    def test_direct_stock_edit_is_rejected(self):
        response = self.client.patch(
            f"/api/products/{self.product.id}/",
            {"stock": 100},
            format="json"
        )

        self.assertEqual(response.status_code, 400)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)

        self.assertEqual(
            StockMovement.objects.count(),
            0
        )
    
    def test_receiving_stock_records_employee(self):
        response = self.client.post(
            self.receive_url(),
            {"quantity": 5},
            format="json"
        )

        self.assertEqual(response.status_code, 200)

        movement = StockMovement.objects.get(
            product=self.product
        )

        self.assertEqual(
            movement.performed_by_id,
            self.manager.id
        )


    def test_adjustment_records_employee(self):
        response = self.client.post(
            self.adjust_url(),
            {
                "counted_stock": 7,
                "reason": "Physical count correction"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 200)

        movement = StockMovement.objects.get(
            product=self.product
        )

        self.assertEqual(
            movement.performed_by_id,
            self.manager.id
        )
