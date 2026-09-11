"""SodimacCollector: parseo de `__NEXT_DATA__` del HTML de Sodimac (plataforma Falabella).

Hermético — `new_http_client` se sustituye por un `httpx.MockTransport`.
El HTML de muestra refleja la forma real (`props.pageProps.results`), recortada.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.collectors import sodimac
from app.models import ScrapingSource

Responder = Callable[[httpx.Request], httpx.Response]
PatchHttp = Callable[[Responder], None]

_SOURCE = ScrapingSource(
    slug="sodimac-pe",
    name="Sodimac Perú",
    type="HTTP",
    base_url="https://www.sodimac.com.pe",
    config={"adapter": "sodimac", "search_path": "/sodimac-pe/buscar?Ntt={query}"},
)


def _price(ptype: str, value: str, *, crossed: bool = False) -> dict[str, Any]:
    return {"symbol": "S/ ", "type": ptype, "crossed": crossed, "price": [value]}


def _result(name: str, prices: list[dict[str, Any]], *, seller: str = "Sodimac") -> dict[str, Any]:
    return {
        "productId": name,
        "displayName": name,
        "sellerName": seller,
        "brand": "Bosch",
        "url": f"https://www.sodimac.com.pe/sodimac-pe/articulo/1/{name}",
        "prices": prices,
    }


_RESULTS = [
    # cmr más barato pero se ignora → se toma internetPrice 549.90
    _result("Taladro Bosch GSB", [_price("cmrPrice", "499.90"), _price("internetPrice", "549.90")]),
    # normalPrice tachado + internetPrice vigente → 179.90
    _result(
        "Taladro Bosch GSB 13",
        [_price("normalPrice", "229.90", crossed=True), _price("internetPrice", "179.90")],
    ),
    # miles con coma → 1149.90
    _result("Combo Dewalt 20V", [_price("internetPrice", "1,149.90")]),
    # sin precio utilizable → se descarta
    _result("Producto sin precio", [_price("normalPrice", "99.90", crossed=True)]),
]


def _html(results: list[dict[str, Any]]) -> str:
    blob = json.dumps({"props": {"pageProps": {"results": results}}})
    return (
        "<!doctype html><html><body><div id=root></div>"
        f'<script id="__NEXT_DATA__" type="application/json">{blob}</script>'
        "</body></html>"
    )


@pytest.fixture
def patch_http(monkeypatch: pytest.MonkeyPatch) -> PatchHttp:
    def _apply(responder: Responder) -> None:
        transport = httpx.MockTransport(responder)

        def factory() -> httpx.AsyncClient:
            return httpx.AsyncClient(transport=transport, base_url="https://www.sodimac.com.pe")

        monkeypatch.setattr(sodimac, "new_http_client", factory)

    return _apply


async def test_collect_picks_non_cmr_non_crossed_price(patch_http: PatchHttp) -> None:
    captured: dict[str, str] = {}

    def responder(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(200, html=_html(_RESULTS))

    patch_http(responder)

    items = await sodimac.SodimacCollector().collect(_SOURCE, "taladro percutor")

    assert "Ntt=taladro%20percutor" in captured["url"]
    prices = {i.title: i.price for i in items}
    assert prices == {
        "Taladro Bosch GSB": 549.90,
        "Taladro Bosch GSB 13": 179.90,
        "Combo Dewalt 20V": 1149.90,
    }
    assert all(i.currency == "PEN" and i.seller == "Sodimac" for i in items)


async def test_collect_without_next_data_returns_empty(patch_http: PatchHttp) -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, html="<html><body>sin datos</body></html>")

    patch_http(responder)

    assert await sodimac.SodimacCollector().collect(_SOURCE, "taladro") == []


async def test_collect_tolerates_bad_json(patch_http: PatchHttp) -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        broken = '<script id="__NEXT_DATA__" type="application/json">{not json</script>'
        return httpx.Response(200, html=f"<html><body>{broken}</body></html>")

    patch_http(responder)

    assert await sodimac.SodimacCollector().collect(_SOURCE, "taladro") == []


async def test_collect_tolerates_bad_request(patch_http: PatchHttp) -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, html="not found")

    patch_http(responder)

    assert await sodimac.SodimacCollector().collect(_SOURCE, "") == []
