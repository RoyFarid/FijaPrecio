from app.collectors.base import Collector
from app.collectors.html import HtmlCollector
from app.collectors.mercadolibre import MercadoLibreCollector
from app.collectors.playwright_collector import PlaywrightCollector
from app.collectors.sodimac import SodimacCollector
from app.collectors.vtex import VtexCollector
from app.models import ScrapingSource

_ML = MercadoLibreCollector()
_HTML = HtmlCollector()
_PLAYWRIGHT = PlaywrightCollector()
_VTEX = VtexCollector()
_SODIMAC = SodimacCollector()

_BY_ADAPTER: dict[str, Collector] = {
    "vtex": _VTEX,
    "sodimac": _SODIMAC,
    "falabella": _SODIMAC,  # mismo parser `__NEXT_DATA__` (Sodimac, Tottus, Falabella...)
}


def get_collector(source: ScrapingSource) -> Collector | None:
    """Elige el collector según el `adapter` del config y, si no hay, el `type` de la fuente.

    - `config.adapter=vtex`      → API pública de VTEX (Promart, Maestro, ...)
    - `config.adapter=sodimac`   → `__NEXT_DATA__` de Sodimac (plataforma Falabella)
    - `type=PLAYWRIGHT`          → render con Chromium + selectores CSS
    - `type=HTTP`  (sin adapter) → HTML estático + selectores CSS
    - `type=API`   (sin adapter) → API oficial de MercadoLibre

    `type` dice CÓMO se trae la página; `config.adapter` dice CÓMO se parsea.
    """
    adapter = str(source.config.get("adapter", "")).lower()
    if adapter in _BY_ADAPTER:
        return _BY_ADAPTER[adapter]
    if source.type == "PLAYWRIGHT":
        return _PLAYWRIGHT
    if source.type == "HTTP":
        return _HTML
    if source.type == "API":
        return _ML
    return None


__all__ = ["Collector", "get_collector"]
