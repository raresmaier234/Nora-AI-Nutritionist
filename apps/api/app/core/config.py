"""Application configuration, loaded from environment variables (or a .env file)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchored to the project directory rather than the working directory, so scripts run from
# anywhere (scripts/, the repo root, a cron job) find the same .env the app does.
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Nora AI Nutritionist API"
    app_env: str = "development"
    debug: bool = True

    # Used only when running via `python -m app.main`; `uvicorn app.main:app` ignores these.
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    database_url: str
    secret_key: str

    # Comma-separated list of allowed origins, e.g. "http://localhost:8081,https://app.example.com"
    cors_origins: str = "http://localhost:8081"

    # Elasticsearch index behind food search (see app/services/food_index.py). Unset, food
    # search runs on PostgreSQL alone. `elasticsearch_index` is an alias, so a rebuild can
    # swap in a fresh index without downtime.
    elasticsearch_url: str | None = None
    elasticsearch_api_key: str | None = None
    elasticsearch_index: str = "foods"

    # Local Ollama used by the food ingestion pipeline. Extraction runs on this machine,
    # so there is no API key and no per-request cost.
    ollama_host: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.2:latest"
    ollama_timeout_seconds: float = 120.0

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached so Settings() is only constructed once per process."""
    return Settings()
