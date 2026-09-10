"""Normalización de resultados crudos → batch de observaciones. Funciones PURAS.

    parse_price       texto ("S/ 1.234,50") → float
    unit_qty_in_title extrae "50 kg" / "500g" del título
    derive_unit_price precio por unidad canónica (usa UnitConversion)
    trim_bounds       rango [lo, hi] tras recortar los extremos (scraper.outlier_trim_pct)
    build_batch       arma el ObservationBatch idempotente
"""

from __future__ import annotations

import hashlib
import math
import re
from datetime import UTC, datetime

from app.models import ObservationBatch, ObservationOut, RawItem

_CURRENCY_JUNK = re.compile(r"(?i)(s/\.?|pen|us\$|usd|\$|soles?)")
_NUMBER = re.compile(r"[\d][\d.,]*")

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


def aggregate_market_price(
    priced: list[tuple[float, str]],
    *,
    trim_pct: float,
) -> dict[str, object] | None:
    """Agrega precios de un PRODUCTO FINAL en un snapshot para el radar.

    `priced` = [(precio, source_slug), ...] de todas las fuentes juntas.
    """
    prices = [p for p, _ in priced if p is not None and math.isfinite(p) and p > 0]
    if len(prices) < 3:
        return None

    lo, hi = trim_bounds(prices, trim_pct)
    kept = [(p, s) for p, s in priced if p is not None and lo <= p <= hi and p > 0]
    if len(kept) < 3:
        return None

    vals = sorted(p for p, _ in kept)
    breakdown: dict[str, int] = {}
    for _, slug in kept:
        breakdown[slug] = breakdown.get(slug, 0) + 1

    return {
        "minPrice": round(vals[0], 4),
        "p25": round(_quantile(vals, 0.25), 4),
        "avgPrice": round(sum(vals) / len(vals), 4),
        "medianPrice": round(_quantile(vals, 0.5), 4),
        "p75": round(_quantile(vals, 0.75), 4),
        "premiumPrice": round(_quantile(vals, 0.9), 4),
        "sampleSize": len(vals),
        "sourceBreakdown": breakdown,
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
