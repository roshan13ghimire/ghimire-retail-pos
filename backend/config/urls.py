
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView


urlpatterns = [
    # Django Admin
    path("admin/", admin.site.urls),

    # Existing APIs
    path("api/", include("products.urls")),
    path("api/sales/", include("sales.urls")),
    path("api/auth/", include("accounts.urls")),

    # React application
    # This must remain the LAST URL pattern.
    re_path(
        r"^(?!(?:api|admin|static)(?:/|$)).*$",
        TemplateView.as_view(
            template_name="index.html"
        ),
        name="react-app",
    ),
]
