
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProductViewSet,
    ReceiveStockView,
    StockMovementListView,
    StockAdjustmentView,
)

router = DefaultRouter()
router.register("products", ProductViewSet)

urlpatterns = [
    path(
        "products/<int:pk>/receive-stock/",
        ReceiveStockView.as_view()
    ),

    path(
        "stock-movements/",
        StockMovementListView.as_view()
    ),

    path("", include(router.urls)),
    
    path(
    "products/<int:pk>/adjust-stock/",
    StockAdjustmentView.as_view()
),
]
