"""Collector para la API oficial de MercadoLibre (preferida sobre scraping).

config esperado en ScrapingSource.config:
  { "site_id": "MLP", "search_path": "/sites/MLP/search?q={query}&limit=50",
    "price_field": "price", "currency_field": "currency_id" }
"""

from __future__ import annotations

from urllib.parse import quote_plus

from app.collectors.base import new_http_client
from app.config import get_settings
from app.logging import log
from app.models import RawItem, ScrapingSource


class MercadoLibreCollector:
    async def collect(self, source: ScrapingSource, query: str) -> list[RawItem]:
        settings = get_settings()
        cfg = source.config
        path = str(cfg.get("search_path", "/sites/MLP/search?q={query}&limit=50"))
        url = source.base_url.rstrip("/") + path.replace("{query}", quote_plus(query))

        headers = {}
        if settings.mercadolibre_access_token:
            headers["Authorization"] = f"Bearer {settings.mercadolibre_access_token}"

        async with new_http_client() as client:
            resp = await client.get(url, headers=headers)

        # La API pública de ML exige OAuth desde 2023: sin token devuelve 400/401/403.
        # Un source sin credenciales no debe tumbar la corrida — se salta con log.
        if resp.status_code in (400, 401, 403):
            log.warning("mercadolibre.auth_required", status=resp.status_code, query=query)
            return []
        resp.raise_for_status()
        data = resp.json()

        price_field = str(cfg.get("price_field", "price"))
        currency_field = str(cfg.get("currency_field", "currency_id"))

        items: list[RawItem] = []
        for r in data.get("results", []):
            price = r.get(price_field)
            if not isinstance(price, (int, float)) or price <= 0:
                continue
            seller = r.get("seller") or {}
            items.append(
                RawItem(
                    title=str(r.get("title", "")),
                    price=float(price),
                    currency=str(r.get(currency_field, "PEN")),
                    url=r.get("permalink"),
                    seller=seller.get("nickname") if isinstance(seller, dict) else None,
                )
            )
        return items
