"""Normalización de resultados crudos → batch de observaciones. Funciones PURAS.

    parse_price       texto ("S/ 1.234,50") → float
    unit_qty_in_title extrae "50 kg" / "500g" del título
    derive_unit_price precio por unidad canónica (usa UnitConversion)
    trim_bounds       rango [lo, hi] tras recortar los extremos (scraper.outlier_trim_pct)
    matches_query     filtra falsos positivos por subcadena ("pan" dentro de "Panadol")
    aggregate_market_price  snapshot del radar (min/p25/mediana/p75/premium + sampleLinks)
    build_batch       arma el ObservationBatch idempotente
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from datetime import UTC, datetime
from typing import NamedTuple

from app.models import ObservationBatch, ObservationOut, RawItem

_CURRENCY_JUNK = re.compile(r"(?i)(s/\.?|pen|us\$|usd|\$|soles?)")
_NUMBER = re.compile(r"[\d][\d.,]*")
_WORD = re.compile(r"[a-z0-9]+")

# sinónimos de unidad en títulos de retail peruano → token canónico
_UNIT_SYNONYMS: dict[str, str] = {
    "kg": "kg", "kilo": "kg", "kilos": "kg", "kilogramo": "kg", "kilogramos": "kg",
    "g": "g", "gr": "g", "grs": "g", "gramo": "g", "gramos": "g",
    "l": "l", "lt": "l", "lts": "l", "litro": "l", "litros": "l",
    "ml": "ml", "cc": "ml",
    "m": "m", "metro": "m", "metros": "m",
    "cm": "cm", "mm": "mm",
    "unid": "unidad", "und": "unidad", "un": "unidad", "u": "unidad", "unidad": "unidad",
    "par": "par", "docena": "docena", "ciento": "ciento", "millar": "millar",
}
_UNIT_ALT = "|".join(sorted(_UNIT_SYNONYMS, key=len, reverse=True))
_QTY_IN_TITLE = re.compile(
    r"(?<![a-z0-9])(\d+(?:[.,]\d+)?)\s*(" + _UNIT_ALT + r")\b",
    re.IGNORECASE,
)


def parse_price(text: str) -> float | None:
    if not text:
        return None
    cleaned = _CURRENCY_JUNK.sub("", text).strip()
    match = _NUMBER.search(cleaned)
    if not match:
        return None
    raw = match.group(0)

    if "," in raw and "." in raw:
        # el separador decimal es el que aparece más a la derecha
        dec_sep = "," if raw.rfind(",") > raw.rfind(".") else "."
        thou_sep = "." if dec_sep == "," else ","
        raw = raw.replace(thou_sep, "").replace(dec_sep, ".")
    elif "," in raw:
        # "1,50" es decimal;  "1,500" son miles
        is_decimal = re.fullmatch(r"\d{1,3},\d{1,2}", raw) is not None
        raw = raw.replace(",", "." if is_decimal else "")
    try:
        value = float(raw)
    except ValueError:
        return None
    return value if math.isfinite(value) and value > 0 else None


def unit_qty_in_title(title: str) -> tuple[float, str] | None:
    match = _QTY_IN_TITLE.search(title or "")
    if not match:
        return None
    qty = parse_price(match.group(1))
    if qty is None:
        return None
    return qty, _UNIT_SYNONYMS[match.group(2).lower()]


def derive_unit_price(
    item: RawItem,
    base_unit: str,
    conversions: dict[tuple[str, str], float],
) -> float | None:
    """Precio por `base_unit`. Si el título no trae cantidad, asume que el precio
    ya es por `base_unit` (típico en retail: 'Harina X — S/ 4.50')."""
    parsed = unit_qty_in_title(item.title)
    if parsed is None:
        return item.price
    qty, unit = parsed
    if qty <= 0:
        return None
    if unit == base_unit:
        return item.price / qty
    factor = conversions.get((unit, base_unit))
    if factor is None:
        return None  # no sabemos convertir → descartar en vez de contaminar
    return item.price / (qty * factor)


def _fold(text: str) -> str:
    """minúsculas + sin acentos, para comparar sin depender de tildes/caja."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()


