"""Configuración del servicio, validada al importar (pydantic-settings).

Mismo principio que las apps Node: si falta una variable requerida, la app
no arranca. Los parámetros de NEGOCIO (umbral de recorte de outliers, cadencia,
top-N, selectores por retailer) viven en `AppSetting` / `ScrapingSource` de
Postgres — aquí solo hay infra y credenciales.
"""

from functools import lru_cache

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("proxy_url", "mercadolibre_access_token", "sentry_dsn", mode="before")
    @classmethod
    def _empty_to_none(cls, v: object) -> object:
        # `.env` con `KEY=` da "" — trátalo como ausente (igual que zOptional en Node).
        return None if isinstance(v, str) and v.strip() == "" else v

    env: str = Field("production", alias="NODE_ENV")
    port: int = Field(8000, alias="PORT")

    # API core para ingestar observaciones y leer targets (red privada de Railway)
    api_url: HttpUrl = Field(..., alias="API_URL")
    internal_api_token: str = Field(..., alias="INTERNAL_API_TOKEN", min_length=32)

    # DB de solo lectura: ScrapingSource, AppSetting, UnitConversion
    database_url: str = Field(..., alias="DATABASE_URL")

    # Proxies rotativos (se activan por fuente; endpoint + key aquí)
    proxy_url: str | None = Field(None, alias="SCRAPER_PROXY_URL")

    # Token de la API de MercadoLibre (opcional; sin él, el search puede dar 401)
    mercadolibre_access_token: str | None = Field(None, alias="MERCADOLIBRE_ACCESS_TOKEN")

    # --- operativos (no de negocio) ---
    default_region: str = Field("PE", alias="SCRAPER_DEFAULT_REGION")
    default_currency: str = Field("PEN", alias="DEFAULT_CURRENCY")
    sweep_interval_minutes: int = Field(360, alias="SCRAPER_SWEEP_INTERVAL_MINUTES")
    targets_per_run: int = Field(50, alias="SCRAPER_TARGETS_PER_RUN")
    request_timeout_seconds: float = Field(20.0, alias="SCRAPER_REQUEST_TIMEOUT_SECONDS")
    user_agent: str = Field(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0 Safari/537.36",
        alias="SCRAPER_USER_AGENT",
    )

    log_level: str = Field("info", alias="LOG_LEVEL")
    sentry_dsn: str | None = Field(None, alias="SENTRY_DSN")
    scheduler_enabled: bool = Field(True, alias="SCRAPER_SCHEDULER_ENABLED")


@lru_cache
def get_settings() -> Settings:
    return Settings()
