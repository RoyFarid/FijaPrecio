"""Entrypoint del microservicio `scraper`.

Expone una API interna (solo red privada) para:
  - POST /internal/scrape        -> lanza un job de scraping bajo demanda
  - GET  /health                 -> healthcheck de Railway

El scheduling nocturno (APScheduler) recolecta el top-N de insumos/productos
más consultados y publica observaciones en la API core.
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException

from app.config import Settings, get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # TODO: arrancar APScheduler si settings.scheduler_enabled
    #       (cron parametrizado desde AppSetting via la API core).
    yield
    # TODO: apagar scheduler / cerrar clientes httpx / navegador Playwright


app = FastAPI(title="FijaPrecio Scraper", lifespan=lifespan)


def require_internal_token(
    x_internal_token: str = Header(default=""),
    settings: Settings = Depends(get_settings),
) -> None:
    if x_internal_token != settings.internal_api_token:
        raise HTTPException(status_code=401, detail="token interno inválido")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/scrape", dependencies=[Depends(require_internal_token)])
async def scrape(payload: dict) -> dict[str, str]:
    # TODO: validar payload (query, scope, sourceSlugs), encolar job,
    #       devolver jobId. El resultado se publica en POST {api}/v1/internal/price-observations
    return {"status": "accepted"}