def _significant_words(text: str, *, min_len: int = 3) -> set[str]:
    return {w for w in _WORD.findall(_fold(text).lower()) if len(w) >= min_len}


# Menaje/accesorios/decoración que las tiendas devuelven cuando el nombre del
# ingrediente/producto aparece dentro del título de un artículo NO comestible
# ("Cuchillo de Pan", "Cuadro ... UN PAN CON MANGO"). No es un falso positivo
# de subcadena (la palabra sí calza completa) sino de categoría — el mismo
# query genérico ("pan", "queso", "harina"...) golpea tanto el alimento como
# sus utensilios/decoración, así que la lista es GLOBAL (no por producto) y
# se aplica a cualquier query. Si la propia query trae alguna de estas
# palabras (p.ej. alguien busca "molde para pan" a propósito) no se excluye —
# ver `matches_query`. Ojo: "molde" queda afuera de esta lista a propósito —
# "Pan de Molde" es el nombre real del pan de sándwich, no un accesorio.
# Override en runtime: `AppSetting` clave `scraper.accessory_noise_words`
# (ver `ScraperSettings.accessory_noise_words` / `db.load_scraper_settings`).
DEFAULT_ACCESSORY_NOISE_WORDS: frozenset[str] = frozenset({
    "cuchillo", "cuchillos", "plato", "platos",
    "tostador", "tostadora", "tostadoras", "canasta", "canastas",
    "sanduchera", "sanducheras", "rebanadora", "rebanadoras",
    "contenedor", "contenedores", "cuadro", "cuadros", "taza", "tazas",
    "mug", "mugs", "lonchera", "loncheras", "tabla",
})


def matches_query(
    title: str,
    query: str,
    *,
    noise_words: frozenset[str] | set[str] = DEFAULT_ACCESSORY_NOISE_WORDS,
) -> bool:
    """¿El título trae al menos una palabra COMPLETA de la query, sin ser
    ruido de menaje/decoración?

    El buscador de las tiendas hace match por subcadena: "pan" cae dentro de
    "Panadol", "Acqua Panna" o "Sandwichera Panini". Exigir que la palabra
    aparezca completa (con límites de palabra, no como substring) descarta esos
    falsos positivos sin perder recall en queries multi-palabra (basta con que
    UNA palabra significativa calce — "melamina" en "melamina blanca 18mm"
    sigue encontrando "Melamina Blanco..." aunque el género no coincida).
    Sin palabras "significativas" (todo stopword/corto) → no se filtra.

    Además descarta accesorios/decoración ("Cuchillo de Pan", "Molde para
    Pan") cuando esa palabra de menaje no forma parte de lo que se buscó.
    Aplica a cualquier producto/query por igual — `noise_words` es una lista
    global curada, no algo que se configure por producto.
    """
    words = _significant_words(query)
    if not words:
        return True
    title_words = _significant_words(title, min_len=1)
    if not (words & title_words):
        return False
    noise = noise_words & title_words
    return not noise or bool(noise & words)


