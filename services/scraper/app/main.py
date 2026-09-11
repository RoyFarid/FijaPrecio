"""Entrypoint del microservicio `scraper` (FastAPI).

  GET  /health            healthcheck de Railway
  POST /internal/scrape   corre un target ahora (on-demand / Premium)

El barrido programado lo maneja APScheduler (ver app/scheduler.py).
Todo detrás de red privada + `X-Internal-Token`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException

from app.config import Settings, get_settings
from app.core_client import core
from app.db import db
from app.logging import configure_logging, log
from app.models import RadarTarget, ScrapeRequest, ScrapeResult, ScrapeTarget
from app.scheduler import start_scheduler, stop_scheduler
from app.scraper import run_radar_target, run_target


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    await db.connect()
    start_scheduler()
    log.info("scraper.up")
    yield
    stop_scheduler()
    await core.close()
    await db.close()


app = FastAPI(title="FijaPrecio Scraper", lifespan=lifespan)


def require_internal_token(
    settings: Annotated[Settings, Depends(get_settings)],
    x_internal_token: Annotated[str, Header()] = "",
) -> None:
    if x_internal_token != settings.internal_api_token:
        raise HTTPException(status_code=401, detail="token interno inválido")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
async def ready() -> dict[str, object]:
    checks: dict[str, str] = {"database": "down"}
    try:
        await db.pool.fetchval("SELECT 1")
        checks["database"] = "up"
    except Exception:  # noqa: BLE001
        pass
    ok = all(v == "up" for v in checks.values())
    return {"status": "ready" if ok else "degraded", "checks": checks}


@app.post("/internal/scrape", dependencies=[Depends(require_internal_token)])
async def scrape(
    req: ScrapeRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> object:
    region = req.region or settings.default_region

    if req.scope == "FINAL_PRODUCT":
        if not req.product_id:
            raise HTTPException(status_code=422, detail="scope=FINAL_PRODUCT requiere productId")
        return await run_radar_target(
            RadarTarget(
                productId=req.product_id,
                query=req.query,
                region=region,
                currency=req.currency,
                rubro=req.rubro,
            ),
            source_slugs=req.source_slugs,
        )

    if not (req.canonical_input_id and req.base_unit):
        raise HTTPException(
            status_code=422, detail="scope=INPUT requiere canonicalInputId y baseUnit"
        )
    result: ScrapeResult = await run_target(
        ScrapeTarget(
            canonicalInputId=req.canonical_input_id,
            query=req.query,
            baseUnit=req.base_unit,
            rubro=req.rubro,
        ),
        region=region,
        source_slugs=req.source_slugs,
    )
    return result
