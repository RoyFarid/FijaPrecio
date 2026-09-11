"""Collector para tiendas montadas sobre VTEX (Promart, Sodimac, Maestro, ...).

Usa la API pública `catalog_system/pub/products/search`: JSON estable y documentado,
sin navegador. Un solo adapter sirve para cualquier retailer VTEX — solo cambia
`base_url` y, si acaso, el `search_path`.

config esperado en ScrapingSource.config:
  {
    "adapter": "vtex",
    "search_path": "/api/catalog_system/pub/products/search?ft={query}&_from=0&_to=49",
    "seller_filter": "Promart"   # opcional: solo ofertas de ese sellerName (1P)
  }
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from app.collectors.base import new_http_client
from app.logging import log
from app.models import RawItem, ScrapingSource

_DEFAULT_PATH = "/api/catalog_system/pub/products/search?ft={query}&_from=0&_to=49"


def _pick_offer(
    sku: dict[str, Any], seller_filter: str | None
) -> tuple[float, str | None] | None:
    """De los `sellers` de un SKU, la oferta disponible más barata → (precio, sellerName)."""
    best: tuple[float, str | None] | None = None
    for seller in sku.get("sellers") or []:
        name = seller.get("sellerName")
        if seller_filter and name != seller_filter:
            continue
        offer = seller.get("commertialOffer") or {}
        price = offer.get("Price")
        if not offer.get("IsAvailable"):
            continue
        if not isinstance(price, (int, float)) or price <= 0:
            continue
        if best is None or float(price) < best[0]:
            best = (float(price), name)
    return best


class VtexCollector:
    async def collect(self, source: ScrapingSource, query: str) -> list[RawItem]:
        cfg = source.config
        path = str(cfg.get("search_path", _DEFAULT_PATH))
        seller_filter = cfg.get("seller_filter")
        seller_filter = str(seller_filter) if seller_filter else None

        base = source.base_url.rstrip("/")
        url = base + path.replace("{query}", quote(query))

        async with new_http_client() as client:
            resp = await client.get(url, headers={"Accept": "application/json"})

        # 400/404 = query vacía o endpoint mal configurado: se salta con log, no tumba la corrida.
        if resp.status_code in (400, 404):
            log.warning(
                "vtex.bad_request", source=source.slug, status=resp.status_code, query=query
            )
            return []
        resp.raise_for_status()

        data = resp.json()
        if not isinstance(data, list):
            log.warning("vtex.unexpected_payload", source=source.slug, query=query)
            return []

        items: list[RawItem] = []
        for product in data:
            if not isinstance(product, dict):
                continue
            link = product.get("linkText")
            product_url = f"{base}/{link}/p" if link else product.get("link")
            fallback_title = str(product.get("productName") or "")
            for sku in product.get("items") or []:
                if not isinstance(sku, dict):
                    continue
                picked = _pick_offer(sku, seller_filter)
                if picked is None:
                    continue
                price, seller_name = picked
                items.append(
                    RawItem(
                        title=str(sku.get("nameComplete") or sku.get("name") or fallback_title),
                        price=price,
                        currency="PEN",
                        url=product_url,
                        seller=seller_name or str(product.get("brand") or "") or None,
                    )
                )
        return items
