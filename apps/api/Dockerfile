FROM python:3.13-slim

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app

RUN pip install --no-cache-dir .

# Migrations run from the image before each deploy (railway.toml: preDeployCommand).
COPY alembic.ini ./
COPY alembic ./alembic

EXPOSE 8000

# Hosts like Railway assign the port through $PORT; locally it falls back to 8000.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
