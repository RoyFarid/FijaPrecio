"""Collector para HTML estático (httpx + selectolax).

config esperado:
  { "search_path": "/buscar?q={query}",
    "selectors": { "card": ".product", "price": ".price", "title": ".name" } }
"""

from __future__ import annotations

from urllib.parse import quote_plus

from selectolax.parser import HTMLParser

from app.collectors.base import new_http_client
from app.logging import log
from app.models import RawItem, ScrapingSource
from app.pipeline import parse_price


class HtmlCollector:
    async def collect(self, source: ScrapingSource, query: str) -> list[RawItem]:
        cfg = source.config
        selectors = cfg.get("selectors", {})
        card_sel = selectors.get("card")
        price_sel = selectors.get("price")
        title_sel = selectors.get("title")
        if not (card_sel and price_sel and title_sel):
            log.warning("html.missing_selectors", source=source.slug)
            return []

        path = str(cfg.get("search_path", "/?q={query}"))
        url = source.base_url.rstrip("/") + path.replace("{query}", quote_plus(query))

        async with new_http_client() as client:
            resp = await client.get(url)
        resp.raise_for_status()

        tree = HTMLParser(resp.text)
        items: list[RawItem] = []
        for card in tree.css(card_sel):
            price_node = card.css_first(price_sel)
            title_node = card.css_first(title_sel)
            if price_node is None or title_node is None:
                continue
            price = parse_price(price_node.text(strip=True))
            if price is None:
                continue
            link = card.css_first("a")
            items.append(
                RawItem(
                    title=title_node.text(strip=True),
                    price=price,
                    currency="PEN",
                    url=link.attributes.get("href") if link is not None else None,
                )
            )
        return items
