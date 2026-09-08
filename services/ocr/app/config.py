"""Configuración del servicio OCR (pydantic-settings, fail-fast)."""

from functools import lru_cache

from pydantic import Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = Field("production", alias="NODE_ENV")
    port: int = Field(8001, alias="PORT")

    internal_api_token: str = Field(..., alias="INTERNAL_API_TOKEN", min_length=32)

    # Proveedor OCR por defecto. La selección real por plan la decide la API core
    # (AppSetting `ocr.provider_by_plan`) y llega en el request.
    default_provider: str = Field("paddle", alias="OCR_DEFAULT_PROVIDER")

    # Credenciales opcionales de proveedores cloud (adaptadores intercambiables)
    aws_region: str | None = Field(None, alias="AWS_REGION")
    google_credentials_json: str | None = Field(None, alias="GOOGLE_CREDENTIALS_JSON")

    log_level: str = Field("info", alias="LOG_LEVEL")
    sentry_dsn: str | None = Field(None, alias="SENTRY_DSN")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
