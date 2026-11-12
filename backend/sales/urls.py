
from django.urls import path

from .views import (
    CheckoutView,
    SaleListView,
    SaleDetailView,
)

urlpatterns = [
    path("checkout/", CheckoutView.as_view()),
    path("", SaleListView.as_view()),
    path("<int:pk>/", SaleDetailView.as_view()),
]
