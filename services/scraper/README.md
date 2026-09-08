# services/scraper

Microservicio Python (FastAPI + Playwright) de recolección de precios.
No forma parte del workspace pnpm — se maneja con **uv**.

## Local

```bash
cd services/scraper
uv sync
uv run playwright install chromium
uv run uvicorn app.main:app --reload --port 8000
```

## Responsabilidades

- **API oficial de MercadoLibre** (preferida sobre scraping).
- **Playwright** para retailers con JS (Sodimac, Promart, Falabella…). Los
  selectores viven en `ScrapingSource.config` (Postgres), NO en el código.
- **APScheduler**: recolección nocturna del top-N más consultado.
- Normaliza (unidad + moneda), descarta outliers (MAD/IQR) y publica en
  `POST {API_URL}/v1/internal/price-observations` con `X-Internal-Token`.

## Railway

- Servicio con **Root Directory = `services/scraper`**, builder Dockerfile.
- Sin dominio público (solo red privada). Lo llaman `api` y `worker`.
- Ver `../../infra/railway/README.md`.
