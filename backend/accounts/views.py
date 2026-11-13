
import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsPOSAdmin
from .serializers import (
    StaffCreateSerializer,
    StaffStatusSerializer,
)

User = get_user_model()


# Find the user's POS role
def get_user_role(user):
    if user.is_superuser:
        return "Admin"

    group_names = set(
        user.groups.values_list("name", flat=True)
    )

    if "Admin" in group_names:
        return "Admin"

    if "Manager" in group_names:
        return "Manager"

    if "Cashier" in group_names:
        return "Cashier"

    return None


# Format information about a user
def get_user_data(user):
    return {
        "id": user.id,
        "username": user.username,
        "role": get_user_role(user),
    }


# GET /api/auth/csrf/
@require_GET
def csrf_view(request):
    token = get_token(request)

    response = JsonResponse({
        "csrfToken": token
    })

    return response


# POST /api/auth/login/
@require_POST
@csrf_protect
def login_view(request):
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return JsonResponse(
            {"error": "Invalid JSON."},
            status=400
        )

    if not isinstance(data, dict):
        return JsonResponse(
            {"error": "Invalid request."},
            status=400
        )

    username = data.get("username", "")
    password = data.get("password", "")

    if not isinstance(username, str) or not isinstance(
        password, str
    ):
        return JsonResponse(
            {"error": "Invalid credentials."},
            status=400
        )

    user = authenticate(
        request,
        username=username,
        password=password
    )

    if user is None:
        return JsonResponse(
            {"error": "Invalid username or password."},
            status=401
        )

    role = get_user_role(user)

    if role is None:
        return JsonResponse(
            {"error": "No POS role assigned."},
            status=403
        )

    # Django creates the login session
    login(request, user)

    return JsonResponse({
        "message": "Login successful.",
        "user": get_user_data(user)
    })


# GET /api/auth/me/
@require_GET
def current_user_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({
            "authenticated": False,
            "user": None
        })

    return JsonResponse({
        "authenticated": True,
        "user": get_user_data(request.user)
    })


# POST /api/auth/logout/
@require_POST
@csrf_protect
def logout_view(request):
    logout(request)

    return JsonResponse({
        "message": "Logout successful."
    })


class StaffView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsPOSAdmin]

    def get(self, request):
        users = (
            User.objects.filter(
                is_superuser=False,
                groups__name__in=["Cashier", "Manager"]
            )
            .distinct()
            .prefetch_related("groups")
            .order_by("username")
        )

        data = [
            {
                "id": user.id,
                "username": user.username,
                "role": get_user_role(user),
                "is_active": user.is_active,
            }
            for user in users
        ]

        return Response(data)

    def post(self, request):
        serializer = StaffCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        try:
            with transaction.atomic():
                group, _ = Group.objects.get_or_create(
                    name=data["role"]
                )

                user = User.objects.create_user(
                    username=data["username"],
                    password=data["password"],
                    is_staff=False,
                    is_superuser=False,
                )

                user.groups.add(group)

        except IntegrityError:
            return Response(
                {"username": ["Username already exists."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "role": data["role"],
                "is_active": user.is_active,
            },
            status=status.HTTP_201_CREATED
        )


class StaffDetailView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsPOSAdmin]

    def patch(self, request, pk):
        serializer = StaffStatusSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        user = get_object_or_404(
            User.objects.filter(
                is_superuser=False,
                groups__name__in=["Cashier", "Manager"]
            ).distinct(),
            pk=pk
        )

        user.is_active = serializer.validated_data[
            "is_active"
        ]
        user.save(update_fields=["is_active"])

        return Response({
            "id": user.id,
            "username": user.username,
            "role": get_user_role(user),
            "is_active": user.is_active,
        })
