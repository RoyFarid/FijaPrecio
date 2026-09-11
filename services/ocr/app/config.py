"""Configuración del servicio OCR (pydantic-settings, fail-fast)."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = Field("production", alias="NODE_ENV")
    port: int = Field(8001, alias="PORT")

    internal_api_token: str = Field(..., alias="INTERNAL_API_TOKEN", min_length=32)

    # Proveedor por defecto si el request no trae uno. La selección real por plan
    # la decide la API core (AppSetting `ocr.provider_by_plan`) y llega en el body.
    default_provider: str = Field("tesseract", alias="OCR_DEFAULT_PROVIDER")

    tesseract_lang: str = Field("spa+eng", alias="OCR_TESSERACT_LANG")
    # Ruta al binario `tesseract` si no está en el PATH (típico en dev Windows;
    # en la imagen Docker de Railway sí está en el PATH → dejar vacío).
    tesseract_cmd: str | None = Field(None, alias="OCR_TESSERACT_CMD")
    max_image_bytes: int = Field(12_000_000, alias="OCR_MAX_IMAGE_BYTES")
    download_timeout_seconds: float = Field(20.0, alias="OCR_DOWNLOAD_TIMEOUT_SECONDS")

    # Credenciales opcionales de proveedores cloud (adaptadores intercambiables)
    aws_region: str | None = Field(None, alias="AWS_REGION")
    google_credentials_json: str | None = Field(None, alias="GOOGLE_CREDENTIALS_JSON")

    log_level: str = Field("info", alias="LOG_LEVEL")
    sentry_dsn: str | None = Field(None, alias="SENTRY_DSN")

    @field_validator(
        "tesseract_cmd", "aws_region", "google_credentials_json", "sentry_dsn", mode="before"
    )
    @classmethod
    def _empty_to_none(cls, v: object) -> object:
        return None if isinstance(v, str) and v.strip() == "" else v


@lru_cache
def get_settings() -> Settings:
    return Settings()
