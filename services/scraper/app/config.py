"""Configuración del servicio, validada al importar (pydantic-settings).

Mismo principio que las apps Node: si falta una variable requerida, la app
no arranca. Nada de parámetros de negocio aquí — la config de cada fuente de
scraping vive en la tabla `ScrapingSource` de Postgres.
"""

from functools import lru_cache

from pydantic import Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = Field("production", alias="NODE_ENV")
    port: int = Field(8000, alias="PORT")

    # API core para ingestar observaciones (red privada de Railway)
    api_url: HttpUrl = Field(..., alias="API_URL")
    internal_api_token: str = Field(..., alias="INTERNAL_API_TOKEN", min_length=32)

    # DB de solo lectura para leer ScrapingSource / cola de trabajos (opcional:
    # también puede consultarse vía la API core).
    database_url: str | None = Field(None, alias="DATABASE_URL")

    # Proxies rotativos (se activan por fuente; el endpoint y la key viven aquí)
    proxy_url: str | None = Field(None, alias="SCRAPER_PROXY_URL")

    log_level: str = Field("info", alias="LOG_LEVEL")
    sentry_dsn: str | None = Field(None, alias="SENTRY_DSN")

    scheduler_enabled: bool = Field(True, alias="SCRAPER_SCHEDULER_ENABLED")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
