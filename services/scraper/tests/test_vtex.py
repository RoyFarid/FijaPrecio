"""VtexCollector: parseo del payload de `catalog_system/pub/products/search`.

Hermético — `new_http_client` se sustituye por un `httpx.MockTransport`.
El payload de muestra refleja la forma real de la API VTEX (Promart), recortada.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.collectors import vtex
from app.models import ScrapingSource

Responder = Callable[[httpx.Request], httpx.Response]
PatchHttp = Callable[[Responder], None]

_SOURCE = ScrapingSource(
    slug="promart",
    name="Promart",
    type="API",
    base_url="https://www.promart.pe",
    config={
        "adapter": "vtex",
        "search_path": "/api/catalog_system/pub/products/search?ft={query}&_from=0&_to=49",
    },
)


def _seller(name: str, price: float | None, *, available: bool = True) -> dict[str, Any]:
    return {
        "sellerName": name,
        "sellerDefault": name == "Promart",
        "commertialOffer": {
            "Price": price,
            "ListPrice": price,
            "AvailableQuantity": 10 if available else 0,
            "IsAvailable": available,
        },
    }


def _product(pid: str, name: str, link: str, sellers: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "productId": pid,
        "productName": name,
        "brand": "Werken",
        "linkText": link,
        "items": [{"itemId": pid, "name": name, "nameComplete": name, "sellers": sellers}],
    }


_PAYLOAD: list[dict[str, Any]] = [
    _product(
        "155192",
        "Taladro Percutor Werken 20V + 37 accesorios",
        "taladro-percutor-werken-20v-155192",
        [_seller("Promart", 129.0), _seller("TerceroSAC", 145.0)],
    ),
    _product(
        "163829",
        "Escritorio Melamina Wengue L101",
        "escritorio-melamina-wengue-l101-163829",
        [_seller("Promart", 413.0)],
    ),
    _product(
        "999",
        "Producto agotado",
        "producto-agotado-999",
        [_seller("Promart", None, available=False)],
    ),
]


@pytest.fixture
def patch_http(monkeypatch: pytest.MonkeyPatch) -> PatchHttp:
    def _apply(responder: Responder) -> None:
        transport = httpx.MockTransport(responder)

        def factory() -> httpx.AsyncClient:
            return httpx.AsyncClient(transport=transport, base_url="https://www.promart.pe")

        monkeypatch.setattr(vtex, "new_http_client", factory)

    return _apply


async def test_collect_parses_cheapest_available_offer(patch_http: PatchHttp) -> None:
    captured: dict[str, str] = {}

    def responder(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(200, json=_PAYLOAD)

    patch_http(responder)

    items = await vtex.VtexCollector().collect(_SOURCE, "taladro percutor")

    assert "ft=taladro%20percutor" in captured["url"]
    # el producto agotado se descarta → 2 items
    assert len(items) == 2
    taladro = next(i for i in items if "Taladro" in i.title)
    assert taladro.price == 129.0  # oferta disponible más barata (Promart 1P, no el 3P a 145)
    assert taladro.currency == "PEN"
    assert taladro.seller == "Promart"
    assert taladro.url == "https://www.promart.pe/taladro-percutor-werken-20v-155192/p"


async def test_collect_respects_seller_filter(patch_http: PatchHttp) -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_PAYLOAD)

    patch_http(responder)

    cfg = {**_SOURCE.config, "seller_filter": "TerceroSAC"}
    source = _SOURCE.model_copy(update={"config": cfg})
    items = await vtex.VtexCollector().collect(source, "taladro")

    # solo el SKU con oferta de TerceroSAC sobrevive, a su precio
    assert len(items) == 1
    assert items[0].price == 145.0
    assert items[0].seller == "TerceroSAC"


async def test_collect_tolerates_bad_request(patch_http: PatchHttp) -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "bad ft"})

    patch_http(responder)

    assert await vtex.VtexCollector().collect(_SOURCE, "") == []


async def test_collect_tolerates_non_list_payload(patch_http: PatchHttp) -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"products": []})

    patch_http(responder)

    assert await vtex.VtexCollector().collect(_SOURCE, "taladro") == []
