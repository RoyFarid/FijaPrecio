import pytest

from app.models import RawItem
from app.pipeline import (
    PricedItem,
    aggregate_market_price,
    build_batch,
    derive_unit_price,
    matches_query,
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
        PricedItem(20.0, "mercadolibre-pe"),
        PricedItem(25.0, "mercadolibre-pe"),
        PricedItem(28.0, "promart"),
        PricedItem(30.0, "mercadolibre-pe"),
        PricedItem(34.0, "promart"),
        PricedItem(40.0, "mercadolibre-pe"),
        PricedItem(55.0, "sodimac-pe"),
        PricedItem(900.0, "mercadolibre-pe"),  # outlier
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
    priced = [PricedItem(10.0, "s"), PricedItem(12.0, "s")]
    assert aggregate_market_price(priced, trim_pct=0.1) is None


def test_aggregate_market_price_sample_links_sorted_across_sources() -> None:
    priced = [
        PricedItem(25.0, "a", "Caro A", "https://a.pe/caro"),
        PricedItem(20.0, "a", "Barato A", "https://a.pe/barato"),
        PricedItem(22.0, "b", "Único B", "https://b.pe/unico"),
        PricedItem(28.0, "c", "Sin url C", None),  # sin url → no entra en sampleLinks
    ]
    agg = aggregate_market_price(priced, trim_pct=0.0)
    assert agg is not None
    sample_links = agg["sampleLinks"]
    assert isinstance(sample_links, list)
    # ordenado globalmente por precio, mezclando fuentes — no agrupado por fuente
    assert [link["price"] for link in sample_links] == [20.0, 22.0, 25.0]
    assert [link["source"] for link in sample_links] == ["a", "b", "a"]
    assert all(link["source"] != "c" for link in sample_links)  # sin url → afuera


def test_aggregate_market_price_caps_links_per_source() -> None:
    # 5 de la misma fuente, todos con url, tope de 2 → sólo los 2 más baratos
    priced = [PricedItem(float(10 + i), "a", f"Item {i}", f"https://a.pe/{i}") for i in range(5)]
    agg = aggregate_market_price(priced, trim_pct=0.0, links_per_source=2)
    assert agg is not None
    sample_links = agg["sampleLinks"]
    assert isinstance(sample_links, list)
    assert len(sample_links) == 2
    assert [link["price"] for link in sample_links] == [10.0, 11.0]


def test_aggregate_market_price_no_cap_by_default() -> None:
    # sin `links_per_source`, se guardan TODOS los ítems de la fuente, sin tope
    priced = [PricedItem(float(10 + i), "a", f"Item {i}", f"https://a.pe/{i}") for i in range(20)]
    agg = aggregate_market_price(priced, trim_pct=0.0)
    assert agg is not None
    sample_links = agg["sampleLinks"]
    assert isinstance(sample_links, list)
    assert len(sample_links) == 20


def test_aggregate_market_price_no_links_when_no_urls() -> None:
    priced = [PricedItem(10.0, "s"), PricedItem(11.0, "s"), PricedItem(12.0, "s")]
    agg = aggregate_market_price(priced, trim_pct=0.0)
    assert agg is not None
    assert agg["sampleLinks"] == []


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


@pytest.mark.parametrize(
    ("title", "query", "expected"),
    [
        # subcadena, no palabra completa → falso positivo real visto en Plaza Vea/Wong
        ("Pastilla Panadol 500mg 16 Tabletas", "pan", False),
        ("Agua Mineral Acqua Panna Sin Gas Botella 1L", "pan", False),
        ("Panel para Tv VIVA HOME Menorca hasta 55\"", "pan", False),
        ("Sandwichera THOMAS Panini TH-975 Plateado", "pan", False),
        # coincidencia real, palabra completa
        ("Pan de Hamburguesa 8un", "pan", True),
        ("Pan de Molde Integral CeroCero Bolsa 650 g", "pan", True),
        # multi-palabra: basta con que UNA palabra significativa calce
        ("Melamina Blanco 18mm 2.15x2.44m Arauco", "melamina blanca 18mm", True),
        # ninguna palabra de la query aparece → fuera (el "ft" fuzzy de VTEX)
        ('Madera Pino 1"x2"x10.5" (19mmx41mmx3200mm) Leonera', "tornillo drywall 6x1", False),
        # sin palabras significativas en la query → no se filtra
        ("cualquier cosa", "de la", True),
        # ruido de menaje/decoración: la palabra calza completa pero es un
        # accesorio, no el alimento — falso positivo real visto en Sodimac/Metro
        ("Cuchillo de Pan Krea 20cm", "pan", False),
        ('Cuadro "Con todo" UN PAN CON MANGO 26cm x 26cm', "pan", False),
        ("Tostadora RAF Rebanadas de Pan en Molde 650W", "pan", False),
        # si la propia query pide el accesorio, sí debe encontrarlo
        ("Cuchillo de Pan Krea 20cm", "cuchillo para pan", True),
        # "Pan de Molde" es pan de sándwich real, no un accesorio de cocina
        ("Pan de Molde Blanco Bolsa 480 g", "pan", True),
    ],
)
def test_matches_query(title: str, query: str, expected: bool) -> None:
    assert matches_query(title, query) is expected


def test_matches_query_accepts_custom_noise_words() -> None:
    # override en runtime (AppSetting scraper.accessory_noise_words) — una
    # palabra nueva se puede excluir sin tocar el default de pipeline.py
    assert matches_query("Batidora de Queso Krea", "queso") is True
    custom = frozenset({"batidora"})
    assert matches_query("Batidora de Queso Krea", "queso", noise_words=custom) is False


def test_matches_query_empty_noise_words_disables_filter() -> None:
    # un override vacío desactiva el filtro de menaje por completo
    assert matches_query("Cuchillo de Pan Krea 20cm", "pan", noise_words=frozenset()) is True
