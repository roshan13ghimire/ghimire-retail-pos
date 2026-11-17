
# Stage 1: Build React
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./

RUN npm ci

COPY frontend/ ./

RUN npm run build


# Stage 2: Django application
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app/backend

COPY backend/requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy compiled React assets
COPY --from=frontend-build \
    /app/frontend/dist \
    /app/frontend/dist

# Collect static files without using real secrets
RUN DJANGO_SECRET_KEY=temporary-build-only \
    DB_NAME=build_placeholder \
    DB_USER=build_placeholder \
    DB_PASSWORD=build_placeholder \
    DB_HOST=localhost \
    python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --access-logfile - --error-logfile -"]
