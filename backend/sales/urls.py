
from django.urls import path
from .views import DashboardView
from .views import DailySalesReportView
from .views import RefundView

from .views import (
    CheckoutView,
    SaleListView,
    SaleDetailView,
)

urlpatterns = [
    path("checkout/", CheckoutView.as_view()),
    path("", SaleListView.as_view()),
    path("<int:pk>/", SaleDetailView.as_view()),
    path("dashboard/", DashboardView.as_view()),
    path("report/", DailySalesReportView.as_view()),
    path("refunds/", RefundView.as_view()),
]
