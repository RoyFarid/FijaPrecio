"""Lectura de configuración desde Postgres (solo lectura).

El scraper NO escribe en la DB: publica observaciones vía la API core. Aquí solo
lee `ScrapingSource`, `AppSetting` (prefijo `scraper.`) y `UnitConversion`.
"""

from __future__ import annotations

import json
from typing import Any

import asyncpg

from app.config import get_settings
from app.logging import log
from app.models import ScraperSettings, ScrapingSource


def _pg_dsn(url: str) -> str:
    # Prisma admite `?schema=public`; asyncpg no entiende ese parámetro.
    return url.split("?", 1)[0]


class Database:
    def __init__(self) -> None:
        self._pool: asyncpg.Pool[asyncpg.Record] | None = None

    async def connect(self) -> None:
        settings = get_settings()
        self._pool = await asyncpg.create_pool(
            _pg_dsn(settings.database_url), min_size=1, max_size=4
        )
        log.info("db.connected")

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    @property
    def pool(self) -> asyncpg.Pool[asyncpg.Record]:
        if self._pool is None:
            raise RuntimeError("Database no conectada")
        return self._pool

    async def load_enabled_sources(self) -> list[ScrapingSource]:
        rows = await self.pool.fetch(
            """
            SELECT slug, name, type, "baseUrl", config, "rateLimitRpm", priority
            FROM "ScrapingSource"
            WHERE enabled = true
            ORDER BY priority DESC
            """
        )
        return [
            ScrapingSource(
                slug=r["slug"],
                name=r["name"],
                type=r["type"],
                base_url=r["baseUrl"],
                config=_as_dict(r["config"]),
                rate_limit_rpm=r["rateLimitRpm"],
                priority=r["priority"],
            )
            for r in rows
        ]

    async def load_scraper_settings(self) -> ScraperSettings:
        rows = await self.pool.fetch(
            "SELECT key, value FROM \"AppSetting\" WHERE scope = 'GLOBAL' AND key LIKE 'scraper.%'"
        )
        values = {r["key"]: _as_json(r["value"]) for r in rows}
        raw_aliases = values.get("scraper.rubro_aliases", {})
        aliases = (
            {str(k): [str(x) for x in v] for k, v in raw_aliases.items()}
            if isinstance(raw_aliases, dict)
            else {}
        )
        return ScraperSettings(
            outlier_trim_pct=float(values.get("scraper.outlier_trim_pct", 0.1)),
            top_n_nightly=int(values.get("scraper.top_n_nightly", 100)),
            result_ttl_hours=float(values.get("scraper.result_ttl_hours", 24)),
            rubro_aliases=aliases,
        )

    async def load_unit_conversions(self) -> dict[tuple[str, str], float]:
        """(fromUnit, toUnit) -> factor  (1 fromUnit = factor * toUnit)."""
        rows = await self.pool.fetch(
            'SELECT "fromUnit", "toUnit", factor FROM "UnitConversion"'
        )
        return {(r["fromUnit"], r["toUnit"]): float(r["factor"]) for r in rows}


def _as_dict(value: Any) -> dict[str, Any]:
    parsed = _as_json(value)
    return parsed if isinstance(parsed, dict) else {}


def _as_json(value: Any) -> Any:
    return json.loads(value) if isinstance(value, str | bytes) else value


db = Database()
