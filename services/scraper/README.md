# services/scraper

Microservicio Python (FastAPI + Playwright) de recolección de precios de insumos.
No forma parte del workspace pnpm — se maneja con **uv**.

## Local

```bash
cd services/scraper
uv sync
uv run playwright install chromium        # solo si vas a usar fuentes PLAYWRIGHT
cp .env.example .env
uv run uvicorn app.main:app --reload --port 8000
```

Requiere Postgres + la API core levantados (`pnpm infra:up` y `pnpm dev` en la raíz).

```bash
uv run pytest        # funciones puras de pipeline
uv run ruff check .
uv run mypy app
```

## Cómo funciona

```
scheduler (cada SCRAPER_SWEEP_INTERVAL_MINUTES)
  → GET  {API_URL}/v1/internal/scrape-targets   (insumos usados, consenso más viejo primero)
  → por cada target, por cada ScrapingSource enabled:
      collector.collect(source, query)           (API ML / httpx+selectolax / Playwright)
      pipeline: parse precio → precio por baseUnit (UnitConversion) → recorte de extremos
      POST {API_URL}/v1/internal/price-observations   (batch, X-Internal-Token, idempotente por sourceRef)
  → el worker recalcula PriceConsensus
```

- **Config de negocio en la DB**: selectores y search-paths en `ScrapingSource.config`;
  `scraper.outlier_trim_pct` / `top_n_nightly` en `AppSetting`. El código Python no
  tiene parámetros.
- **`sourceRef`** = `{slug}:{YYYY-MM-DD}:{hash(url)}` → re-raspar el mismo día es
  idempotente; otro día crea observaciones nuevas.
- **MercadoLibre**: API oficial (preferida). Sin `MERCADOLIBRE_ACCESS_TOKEN` el
  search puede devolver 401 → se loguea y se omite esa fuente.
- **On-demand** (Premium): `POST /internal/scrape` con `{canonicalInputId, query, baseUnit}`.

## Endpoints

| | |
|---|---|
| `GET /health` · `GET /health/ready` | healthcheck de Railway |
| `POST /internal/scrape` | corre un target ahora (`X-Internal-Token`) |

## Pendiente

- Radar de producto final (`scope=FINAL_PRODUCT` → `MarketPrice` agregado).
- Conversión de moneda (ítems en USD se descartan; falta lookup de `ExchangeRate`).
- `gov-data-connectors` (SISAP / MIDAGRI / tipo de cambio) — servicio aparte.
- Registro de `ScrapingJob` por corrida.

## Railway

- Servicio con **Root Directory = `services/scraper`**, builder Dockerfile.
- Sin dominio público (solo red privada). Lo llama `api`.
- Ver `../../infra/railway/README.md`.
