"""Contratos internos del scraper + payload de la API core."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ScrapingSource(BaseModel):
    """Fila de `ScrapingSource` (Postgres). La config de scraping vive aquí, no en el código."""

    slug: str
    name: str
    type: Literal["API", "HTTP", "PLAYWRIGHT"]
    base_url: str
    config: dict[str, Any] = Field(default_factory=dict)
    rate_limit_rpm: int = 10
    priority: int = 0

    @property
    def rubros(self) -> list[str] | None:
        """`config.rubros` (rubros que sirve la fuente); None = universal."""
        value = self.config.get("rubros")
        return [str(x) for x in value] if isinstance(value, list) else None


class ScraperSettings(BaseModel):
    """Parámetros de negocio leídos de `AppSetting` (scope=GLOBAL, prefijo `scraper.`)."""

    outlier_trim_pct: float = 0.1
    top_n_nightly: int = 100
    result_ttl_hours: float = 24.0
    # alias de rubros (override del default en app/rubros.py)
    rubro_aliases: dict[str, list[str]] = Field(default_factory=dict)


class ScrapeTarget(BaseModel):
    canonical_input_id: str = Field(alias="canonicalInputId")
    query: str
    base_unit: str = Field(alias="baseUnit")
    rubro: str | None = None


class RadarTarget(BaseModel):
    product_id: str = Field(alias="productId")
    query: str
    region: str = "PE"
    currency: str = "PEN"
    rubro: str | None = None


class MarketSnapshotOut(BaseModel):
    productId: str | None = None
    productQuery: str
    region: str
    currency: str
    minPrice: float
    p25: float | None = None
    avgPrice: float
    medianPrice: float | None = None
    p75: float | None = None
    premiumPrice: float | None = None
    sampleSize: int
    sourceBreakdown: dict[str, int]
    scrapingJobId: str | None = None


class MarketSnapshotBatch(BaseModel):
    snapshots: list[MarketSnapshotOut]


class RawItem(BaseModel):
    """Un resultado crudo de una fuente, antes de normalizar."""

    title: str
    price: float
    currency: str
    url: str | None = None
    seller: str | None = None


class ScrapeRequest(BaseModel):
    scope: Literal["INPUT", "FINAL_PRODUCT"] = "INPUT"
    canonical_input_id: str | None = Field(default=None, alias="canonicalInputId")
    product_id: str | None = Field(default=None, alias="productId")
    query: str
    base_unit: str | None = Field(default=None, alias="baseUnit")
    region: str | None = None
    currency: str = "PEN"
    rubro: str | None = None
    source_slugs: list[str] | None = Field(default=None, alias="sourceSlugs")


class ObservationOut(BaseModel):
    scope: Literal["INPUT", "FINAL_PRODUCT"] = "INPUT"
    canonicalInputId: str
    price: float
    currency: str
    unit: str
    region: str
    source: Literal["SCRAPE"] = "SCRAPE"
    sourceRef: str
    observedAt: str


class ObservationBatch(BaseModel):
    observations: list[ObservationOut]


class ScrapeResult(BaseModel):
    query: str
    sources_tried: int
    items_seen: int
    published: int
    errors: list[str] = Field(default_factory=list)
    at: datetime = Field(default_factory=lambda: datetime.now())
