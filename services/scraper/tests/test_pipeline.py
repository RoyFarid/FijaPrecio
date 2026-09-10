import pytest

from app.models import RawItem
from app.pipeline import (
    aggregate_market_price,
    build_batch,
    derive_unit_price,
    parse_price,
    trim_bounds,
    unit_qty_in_title,
)

CONV = {("g", "kg"): 0.001, ("ml", "l"): 0.001, ("docena", "unidad"): 12.0}


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("S/ 1,234.50", 1234.50),
        ("S/. 45.00", 45.0),
        ("1.234,56", 1234.56),
        ("S/4.20", 4.20),
        ("1,50", 1.50),
        ("1,500", 1500.0),
        ("PEN 12", 12.0),
        ("agotado", None),
        ("", None),
    ],
)
def test_parse_price(text: str, expected: float | None) -> None:
    assert parse_price(text) == expected


@pytest.mark.parametrize(
    ("title", "expected"),
    [
        ("Harina panadera saco 50 kg", (50.0, "kg")),
        ("Leche entera 900g", (900.0, "g")),
        ("Aceite vegetal 1 L", (1.0, "l")),
        ("Pan francés artesanal", None),
    ],
)
def test_unit_qty_in_title(title: str, expected: tuple[float, str] | None) -> None:
    assert unit_qty_in_title(title) == expected


def test_derive_unit_price_same_unit() -> None:
    item = RawItem(title="Harina panadera 50 kg", price=210.0, currency="PEN")
    assert derive_unit_price(item, "kg", CONV) == pytest.approx(4.2)


def test_derive_unit_price_converts() -> None:
    item = RawItem(title="Manteca vegetal 500 g", price=8.0, currency="PEN")
    assert derive_unit_price(item, "kg", CONV) == pytest.approx(16.0)


def test_derive_unit_price_no_qty_assumes_per_base_unit() -> None:
    item = RawItem(title="Harina especial Flor", price=4.5, currency="PEN")
    assert derive_unit_price(item, "kg", CONV) == 4.5


def test_derive_unit_price_unknown_conversion_is_dropped() -> None:
    item = RawItem(title="Tela jersey 3 m", price=45.0, currency="PEN")
    assert derive_unit_price(item, "kg", CONV) is None


def test_trim_bounds() -> None:
    assert trim_bounds([1, 2, 3, 4, 5, 6, 7, 8, 9, 100], 0.1) == (2, 9)
    assert trim_bounds([4.0], 0.2) == (4.0, 4.0)
    assert trim_bounds([], 0.2) == (0.0, float("inf"))


def test_build_batch_trims_outliers_and_builds_source_ref() -> None:
    items = [
        RawItem(title="Harina A 1 kg", price=4.0, currency="PEN", url="https://x/a"),
        RawItem(title="Harina B 1 kg", price=4.5, currency="PEN", url="https://x/b"),
        RawItem(title="Harina C 1 kg", price=5.0, currency="PEN", url="https://x/c"),
        RawItem(title="Harina D 1 kg", price=4.2, currency="PEN", url="https://x/d"),
        RawItem(title="Harina E 1 kg", price=999.0, currency="PEN", url="https://x/e"),
        RawItem(title="Harina USD 1 kg", price=1.0, currency="USD", url="https://x/usd"),
    ]
    batch = build_batch(
        items,
        canonical_input_id="ci-1",
        base_unit="kg",
        region="PE",
        currency="PEN",
        source_slug="mercadolibre-pe",
        run_key="2026-09-08",
        trim_pct=0.15,
        conversions=CONV,
    )
    prices = sorted(o.price for o in batch.observations)
    assert 999.0 not in prices  # outlier recortado
    assert prices == [4.2, 4.5, 5.0]
    assert all(o.currency == "PEN" for o in batch.observations)  # USD descartado
    assert all(
        o.sourceRef.startswith("mercadolibre-pe:2026-09-08:") for o in batch.observations
    )
    assert all(o.unit == "kg" for o in batch.observations)
    assert all(o.scope == "INPUT" and o.source == "SCRAPE" for o in batch.observations)


def test_aggregate_market_price() -> None:
    priced = [
        (20.0, "mercadolibre-pe"),
        (25.0, "mercadolibre-pe"),
        (28.0, "promart"),
        (30.0, "mercadolibre-pe"),
        (34.0, "promart"),
        (40.0, "mercadolibre-pe"),
        (55.0, "sodimac-pe"),
        (900.0, "mercadolibre-pe"),  # outlier
    ]
    agg = aggregate_market_price(priced, trim_pct=0.15)
    assert agg is not None
    assert agg["minPrice"] == 25.0  # 20 y 900 recortados
    assert agg["premiumPrice"] not in (900.0, None)
    assert agg["sampleSize"] == 6
    breakdown = agg["sourceBreakdown"]
    assert isinstance(breakdown, dict)
    assert breakdown["mercadolibre-pe"] == 3


def test_aggregate_market_price_insufficient_sample() -> None:
    assert aggregate_market_price([(10.0, "s"), (12.0, "s")], trim_pct=0.1) is None


def test_build_batch_empty_when_nothing_priced() -> None:
    batch = build_batch(
        [RawItem(title="x", price=1.0, currency="EUR")],
        canonical_input_id="ci-1",
        base_unit="kg",
        region="PE",
        currency="PEN",
        source_slug="s",
        run_key="k",
        trim_pct=0.1,
        conversions=CONV,
    )
    assert batch.observations == []
