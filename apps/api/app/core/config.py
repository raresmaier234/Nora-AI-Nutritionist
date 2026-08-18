"""Application configuration, loaded from environment variables (or a .env file)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached so Settings() is only constructed once per process."""
    return Settings()
