
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from rest_framework.test import APITestCase

from .models import Product, StockMovement, Supplier
from uuid import uuid4


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
    
    def test_dashboard_uses_custom_reorder_level(self):
        # Product currently has 10 units.

        # Threshold above stock: should be low stock
        self.product.reorder_level = 12
        self.product.save(update_fields=["reorder_level"])

        response = self.client.get(
            "/api/sales/dashboard/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["low_stock_count"],
            1
        )

        # Threshold below stock: no longer low stock
        self.product.reorder_level = 5
        self.product.save(update_fields=["reorder_level"])

        response = self.client.get(
            "/api/sales/dashboard/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["low_stock_count"],
            0
        )


    def test_manager_can_update_reorder_level(self):
        response = self.client.patch(
            f"/api/products/{self.product.id}/",
            {"reorder_level": 15},
            format="json"
        )

        self.assertEqual(response.status_code, 200)

        self.product.refresh_from_db()

        self.assertEqual(
            self.product.reorder_level,
            15
        )

        # Changing the threshold must not change stock
        self.assertEqual(self.product.stock, 10)

        # It must not create inventory movements
        self.assertEqual(
            StockMovement.objects.count(),
            0
        )
    def test_manager_can_create_category(self):
        response = self.client.post(
            "/api/categories/",
            {"name": "Rice & Grains"},
            format="json"
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data["name"],
            "Rice & Grains"
        )

        # Assign the category to a product
        category_id = response.data["id"]

        update_response = self.client.patch(
            f"/api/products/{self.product.id}/",
            {"category": category_id},
            format="json"
        )

        self.assertEqual(update_response.status_code, 200)

        self.product.refresh_from_db()
        self.assertEqual(
            self.product.category_id,
            category_id
        )



    def test_manager_can_create_supplier(self):
        response = self.client.post(
            "/api/suppliers/",
            {
                "name": "ABC Wholesale",
                "phone": "9800000000",
                "email": "abc@example.com",
                "address": "Kathmandu",
                "notes": "Rice and grocery distributor"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data["name"],
            "ABC Wholesale"
        )


    def test_cashier_cannot_create_supplier(self):
        self.client.force_authenticate(
            user=self.cashier
        )

        response = self.client.post(
            "/api/suppliers/",
            {
                "name": "Unauthorized Supplier"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 403)


    def test_cashier_can_view_suppliers(self):
        self.client.force_authenticate(
            user=self.cashier
        )

        response = self.client.get(
            "/api/suppliers/"
        )

        self.assertEqual(response.status_code, 200)

    
    def test_receive_stock_with_supplier_and_cost(self):
        supplier = Supplier.objects.create(
            name="ABC Wholesale"
        )

        response = self.client.post(
            self.receive_url(),
            {
                "quantity": 20,
                "supplier": supplier.id,
                "purchase_unit_cost": "400.00",
                "reference": "INV-1001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 30)

        movement = StockMovement.objects.get(
            product=self.product,
            movement_type=StockMovement.Type.RECEIVED,
        )

        self.assertEqual(movement.supplier, supplier)
        self.assertEqual(
            movement.purchase_unit_cost,
            Decimal("400.00"),
        )
        self.assertEqual(movement.reference, "INV-1001")
        self.assertEqual(movement.quantity, 20)
        self.assertEqual(movement.performed_by, self.manager)

        self.assertEqual(
            Decimal(response.data["total_purchase_cost"]),
            Decimal("8000.00"),
        )

    def test_receive_stock_rejects_missing_purchase_cost(self):
        supplier = Supplier.objects.create(
            name="ABC Wholesale"
        )

        response = self.client.post(
            self.receive_url(),
            {
                "quantity": 20,
                "supplier": supplier.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 10)
        self.assertEqual(StockMovement.objects.count(), 0)


    def test_duplicate_receiving_does_not_increase_stock_twice(self):
        supplier = Supplier.objects.create(
            name="ABC Wholesale"
        )

        request_id = str(uuid4())

        payload = {
            "quantity": 20,
            "supplier": supplier.id,
            "purchase_unit_cost": "400.00",
            "reference": "INV-1001",
            "receipt_request_id": request_id,
        }

        # First receiving request
        first = self.client.post(
            self.receive_url(),
            payload,
            format="json",
        )

        self.assertEqual(first.status_code, 200)
        self.assertFalse(first.data["already_processed"])

        # Simulate retry after a network problem
        second = self.client.post(
            self.receive_url(),
            payload,
            format="json",
        )

        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data["already_processed"])
        self.assertEqual(second.data["quantity_added"], 0)

        self.assertEqual(
            first.data["stock_movement_id"],
            second.data["stock_movement_id"],
        )

        # Initial stock was 10, so final stock must be 30.
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 30)

        # Only one inventory movement exists.
        self.assertEqual(
            StockMovement.objects.filter(
                movement_type=StockMovement.Type.RECEIVED
            ).count(),
            1,
        )


    def test_same_receipt_id_with_different_details_is_rejected(self):
        request_id = str(uuid4())

        first = self.client.post(
            self.receive_url(),
            {
                "quantity": 20,
                "receipt_request_id": request_id,
            },
            format="json",
        )

        self.assertEqual(first.status_code, 200)

        # Different quantity with the same UUID.
        second = self.client.post(
            self.receive_url(),
            {
                "quantity": 50,
                "receipt_request_id": request_id,
            },
            format="json",
        )

        self.assertEqual(second.status_code, 409)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 30)

        self.assertEqual(
            StockMovement.objects.count(),
            1,
        )
