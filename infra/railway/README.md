# Despliegue en Railway

Un **proyecto** con dos **entornos**: `staging` y `production` (+ PR environments).

## Servicios

| Servicio | Root Directory | Builder | Config | Dominio público |
|----------|----------------|---------|--------|-----------------|
| `web` | `/` (repo root) | Nixpacks | `apps/web/railway.json` | ✅ app.fijaprecio.com |
| `api` | `/` | Nixpacks | `apps/api/railway.json` | ✅ api.fijaprecio.com |
| `worker` | `/` | Nixpacks | `apps/worker/railway.json` | ❌ (solo healthcheck) |
| `bot` | `/` | Nixpacks | `apps/bot/railway.json` | ✅ bot.fijaprecio.com |
| `scraper` | `/services/scraper` | Dockerfile | `services/scraper/railway.json` | ❌ red privada |
| `ocr` | `/services/ocr` | Dockerfile | `services/ocr/railway.json` | ❌ red privada |
| `search` | — (template Typesense) | — | — | ❌ + volumen |
| `Postgres` | plugin nativo | — | — | — |
| `Redis` | plugin nativo | — | — | — |

> Los servicios Node usan **Root Directory = repo root** (necesitan el workspace
> pnpm completo). Cada `railway.json` filtra su build con `turbo --filter` y
> declara `watchPatterns` para no redeployar de más.
> Los servicios Python usan **Root Directory = su carpeta** (aislados, Dockerfile propio).

## Cron services (crean, ejecutan, terminan)

| Servicio cron | Schedule | Comando |
|---------------|----------|---------|
| `cron-scrape-nightly` | `0 5 * * *` | `POST scraper:/internal/scrape` del top-N |
| `cron-gov-sync` | `0 6 * * *` | sync SISAP / MIDAGRI / tipo de cambio |
| `cron-consensus-refresh` | `*/30 * * * *` | encola `consensus:recalc` pendientes |
| `cron-alerts-check` | `0 * * * *` | encola `alerts:check` |
| `cron-cleanup` | `0 3 * * *` | retención de boletas, purga de jobs, anonimización |

Los schedules NO se hardcodean: `railway.json` del cron los toma de una variable
(`CRON_SCHEDULE`) y la lógica de negocio lee `AppSetting`.

## Variables (reference variables)

Compartidas del proyecto (`shared`): `INTERNAL_API_TOKEN`, `R2_*`, `SENTRY_DSN`,
`DEFAULT_CURRENCY/LOCALE/TIMEZONE`.

Por servicio, resueltas con referencias:

```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
REDIS_URL    = ${{Redis.REDIS_URL}}
SCRAPER_URL  = http://${{scraper.RAILWAY_PRIVATE_DOMAIN}}:8000
OCR_URL      = http://${{ocr.RAILWAY_PRIVATE_DOMAIN}}:8001
API_URL      = http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001
```

Cada `.env.example` (raíz y por app) documenta el set completo. La validación
Zod / pydantic-settings aborta el arranque si falta algo.

## Migraciones

El servicio `api` corre `prisma migrate deploy` como parte de su `startCommand`
(ver `apps/api/railway.json`). Migraciones expand/contract para rollback seguro.

## Orden de primer despliegue

1. `Postgres`, `Redis`, `search` (+ volumen).
2. `api` (corre migraciones; cargar seed una vez: `pnpm db:seed` con `DATABASE_URL` de prod).
3. `worker`, `scraper`, `ocr`.
4. `bot` (registra webhook al arrancar si `BOT_PUBLIC_URL` es https).
5. `web`.
6. Cron services.
