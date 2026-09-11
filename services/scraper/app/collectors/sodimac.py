"""Collector para Sodimac Perú (plataforma Falabella: Next.js con SSR).

La grilla se renderiza en cliente, PERO el HTML inicial trae `__NEXT_DATA__`
(JSON embebido) con la lista completa en `props.pageProps.results` — así que un
GET normal basta, sin navegador.

config esperado en ScrapingSource.config:
  {
    "adapter": "sodimac",
    "search_path": "/sodimac-pe/buscar?Ntt={query}"
  }

Precios (`results[].prices[]`): cada uno trae `type` (`internetPrice` = precio de
venta, `normalPrice` = lista, `cmrPrice` = con tarjeta CMR) y `crossed` (tachado).
Se toma el más barato que NO sea `cmrPrice` ni esté tachado.
"""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import quote

from app.collectors.base import new_http_client
from app.logging import log
from app.models import RawItem, ScrapingSource
from app.pipeline import parse_price

_DEFAULT_PATH = "/sodimac-pe/buscar?Ntt={query}"
_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.DOTALL
)
_SKIP_PRICE_TYPES = {"cmrPrice"}


def _extract_results(html: str) -> list[dict[str, Any]]:
    match = _NEXT_DATA_RE.search(html)
    if not match:
        return []
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []
    results = (((payload.get("props") or {}).get("pageProps") or {}).get("results")) or []
    return [r for r in results if isinstance(r, dict)]


def _pick_price(prices: list[dict[str, Any]]) -> float | None:
    candidates: list[float] = []
    fallback: list[float] = []
    for entry in prices:
        if not isinstance(entry, dict) or entry.get("crossed"):
            continue
        raw = entry.get("price")
        text = raw[0] if isinstance(raw, list) and raw else raw
        value = parse_price(str(text)) if text is not None else None
        if value is None:
            continue
        fallback.append(value)
        if entry.get("type") not in _SKIP_PRICE_TYPES:
            candidates.append(value)
    pool = candidates or fallback
    return min(pool) if pool else None


class SodimacCollector:
    async def collect(self, source: ScrapingSource, query: str) -> list[RawItem]:
        cfg = source.config
        path = str(cfg.get("search_path", _DEFAULT_PATH))
        url = source.base_url.rstrip("/") + path.replace("{query}", quote(query))

        async with new_http_client() as client:
            resp = await client.get(url, headers={"Accept": "text/html"})

        if resp.status_code in (400, 404):
            log.warning("sodimac.bad_request", source=source.slug, status=resp.status_code)
            return []
        resp.raise_for_status()

        results = _extract_results(resp.text)
        if not results:
            log.warning("sodimac.no_next_data", source=source.slug, query=query)
            return []

        items: list[RawItem] = []
        for product in results:
            price = _pick_price(product.get("prices") or [])
            if price is None:
                continue
            title = str(product.get("displayName") or "")
            if not title:
                continue
            items.append(
                RawItem(
                    title=title,
                    price=price,
                    currency="PEN",
                    url=str(product.get("url")) if product.get("url") else None,
                    seller=str(product.get("sellerName") or product.get("brand") or "") or None,
                )
            )
        return items
