
from rest_framework.permissions import BasePermission


def has_pos_role(user, allowed_roles):
    """
    Check whether a user belongs to an allowed POS role.
    """
    if not user or not user.is_authenticated:
        return False

    if not user.is_active:
        return False

    # Django superusers have full POS access
    if user.is_superuser:
        return True

    return user.groups.filter(
        name__in=allowed_roles
    ).exists()


class IsPOSAdmin(BasePermission):
    message = "Admin access is required."

    def has_permission(self, request, view):
        return has_pos_role(
            request.user,
            ["Admin"]
        )


class IsManagerOrAdmin(BasePermission):
    message = "Manager or Admin access is required."

    def has_permission(self, request, view):
        return has_pos_role(
            request.user,
            ["Admin", "Manager"]
        )


class IsPOSStaff(BasePermission):
    message = "An active POS staff account is required."

    def has_permission(self, request, view):
        return has_pos_role(
            request.user,
            ["Admin", "Manager", "Cashier"]
        )


class ProductPermission(BasePermission):
    """
    All staff can view products.

    Admin and Manager can:
    - Create products
    - Edit products
    - Receive stock
    - Adjust stock

    Product deletion is disabled.
    """

    message = "You do not have permission for this action."

    def has_permission(self, request, view):
        user = request.user

        if not has_pos_role(
            user,
            ["Admin", "Manager", "Cashier"]
        ):
            return False

        action = getattr(view, "action", None)

        # Product lookup for POS checkout
        if action in ["list", "retrieve"]:
            return True

        # Inventory and product management
        management_actions = [
            "create",
            "update",
            "partial_update",
            "receive_stock",
            "adjust_stock",
        ]

        if action in management_actions:
            return has_pos_role(
                user,
                ["Admin", "Manager"]
            )

        # Reject delete and unknown actions
        return False
