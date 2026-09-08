# FijaPrecio

Asistente de **inteligencia de precios y costeo** para MYPES de LATAM: cruza el
costo real (bottom-up) contra el precio de mercado en vivo (top-down) y dice a
cuánto vender y qué recortar para ser rentable.

- Arquitectura completa → [`ARQUITECTURA.md`](./ARQUITECTURA.md)
- Modelo de datos → [`packages/db/prisma/README.md`](./packages/db/prisma/README.md)
- Despliegue → [`infra/railway/README.md`](./infra/railway/README.md)

## Monorepo

| Ruta | Qué es | Stack |
|------|--------|-------|
| `apps/web` | Frontend (marketing + dashboard) | Next.js 15, React 19 |
| `apps/api` | API core (HTTP + OpenAPI) | NestJS 11 |
| `apps/worker` | Procesadores de colas | NestJS 11 + BullMQ |
| `apps/bot` | Bot de Telegram (webhook) | NestJS 11 + Telegraf |
| `services/scraper` | Recolección de precios | FastAPI + Playwright *(uv, no pnpm)* |
| `services/ocr` | OCR de boletas | FastAPI + PaddleOCR *(uv, no pnpm)* |
| `packages/db` | Cliente Prisma + schema + migraciones + seed | Prisma 6 |
| `packages/config-schema` | Validación de entorno (Zod, fail-fast) | Zod |
| `packages/shared-types` | Contratos de dominio compartidos | Zod |
| `packages/tsconfig`, `packages/eslint-config` | Config compartida | — |

Gestor: **pnpm workspaces** (con `catalog:` para versiones) + **Turborepo**.

## Requisitos

- Node **22+** (`.nvmrc`), pnpm **10** (`corepack enable`)
- Docker (backing services locales)
- Para los servicios Python: [`uv`](https://docs.astral.sh/uv/)

## Arranque local

```bash
corepack enable
pnpm install

cp .env.example .env
pnpm infra:up            # postgres + redis + typesense + minio

pnpm db:migrate          # aplica migraciones + genera client + seed
pnpm dev                 # levanta web + api + worker + bot (turbo)
```

Servicios Python (en otra terminal):

```bash
cd services/scraper && uv sync && uv run uvicorn app.main:app --reload --port 8000
cd services/ocr     && uv sync && uv run uvicorn app.main:app --reload --port 8001
```

## Scripts (raíz)

| Comando | Acción |
|---------|--------|
| `pnpm dev` | Todos los servicios Node en watch |
| `pnpm build` | Build de todo (turbo, cacheado) |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | Calidad |
| `pnpm db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma |
| `pnpm infra:up` / `infra:down` | Docker local |
| `pnpm format` | Prettier |

## Principio rector: cero hardcodeo

- **Infra/secretos** → variables de entorno, validadas con `@fijaprecio/config-schema`
  (Zod). Si falta una requerida, el servicio **no arranca**.
- **Parámetros de negocio** (IGV, márgenes, umbrales, límites de plan, cadencias,
  selectores de scraping) → tablas `AppSetting` / `PlanEntitlement` / `ScrapingSource`.
- **Textos** → i18n.
- Lint prohíbe `process.env` fuera de `config-schema`.

Checklist de PR en [`ARQUITECTURA.md`](./ARQUITECTURA.md) §21.
