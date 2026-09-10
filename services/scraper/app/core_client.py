"""Cliente HTTP hacia la API core (red privada de Railway)."""

from __future__ import annotations

import httpx

from app.config import get_settings
from app.logging import log
from app.models import (
    MarketSnapshotBatch,
    ObservationBatch,
    RadarTarget,
    ScrapeTarget,
)


class CoreClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = httpx.AsyncClient(
            base_url=str(settings.api_url).rstrip("/"),
            headers={"X-Internal-Token": settings.internal_api_token},
            timeout=settings.request_timeout_seconds,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def get_scrape_targets(self, limit: int) -> list[ScrapeTarget]:
        resp = await self._client.get("/v1/internal/scrape-targets", params={"limit": limit})
        resp.raise_for_status()
        return [ScrapeTarget.model_validate(row) for row in resp.json()]

    async def publish_observations(self, batch: ObservationBatch) -> int:
        if not batch.observations:
            return 0
        resp = await self._client.post(
            "/v1/internal/price-observations",
            json=batch.model_dump(mode="json"),
        )
        resp.raise_for_status()
        created = int(resp.json().get("created", 0))
        log.info("core.published", sent=len(batch.observations), created=created)
        return created

    async def get_radar_targets(self, limit: int) -> list[RadarTarget]:
        resp = await self._client.get("/v1/internal/radar-targets", params={"limit": limit})
        resp.raise_for_status()
        return [RadarTarget.model_validate(row) for row in resp.json()]

    async def publish_market_prices(self, batch: MarketSnapshotBatch) -> int:
        if not batch.snapshots:
            return 0
        resp = await self._client.post(
            "/v1/internal/market-prices",
            json=batch.model_dump(mode="json"),
        )
        resp.raise_for_status()
        created = int(resp.json().get("created", 0))
        log.info("core.market_published", sent=len(batch.snapshots), created=created)
        return created


core = CoreClient()