def trim_bounds(prices: list[float], trim_pct: float) -> tuple[float, float]:
    """Rango a conservar tras quitar `trim_pct` de cada extremo (mín. 1 valor)."""
    clean = sorted(p for p in prices if p is not None and math.isfinite(p) and p > 0)
    if len(clean) <= 3:
        return (clean[0], clean[-1]) if clean else (0.0, math.inf)
    k = min(round(len(clean) * max(trim_pct, 0.0)), (len(clean) - 1) // 2)
    kept = clean[k : len(clean) - k] or clean
    return kept[0], kept[-1]


def _quantile(sorted_vals: list[float], q: float) -> float:
    """Cuantil con interpolación lineal (tipo 7). `sorted_vals` ascendente."""
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = (len(sorted_vals) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return sorted_vals[lo]
    return sorted_vals[lo] + (pos - lo) * (sorted_vals[hi] - sorted_vals[lo])


class PricedItem(NamedTuple):
    """Un resultado ya con precio resuelto, para agregar en el radar."""

    price: float
    source: str
    title: str = ""
    url: str | None = None


def aggregate_market_price(
    priced: list[PricedItem],
    *,
    trim_pct: float,
    links_per_source: int | None = None,
) -> dict[str, object] | None:
    """Agrega precios de un PRODUCTO FINAL en un snapshot para el radar."""
    prices = [
        p.price for p in priced if p.price is not None and math.isfinite(p.price) and p.price > 0
    ]
    if len(prices) < 3:
        return None

    lo, hi = trim_bounds(prices, trim_pct)
    kept = [p for p in priced if p.price is not None and lo <= p.price <= hi and p.price > 0]
    if len(kept) < 3:
        return None

    vals = sorted(p.price for p in kept)
    median = _quantile(vals, 0.5)

    breakdown: dict[str, int] = {}
    for p in kept:
        breakdown[p.source] = breakdown.get(p.source, 0) + 1

    # todos los ítems encontrados por fuente, del más barato al más caro — para
    # la tabla "ver todos los que encontramos" del radar en el frontend.
    # `links_per_source` es un tope opcional por fuente (None = sin tope).
    by_source: dict[str, list[PricedItem]] = {}
    for p in kept:
        if not p.url:
            continue
        by_source.setdefault(p.source, []).append(p)

    # `lista[:None]` en Python devuelve la lista completa, así que
    # `links_per_source=None` ya implica "sin tope" sin necesidad de un if.
    capped: list[PricedItem] = [
        item
        for items in by_source.values()
        for item in sorted(items, key=lambda x: x.price)[:links_per_source]
    ]
    capped.sort(key=lambda item: item.price)
    sample_links = [
        {"source": item.source, "title": item.title, "price": round(item.price, 4), "url": item.url}
        for item in capped
    ]

    return {
        "minPrice": round(vals[0], 4),
        "p25": round(_quantile(vals, 0.25), 4),
        "avgPrice": round(sum(vals) / len(vals), 4),
        "medianPrice": round(median, 4),
        "p75": round(_quantile(vals, 0.75), 4),
        "premiumPrice": round(_quantile(vals, 0.9), 4),
        "sampleSize": len(vals),
        "sourceBreakdown": breakdown,
        "sampleLinks": sample_links,
    }


def build_batch(
    items: list[RawItem],
    *,
    canonical_input_id: str,
    base_unit: str,
    region: str,
    currency: str,
    source_slug: str,
    run_key: str,
    trim_pct: float,
    conversions: dict[tuple[str, str], float],
) -> ObservationBatch:
    priced: list[tuple[float, RawItem]] = []
    for item in items:
        if item.currency.upper() not in {currency.upper(), "PEN"}:
            continue  # TODO: conversión de moneda vía ExchangeRate
        unit_price = derive_unit_price(item, base_unit, conversions)
        if unit_price is not None and math.isfinite(unit_price) and unit_price > 0:
            priced.append((round(unit_price, 4), item))

    if not priced:
        return ObservationBatch(observations=[])

    lo, hi = trim_bounds([p for p, _ in priced], trim_pct)
    now = datetime.now(UTC).isoformat()

    observations = [
        ObservationOut(
            canonicalInputId=canonical_input_id,
            price=price,
            currency=currency.upper(),
            unit=base_unit,
            region=region,
            sourceRef=f"{source_slug}:{run_key}:{_item_key(item)}",
            observedAt=now,
        )
        for price, item in priced
        if lo <= price <= hi
    ]
    return ObservationBatch(observations=observations)


def _item_key(item: RawItem) -> str:
    basis = (item.url or item.title).encode("utf-8", "ignore")
    return hashlib.sha1(basis).hexdigest()[:12]
