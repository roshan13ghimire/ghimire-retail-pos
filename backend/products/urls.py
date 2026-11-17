
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from products.views import SupplierViewSet

from .views import (
    ProductViewSet,
    CategoryViewSet,
    ReceiveStockView,
    StockMovementListView,
    StockAdjustmentView,
)


# Register API routes
router = DefaultRouter()

router.register(
    "products",
    ProductViewSet,
    basename="product"
)

router.register(
    "categories",
    CategoryViewSet,
    basename="category"
)

router.register(
    "suppliers",
    SupplierViewSet,
    basename="supplier"
)

urlpatterns = [
    # Receive stock
    path(
        "products/<int:pk>/receive-stock/",
        ReceiveStockView.as_view()
    ),

    # Adjust stock
    path(
        "products/<int:pk>/adjust-stock/",
        StockAdjustmentView.as_view()
    ),

    # Stock movement history
    path(
        "stock-movements/",
        StockMovementListView.as_view()
    ),

    # Products and Categories endpoints
    path("", include(router.urls)),
]
