"""Contrato de un collector: dada una fuente y una query, devuelve items crudos."""

from __future__ import annotations

from typing import Protocol

import httpx

from app.config import get_settings
from app.models import RawItem, ScrapingSource


class Collector(Protocol):
    async def collect(self, source: ScrapingSource, query: str) -> list[RawItem]: ...


def new_http_client() -> httpx.AsyncClient:
    settings = get_settings()
    return httpx.AsyncClient(
        timeout=settings.request_timeout_seconds,
        follow_redirects=True,
        headers={"User-Agent": settings.user_agent},
        proxy=settings.proxy_url,
    )
