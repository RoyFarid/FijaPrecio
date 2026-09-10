from app.collectors.base import Collector
from app.collectors.html import HtmlCollector
from app.collectors.mercadolibre import MercadoLibreCollector
from app.collectors.playwright_collector import PlaywrightCollector

_BY_TYPE: dict[str, Collector] = {
    "API": MercadoLibreCollector(),
    "HTTP": HtmlCollector(),
    "PLAYWRIGHT": PlaywrightCollector(),
}


def get_collector(source_type: str) -> Collector | None:
    return _BY_TYPE.get(source_type)


__all__ = ["Collector", "get_collector"]
