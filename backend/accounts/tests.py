
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from datetime import timedelta

from django.conf import settings
from django.contrib.sessions.models import Session
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient


User = get_user_model()


class POSPermissionTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        # Create test groups
        admin_group = Group.objects.create(name="Admin")
        manager_group = Group.objects.create(name="Manager")
        cashier_group = Group.objects.create(name="Cashier")

        # Create test users
        cls.admin = User.objects.create_superuser(
            username="testadmin",
            password="TestPassword123!"
        )

        cls.manager = User.objects.create_user(
            username="testmanager",
            password="TestPassword123!"
        )
        cls.manager.groups.add(manager_group)

        cls.cashier = User.objects.create_user(
            username="testcashier",
            password="TestPassword123!"
        )
        cls.cashier.groups.add(cashier_group)

    def request_as(self, user, method, url, data=None):
        client = APIClient()

        if user is not None:
            client.force_authenticate(user=user)

        return getattr(client, method)(
            url,
            data=data,
            format="json"
        )

    # Test that users can access only allowed APIs
    def test_read_permissions(self):
        endpoints = [
            (
                "/api/products/",
                [self.admin, self.manager, self.cashier]
            ),
            (
                "/api/stock-movements/",
                [self.admin, self.manager]
            ),
            (
                "/api/sales/",
                [self.admin, self.manager]
            ),
            (
                "/api/sales/dashboard/",
                [self.admin, self.manager]
            ),
            (
                "/api/sales/report/",
                [self.admin, self.manager]
            ),
            (
                "/api/sales/refunds/",
                [self.admin, self.manager]
            ),
            (
                "/api/auth/staff/",
                [self.admin]
            ),
        ]

        all_users = [
            self.admin,
            self.manager,
            self.cashier,
            None,  # Logged-out user
        ]

        for url, allowed_users in endpoints:
            for user in all_users:
                with self.subTest(
                    url=url,
                    user=getattr(user, "username", "anonymous")
                ):
                    response = self.request_as(
                        user, "get", url
                    )

                    if user in allowed_users:
                        self.assertEqual(
                            response.status_code, 200
                        )
                    else:
                        self.assertIn(
                            response.status_code,
                            [401, 403]
                        )

    # Cashier cannot edit product prices
    def test_cashier_cannot_edit_products(self):
        response = self.request_as(
            self.cashier,
            "patch",
            "/api/products/999999/",
            {"price": "1.00"}
        )

        self.assertEqual(response.status_code, 403)

    # Cashier cannot process refunds
    def test_cashier_cannot_process_refunds(self):
        response = self.request_as(
            self.cashier,
            "post",
            "/api/sales/refunds/",
            {}
        )

        self.assertEqual(response.status_code, 403)

    # Cashier cannot manage staff
    def test_cashier_cannot_create_users(self):
        response = self.request_as(
            self.cashier,
            "post",
            "/api/auth/staff/",
            {
                "username": "unauthorizeduser",
                "password": "TestPassword123!",
                "role": "Manager",
            }
        )

        self.assertEqual(response.status_code, 403)

        self.assertFalse(
            User.objects.filter(
                username="unauthorizeduser"
            ).exists()
        )

    # Admin can create staff
    def test_admin_can_create_cashier(self):
        response = self.request_as(
            self.admin,
            "post",
            "/api/auth/staff/",
            {
                "username": "newcashier",
                "password": "StrongTestPassword123!",
                "role": "Cashier",
            }
        )

        self.assertEqual(response.status_code, 201)

        user = User.objects.get(username="newcashier")

        self.assertTrue(
            user.groups.filter(name="Cashier").exists()
        )

        self.assertTrue(
            user.check_password("StrongTestPassword123!")
        )

        self.assertFalse(user.is_superuser)

    # Inactive accounts must be rejected
    def test_inactive_cashier_cannot_access_products(self):
        self.cashier.is_active = False
        self.cashier.save(update_fields=["is_active"])

        response = self.request_as(
            self.cashier,
            "get",
            "/api/products/"
        )

        self.assertEqual(response.status_code, 403)

class SessionAuthenticationTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser(
            username="sessionadmin",
            password="TestPassword123!"
        )

    def setUp(self):
        # Unlike earlier tests, enforce real CSRF checks
        self.client = APIClient(
            enforce_csrf_checks=True
        )

    def get_csrf_token(self):
        response = self.client.get(
            "/api/auth/csrf/"
        )

        self.assertEqual(response.status_code, 200)

        return response.json()["csrfToken"]

    def login_admin(self):
        token = self.get_csrf_token()

        return self.client.post(
            "/api/auth/login/",
            {
                "username": "sessionadmin",
                "password": "TestPassword123!"
            },
            format="json",
            HTTP_X_CSRFTOKEN=token
        )

    # 1. Valid login creates a session
    def test_successful_login(self):
        response = self.login_admin()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["user"]["role"],
            "Admin"
        )

        # A real session cookie should exist
        self.assertIn(
            settings.SESSION_COOKIE_NAME,
            self.client.cookies
        )

        me_response = self.client.get(
            "/api/auth/me/"
        )

        self.assertEqual(me_response.status_code, 200)
        self.assertTrue(
            me_response.json()["authenticated"]
        )

        self.assertEqual(
            me_response.json()["user"]["username"],
            "sessionadmin"
        )

    # 2. Incorrect password is rejected
    def test_invalid_password(self):
        token = self.get_csrf_token()

        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "sessionadmin",
                "password": "wrong-password"
            },
            format="json",
            HTTP_X_CSRFTOKEN=token
        )

        self.assertEqual(response.status_code, 401)

        me_response = self.client.get(
            "/api/auth/me/"
        )

        self.assertFalse(
            me_response.json()["authenticated"]
        )

    # 3. Login without CSRF is rejected
    def test_login_requires_csrf(self):
        self.get_csrf_token()

        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "sessionadmin",
                "password": "TestPassword123!"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 403)

        me_response = self.client.get(
            "/api/auth/me/"
        )

        self.assertFalse(
            me_response.json()["authenticated"]
        )

    # 4. Logout without CSRF is rejected
    def test_logout_requires_csrf(self):
        login_response = self.login_admin()

        self.assertEqual(
            login_response.status_code,
            200
        )

        response = self.client.post(
            "/api/auth/logout/",
            {},
            format="json"
        )

        self.assertEqual(response.status_code, 403)

        # The session must still be active
        me_response = self.client.get(
            "/api/auth/me/"
        )

        self.assertTrue(
            me_response.json()["authenticated"]
        )

    # 5. Valid logout clears the session
    def test_successful_logout(self):
        login_response = self.login_admin()

        self.assertEqual(
            login_response.status_code,
            200
        )

        # Login rotates CSRF tokens, get a fresh one
        token = self.get_csrf_token()

        response = self.client.post(
            "/api/auth/logout/",
            {},
            format="json",
            HTTP_X_CSRFTOKEN=token
        )

        self.assertEqual(response.status_code, 200)

        me_response = self.client.get(
            "/api/auth/me/"
        )

        self.assertFalse(
            me_response.json()["authenticated"]
        )

    # 6. Protected POST requires CSRF
    def test_staff_creation_requires_csrf(self):
        login_response = self.login_admin()

        self.assertEqual(
            login_response.status_code,
            200
        )

        # Logged-in Admin, but no CSRF header
        response = self.client.post(
            "/api/auth/staff/",
            {
                "username": "blockedcashier",
                "password": "StrongPassword123!",
                "role": "Cashier"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 403)

        # Verify the user was not created
        self.assertFalse(
            User.objects.filter(
                username="blockedcashier"
            ).exists()
        )

    # 7. Expired session is rejected
    def test_expired_session(self):
        login_response = self.login_admin()

        self.assertEqual(
            login_response.status_code,
            200
        )

        session_key = self.client.cookies[
            settings.SESSION_COOKIE_NAME
        ].value

        # Simulate expiry in the database
        updated = Session.objects.filter(
            session_key=session_key
        ).update(
            expire_date=(
                timezone.now()
                - timedelta(minutes=1)
            )
        )

        self.assertEqual(updated, 1)

        me_response = self.client.get(
            "/api/auth/me/"
        )

        self.assertEqual(
            me_response.status_code,
            200
        )

        self.assertFalse(
            me_response.json()["authenticated"]
        )
