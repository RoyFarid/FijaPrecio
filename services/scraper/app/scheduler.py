"""APScheduler: barrido periódico de recolección de precios.

La cadencia operativa (`SCRAPER_SWEEP_INTERVAL_MINUTES`) es infra. El top-N de
insumos a raspar y el recorte de outliers son de negocio y salen de la DB.
"""

from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings
from app.logging import log
from app.scraper import run_scheduled_sweep

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    settings = get_settings()
    if not settings.scheduler_enabled:
        log.info("scheduler.disabled")
        return

    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        run_scheduled_sweep,
        trigger=IntervalTrigger(minutes=settings.sweep_interval_minutes),
        id="scrape-sweep",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
    )
    _scheduler.start()
    log.info("scheduler.started", every_minutes=settings.sweep_interval_minutes)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
