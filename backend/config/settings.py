
from pathlib import Path

from decouple import config


BASE_DIR = Path(__file__).resolve().parent.parent

# React production build directory
FRONTEND_DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
# -----------------------------------------
# Environment
# -----------------------------------------

APP_ENV = config(
    "APP_ENV",
    default="development"
).strip().lower()

if APP_ENV not in {
    "development",
    "demo",
    "production",
}:
    raise ValueError("Invalid APP_ENV value.")

IS_DEPLOYED = APP_ENV in {"demo", "production"}


# -----------------------------------------
# Security
# -----------------------------------------

# Never hardcode the actual secret key.
SECRET_KEY = config("DJANGO_SECRET_KEY")

# Demo and production always disable DEBUG.
DEBUG = not IS_DEPLOYED

ALLOWED_HOSTS = [
    host.strip()
    for host in config(
        "ALLOWED_HOSTS",
        default=(
            ""
            if IS_DEPLOYED
            else "localhost,127.0.0.1,[::1]"
        ),
    ).split(",")
    if host.strip()
]

if IS_DEPLOYED and not ALLOWED_HOSTS:
    raise ValueError(
        "ALLOWED_HOSTS must be configured "
        "for demo and production."
    )

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in config(
        "CSRF_TRUSTED_ORIGINS",
        default=(
            ""
            if IS_DEPLOYED
            else (
                "http://localhost:5173,"
                "http://127.0.0.1:5173"
            )
        ),
    ).split(",")
    if origin.strip()
]

SESSION_COOKIE_SECURE = IS_DEPLOYED
CSRF_COOKIE_SECURE = IS_DEPLOYED

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# Deployment must use HTTPS.
SECURE_SSL_REDIRECT = IS_DEPLOYED

# Enable only if the hosting provider uses a
# trusted proxy that sets this header securely.
if config(
    "TRUST_PROXY_HTTPS",
    default=False,
    cast=bool,
):
    SECURE_PROXY_SSL_HEADER = (
        "HTTP_X_FORWARDED_PROTO",
        "https",
    )

# Enable HSTS later after checking HTTPS
# and the final domain configuration.
SECURE_HSTS_SECONDS = 0


# -----------------------------------------
# Applications
# -----------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",

    "products",
    "sales",
    "accounts",
]


# -----------------------------------------
# Middleware
# -----------------------------------------

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"


# -----------------------------------------
# Templates
# -----------------------------------------

TEMPLATES = [
    {
        "BACKEND": (
            "django.template.backends.django.DjangoTemplates"
        ),
        "DIRS": [FRONTEND_DIST_DIR],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


WSGI_APPLICATION = "config.wsgi.application"


# -----------------------------------------
# PostgreSQL
# -----------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST"),
        "PORT": config("DB_PORT", default="5432"),

        # Encrypt connections to the cloud database.
        # Keep local development settings unchanged.
        "OPTIONS": (
            {"sslmode": "require"}
            if IS_DEPLOYED
            else {}
        ),
    }
}



# -----------------------------------------
# Password Validation
# -----------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


# -----------------------------------------
# Django REST Framework
# -----------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}


# -----------------------------------------
# Internationalization
# -----------------------------------------

LANGUAGE_CODE = "en-us"

TIME_ZONE = config(
    "APP_TIME_ZONE",
    default="UTC"
)

USE_I18N = True
USE_TZ = True


# -----------------------------------------
# Static Files
# -----------------------------------------


# -----------------------------------------
# Static Files
# -----------------------------------------

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

# Include React's compiled assets when available.
STATICFILES_DIRS = (
    [FRONTEND_DIST_DIR]
    if FRONTEND_DIST_DIR.is_dir()
    else []
)

STORAGES = {
    "default": {
        "BACKEND": (
            "django.core.files.storage."
            "FileSystemStorage"
        ),
    },
    "staticfiles": {
        "BACKEND": (
            "whitenoise.storage."
            "CompressedStaticFilesStorage"
        ),
    },
}
