"""Collector para retailers con render JS (Playwright / Chromium).

config esperado:
  { "search_path": "/search?text={query}",
    "wait_for": "[data-testid=product-card]",
    "selectors": { "card": "...", "price": "...", "title": "..." } }

Playwright se importa perezosamente: el /health y los tests no necesitan el navegador.
"""

from __future__ import annotations

from urllib.parse import quote_plus

from app.config import get_settings
from app.logging import log
from app.models import RawItem, ScrapingSource
from app.pipeline import parse_price


class PlaywrightCollector:
    async def collect(self, source: ScrapingSource, query: str) -> list[RawItem]:
        try:
            from playwright.async_api import async_playwright
        except ImportError:  # pragma: no cover
            log.error("playwright.not_installed")
            return []

        settings = get_settings()
        cfg = source.config
        selectors = cfg.get("selectors", {})
        card_sel = selectors.get("card")
        price_sel = selectors.get("price")
        title_sel = selectors.get("title")
        if not (card_sel and price_sel and title_sel):
            log.warning("playwright.missing_selectors", source=source.slug)
            return []

        path = str(cfg.get("search_path", "/?q={query}"))
        url = source.base_url.rstrip("/") + path.replace("{query}", quote_plus(query))
        wait_for = cfg.get("wait_for", card_sel)

        items: list[RawItem] = []
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            try:
                page = await browser.new_page(user_agent=settings.user_agent)
                await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                try:
                    await page.wait_for_selector(wait_for, timeout=15_000)
                except Exception:
                    log.warning("playwright.no_results", source=source.slug, query=query)
                    return []

                for card in await page.query_selector_all(card_sel):
                    price_el = await card.query_selector(price_sel)
                    title_el = await card.query_selector(title_sel)
                    if price_el is None or title_el is None:
                        continue
                    price = parse_price((await price_el.inner_text()).strip())
                    if price is None:
                        continue
                    items.append(
                        RawItem(
                            title=(await title_el.inner_text()).strip(),
                            price=price,
                            currency="PEN",
                        )
                    )
            finally:
                await browser.close()
        return items
