"""Orquestación: para un insumo, colecta de todas las fuentes habilitadas,
normaliza y publica las observaciones en la API core."""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from app.collectors import get_collector
from app.config import get_settings
from app.core_client import core
from app.db import db
from app.logging import log
from app.models import (
    MarketSnapshotBatch,
    MarketSnapshotOut,
    RadarTarget,
    ScrapeResult,
    ScrapeTarget,
)
from app.pipeline import (
    DEFAULT_ACCESSORY_NOISE_WORDS,
    PricedItem,
    aggregate_market_price,
    build_batch,
    derive_unit_price,
    matches_query,
)
from app.rubros import source_serves


async def run_target(
    target: ScrapeTarget,
    *,
    region: str,
    source_slugs: list[str] | None = None,
) -> ScrapeResult:
    settings = get_settings()
    sources = await db.load_enabled_sources()
    scraper_settings = await db.load_scraper_settings()
    if source_slugs:
        wanted = set(source_slugs)
        sources = [s for s in sources if s.slug in wanted]
    else:
        # sin override explícito: solo las fuentes que sirven este rubro
        sources = [
            s
            for s in sources
            if source_serves(s.rubros, target.rubro, scraper_settings.rubro_aliases)
        ]

    conversions = await db.load_unit_conversions()
    run_key = datetime.now(UTC).strftime("%Y-%m-%d")
    noise_words = scraper_settings.accessory_noise_words or DEFAULT_ACCESSORY_NOISE_WORDS

    items_seen = 0
    published = 0
    errors: list[str] = []

    for source in sources:
        collector = get_collector(source)
        if collector is None:
            continue
        try:
            raw = await collector.collect(source, target.query)
        except Exception as exc:  # noqa: BLE001 — un scraper caído no debe tumbar la corrida
            errors.append(f"{source.slug}: {exc}")
            log.warning("collector.failed", source=source.slug, error=str(exc))
            continue

        # el buscador de la tienda hace match por subcadena ("pan" en "Panadol");
        # nos quedamos solo con lo que trae alguna palabra completa de la query,
        # sin ser menaje/decoración ("Cuchillo de Pan") — ver matches_query.
        raw = [
            item for item in raw if matches_query(item.title, target.query, noise_words=noise_words)
        ]
        items_seen += len(raw)
        batch = build_batch(
            raw,
            canonical_input_id=target.canonical_input_id,
            base_unit=target.base_unit,
            region=region,
            currency=settings.default_currency,
            source_slug=source.slug,
            run_key=run_key,
            trim_pct=scraper_settings.outlier_trim_pct,
            conversions=conversions,
        )
        try:
            published += await core.publish_observations(batch)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"publish/{source.slug}: {exc}")
            log.warning("publish.failed", source=source.slug, error=str(exc))

    return ScrapeResult(
        query=target.query,
        sources_tried=len(sources),
        items_seen=items_seen,
        published=published,
        errors=errors,
    )


class RadarRun(BaseModel):
    query: str
    seen: int
    published: int
    errors: list[str] = Field(default_factory=list)


async def run_radar_target(
    target: RadarTarget,
    *,
    source_slugs: list[str] | None = None,
) -> RadarRun:
    """Radar de competencia: colecta el PRODUCTO FINAL de todas las fuentes,
    agrega (min/p25/avg/median/p75/p90) y publica un snapshot en MarketPrice."""
    sources = await db.load_enabled_sources()
    scraper_settings = await db.load_scraper_settings()
    if source_slugs:
        wanted = set(source_slugs)
        sources = [s for s in sources if s.slug in wanted]
    else:
        sources = [
            s
            for s in sources
            if source_serves(s.rubros, target.rubro, scraper_settings.rubro_aliases)
        ]

    # sin base_unit no hay a qué convertir: se usa el precio del ítem tal cual
    # (igual que antes) — con base_unit, se normaliza paquete → precio unitario.
    conversions = await db.load_unit_conversions() if target.base_unit else {}
    noise_words = scraper_settings.accessory_noise_words or DEFAULT_ACCESSORY_NOISE_WORDS

    priced: list[PricedItem] = []
    errors: list[str] = []
    for source in sources:
        collector = get_collector(source)
        if collector is None:
            continue
        try:
            raw = await collector.collect(source, target.query)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{source.slug}: {exc}")
            continue
        for item in raw:
            if not matches_query(item.title, target.query, noise_words=noise_words):
                continue
            if item.currency.upper() not in {target.currency.upper(), "PEN"}:
                continue
            price = (
                derive_unit_price(item, target.base_unit, conversions)
                if target.base_unit
                else item.price
            )
            if price is None or price <= 0:
                continue
            priced.append(
                PricedItem(
                    price=round(price, 4), source=source.slug, title=item.title, url=item.url
                )
            )

    agg = aggregate_market_price(
        priced,
        trim_pct=scraper_settings.outlier_trim_pct,
        links_per_source=scraper_settings.radar_links_per_source,
    )
    if agg is None:
        log.info("radar.insufficient", query=target.query, seen=len(priced))
        return RadarRun(query=target.query, seen=len(priced), published=0, errors=errors)

    snapshot = MarketSnapshotOut.model_validate(
        {
            "productId": target.product_id,
            "productQuery": target.query,
            "region": target.region,
            "currency": target.currency.upper(),
            **agg,
        }
    )
    published = await core.publish_market_prices(MarketSnapshotBatch(snapshots=[snapshot]))
    return RadarRun(query=target.query, seen=len(priced), published=published, errors=errors)


async def run_scheduled_sweep() -> dict[str, int]:
    settings = get_settings()
    input_targets = await core.get_scrape_targets(settings.targets_per_run)
    total_published = 0
    for target in input_targets:
        result = await run_target(target, region=settings.default_region)
        total_published += result.published

    radar_targets = await core.get_radar_targets(settings.targets_per_run)
    radar_snapshots = 0
    for rt in radar_targets:
        radar_snapshots += (await run_radar_target(rt)).published

    log.info(
        "scrape.sweep_done",
        inputs=len(input_targets),
        observations=total_published,
        radar=len(radar_targets),
        snapshots=radar_snapshots,
    )
    return {
        "inputs": len(input_targets),
        "observations": total_published,
        "radar": len(radar_targets),
        "snapshots": radar_snapshots,
    }
