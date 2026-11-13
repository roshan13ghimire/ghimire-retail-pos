
from django.urls import path
from .views import StaffView, StaffDetailView

from .views import (
    csrf_view,
    login_view,
    logout_view,
    current_user_view,
)

urlpatterns = [
    path("csrf/", csrf_view),
    path("login/", login_view),
    path("logout/", logout_view),
    path("me/", current_user_view),
    path("staff/", StaffView.as_view()),
    path("staff/<int:pk>/", StaffDetailView.as_view()),
]
