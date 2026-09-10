# FijaPrecio — Capa de datos (Prisma + PostgreSQL)

/ Ver también: [`../../../ARQUITECTURA.md`](../../../ARQUITECTURA.md) §8 (modelo de datos) y §7 (config-driven).

## 1. Requisitos

| Cosa | Versión / nota |
|------|----------------|
| PostgreSQL | **16+** (usa `uuid` nativo, `gen_random_uuid`, índices parciales, RLS `FORCE`) |
| Prisma ORM | **6.1 – 6.x** (probado con 6.19.3). Se necesita `@default(uuid(7))`. ⚠️ `prisma@latest` hoy resuelve a la **nueva CLI de plataforma 8.x** (otro producto): fija `prisma@6` y `@prisma/client@6` en `package.json`. |
| Extensiones | `pgcrypto`, `pg_trgm`, `unaccent`, `citext` — declaradas en `datasource.extensions`; Prisma emite el `CREATE EXTENSION` en la migración |
| Preview features | `postgresqlExtensions` (sigue en preview en 6.x; si actualizas a una versión donde sea GA, quita el flag de `generator client`) |

`package.json` de `apps/api`:
```json
{
  "devDependencies": { "prisma": "6.19.3" },
  "dependencies": { "@prisma/client": "6.19.3" }
}
```

Estado: `prisma validate` ✅ y `prisma format` ✅ pasados con 6.19.3.

En Railway, `DATABASE_URL` la inyecta el plugin de Postgres:
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```
No hay nada de esto en el código: la URL, el pool, el schema — todo por env.

## 2. Estructura de archivos

```
prisma/
├─ schema.prisma                         # el modelo (fuente de verdad del esquema)
├─ seed.ts                               # datos base: planes, entitlements, app_settings, fuentes
├─ manual/
│  └─ 0001_indexes_constraints_rls.sql   # índices parciales + FKs sueltas + RLS
└─ migrations/                            # generadas por Prisma (<timestamp>_init/migration.sql, ...)
```

> `prisma/manual/` va FUERA de `prisma/migrations/` a propósito: Prisma trata cada
> subcarpeta de `migrations/` como una migración y falla (P3015) si no hay un
> `migration.sql` dentro.
>
> Prisma no sabe expresar índices UNIQUE parciales, FKs para refs sueltas ni RLS.
> Todo eso vive en `prisma/manual/0001_*.sql`. Después de `prisma migrate dev`,
> copia ese contenido dentro del `migration.sql` recién generado (al final) y
> vuelve a aplicar, o crea una segunda migración con ese SQL. Ver cabecera del
> `.sql` para el paso a paso.

Este paquete es `@fijaprecio/db` y vive en `packages/db/`. `api`, `worker` y `bot`
lo consumen (`import { createPrismaClient, Prisma, ... } from '@fijaprecio/db'`).

## 3. Comandos

Desde la raíz del monorepo (delegan en `packages/db` vía `pnpm --filter`):

```bash
pnpm db:migrate     # prisma migrate dev  (crea/aplica migración + regenera + seed)
pnpm db:deploy      # prisma migrate deploy  (prod / CI)
pnpm db:seed        # prisma db seed
pnpm db:studio      # prisma studio
pnpm db:generate    # turbo run db:generate  (genera el client en todo el repo)
```

> **Carga del `.env`**: los scripts locales (`migrate:dev`, `migrate:reset`,
> `seed`, `studio`) usan `dotenv-cli` para leer el `.env` de la **raíz** del
> monorepo (`dotenv -e ../../.env -- prisma ...`). Prisma por sí solo solo mira
> `./` y `./prisma/`, nunca sube al root. `migrate:deploy` NO lo usa: en Railway
> las variables ya vienen inyectadas en el proceso.

Primera vez (bootstrap de una base vacía):

```bash
pnpm infra:up                              # levanta Postgres (contenedor, puerto host 5433)
cd packages/db
pnpm exec dotenv -e ../../.env -- prisma migrate dev --name init
pnpm exec dotenv -e ../../.env -- prisma migrate deploy   # aplica la migración manual (índices/RLS)
cd ../.. && pnpm db:seed
```

Dentro de `packages/db/` directamente:

```bash
pnpm exec prisma validate      # ✅ probado con 6.19.3
pnpm exec prisma format
pnpm exec dotenv -e ../../.env -- prisma migrate dev --name <nombre>
```

> **`prisma migrate dev` es interactivo**: si hay cambios de schema sin nombre de
> migración, pide uno por stdin. Pasa `--name <x>` en entornos sin TTY (CI, scripts).

Scripts ya definidos en `packages/db/package.json` (`migrate:dev`, `migrate:deploy`,
`seed`, `studio`, `db:generate`, ...) y `prisma.seed` apuntando a `prisma/seed.ts`.

> **Ojo con la migración manual y `migrate dev`**: `20260907235300_manual_*`
> añade FKs para las refs sueltas (`...ById`) e índices UNIQUE parciales que NO
> están en `schema.prisma`. En cada `migrate dev` posterior, Prisma detecta esas
> FKs como "drift" y mete `DROP CONSTRAINT ..._fkey` al inicio del `.sql`.
>
> Ya pasó en `20260908004818_recipe_output_quantity`: se editó el `migration.sql`
> para (a) quitar los 12 `DropForeignKey` y (b) re-afirmar las FKs de forma
> idempotente al final (bloque copiado de `manual/0001_*.sql` sección B). Si
> editas un `migration.sql` ya aplicado, actualiza también su `checksum` en la
> tabla `_prisma_migrations` (`sha256sum migration.sql`) o Prisma se queja.
> Mejor aún: crear la siguiente con `--create-only` y limpiar los `DROP` **antes**
> de aplicar.

**En Railway**, el servicio `api` corre las migraciones como parte de su arranque
(`apps/api/railway.json`):
```json
{ "deploy": { "startCommand": "pnpm --filter @fijaprecio/db migrate:deploy && node apps/api/dist/main.js" } }
```
Las migraciones son **expand/contract** (backward-compatible) para poder hacer
rollback del deploy sin romper el esquema.

## 4. Decisiones de diseño

| Decisión | Por qué |
|----------|---------|
| **UUID v7** (`uuid(7)`) como PK | Ordenables por tiempo → localidad de índice B-tree parecida a un autoincrement, sin exponer conteos. Cast directo a `::uuid` para RLS. |
| **Decimal, nunca Float** | Dinero y cantidades exactas. `Decimal(14,4)` precios, `Decimal(16,6)` cantidades, `Decimal(18,8)` tasas. |
| **Porcentajes como fracción 0..1** | `marginPct = 0.30`. Evita ambigüedad "¿30 o 0.30?" en toda la app. |
| **`organizationId` en toda entidad de negocio** | Multi-tenancy. Entidades globales (catálogo canónico, planes, settings globales, scraping sources, tasas) no lo llevan. |
| **RLS además del scoping de app** | Defensa en profundidad. El scoping primario lo hace NestJS; RLS te salva de un `where` olvidado. Requiere el rol `fijaprecio_app` NOBYPASSRLS — ver §4b. |
| **`PriceObservation` nunca se borra** | Se marca `REJECTED` con `rejectionReason`. Auditable y reversible: si el algoritmo de consenso cambia, se puede reprocesar. |
| **`PriceConsensus` es tabla, no vista materializada** | El worker hace `upsert` incremental al llegar cada observación (no un `REFRESH` completo). Más barato a escala. |
| **`CostingSnapshot.configUsed`** | Guarda la config efectiva del cálculo (IGV, margen, método de overhead). Un snapshot viejo se puede reproducir aunque la config global haya cambiado. |
| **`inputsHash`** | Hash de receta + precios + config. Permite detectar snapshots obsoletos sin recalcular. |
| **Refs sueltas `...ById`** | `createdById`, `updatedById`, `actorId` son escalares sin relación Prisma → `User` no se convierte en un modelo con 20 back-relations. Los FK (`ON DELETE SET NULL`) se agregan en el SQL manual. |
| **Config de scraping en `ScrapingSource.config` (Json)** | Selectores, paths de búsqueda y headers son **datos**, no código Python. Si Promart cambia su HTML, editas una fila. |
| **`@@unique([source, sourceRef])` en observaciones** | Idempotencia de la ingesta batch del scraper (los `NULL` de `sourceRef` para entradas manuales no colisionan entre sí en Postgres). |
| **`citext` para emails** | Unicidad y lookups case-insensitive sin `lower()` por todos lados. |
| **Índices GIN `gin_trgm_ops`** | Autocompletado y fuzzy-match de insumos (`similarity()`, `ILIKE`) sobre `normalizedName` / `normalizedAlias`. |

## 4b. RLS — activar el filtrado real

Las políticas RLS existen desde `20260907235300_manual_*` (`FORCE ROW LEVEL
SECURITY` + `tenant_isolation` en 21 tablas de tenant, usando
`current_setting('app.current_org')` / `app.bypass_rls`). **Pero el rol dueño
—superusuario en local y en Railway— hace BYPASS de RLS aunque esté FORCE**, así
que hoy RLS no filtra nada. El aislamiento real lo da el `where: { organizationId }`
de cada query (defensa primaria); RLS es la red de seguridad.

Para activarla:

```bash
# 1. crea el rol NOBYPASSRLS (migración; NOLOGIN)
cd packages/db && pnpm exec dotenv -e ../../.env -- prisma migrate deploy

# 2. dale LOGIN + contraseña (local: 'fijaprecio_app')
pnpm --filter @fijaprecio/db rls:setup           # o: APP_DB_PASSWORD=xxx ...

# 3. verifica que filtra
pnpm --filter @fijaprecio/db rls:check

# 4. en .env:  DB_RLS_ENFORCED=true   (APP_DATABASE_URL ya apunta al rol)
```

Con `DB_RLS_ENFORCED=true` (+ `APP_DATABASE_URL`) la **API** conecta como
`fijaprecio_app` y monta la extensión Prisma `rls`
(`apps/api/src/prisma/rls.extension.ts`): cada op de modelo se envuelve en una tx
que fija `app.current_org` o `app.bypass_rls` según el `OrgContext` que pone
`JwtAuthGuard` (`tenant` para requests autenticadas, `system` para rutas
`@Public()` marcadas `@RlsSystem()`). Transacciones interactivas y `$queryRaw`
sobre tablas de tenant van por `PrismaService.withRls(fn, orgId?)` /
`asSystem(fn)` (usan el cliente base sin la extensión, bajo `rlsReentry`). El
`worker` y el `bot` siguen conectando como el dueño (son actores de sistema).

> **Servicios ya migrados** (`auth.register`→`asSystem`, `products.create`→
> `withRls`, `scrapeTargets`/`radarTargets` raw→`asSystem`, controladores
> internos con `@RlsSystem()`). Build/typecheck/lint/test verdes. **Falta
> probarlo con Postgres arriba** (Docker) antes de poner `DB_RLS_ENFORCED=true`.
>
> En Railway: crear el rol con las credenciales del owner
> (`ALTER ROLE fijaprecio_app WITH LOGIN PASSWORD '<secreto>'`) y pasar
> `APP_DATABASE_URL` con ese usuario.
>
> **Aplicar `rls_app_role` con `migrate deploy`, no `migrate dev`** — `migrate dev`
> vuelve a generar los `DROP CONSTRAINT` de las FKs sueltas (ver 3.).

## 5. Cómo se resuelve un valor de configuración (Nivel 2 del "cero hardcodeo")

Nada de negocio está hardcodeado. El `ConfigService` de NestJS resuelve así:

```
valorEfectivo(key, org) =
     AppSetting(scope=ORGANIZATION, org, key)          // override de la org
  ?? PlanEntitlement(planDe(org), key)                 // según el plan
  ?? AppSetting(scope=GLOBAL, key)                      // default global (seed)
  ?? DEFAULT_DE_CODIGO[key]                             // última red; loguea warning
```

Con cache en Redis (TTL corto) invalidado por evento al guardar desde el panel admin.

Claves típicas en `AppSetting` (GLOBAL), sembradas por `seed.ts`:

| key | value | usado por |
|-----|-------|-----------|
| `tax.igv_rate` | `0.18` | motor de costeo |
| `costing.default_margin_pct` | `0.30` | motor de costeo |
| `costing.overhead_method` | `"PCT_OF_DIRECT_COST"` | motor de costeo |
| `consensus.window_days` | `90` | motor de consenso |
| `consensus.min_sample_size` | `5` | ¿mostrar sugerencia? |
| `consensus.outlier_method` | `"MAD"` | detección de outliers |
| `consensus.mad_threshold` | `3.5` | detección de outliers |
| `consensus.source_weights` | `{"OFFICIAL":1,"OCR":0.9,"SUPPLIER":0.8,"SCRAPE":0.7,"MANUAL":0.5}` | ponderación |
| `consensus.recency_halflife_days` | `45` | decaimiento temporal |
| `reputation.points` | `{"OBSERVATION_SURVIVED":5,"OCR_VERIFIED":10,"OBSERVATION_REJECTED":-3}` | worker de reputación |
| `scraper.default_cadence` | `"weekly"` | cron nocturno |
| `receipts.retention_days` | `365` | cron de limpieza |
| `catalog.match_min_similarity` | `0.35` | matching trigram |
| `units.allowed` | `["m","kg","g","l","ml","unidad","docena","millar","rollo","cono"]` | validación de unidades |

Límites por plan en `PlanEntitlement`:

| plan | key | value |
|------|-----|-------|
| FREE | `ocr_receipts_per_month` | `5` |
| FREE | `scraper_cadence` | `"weekly"` |
| FREE | `scenario_simulator` | `false` |
| FREE | `radar_history_days` | `7` |
| FREE | `alerts_max` | `3` |
| PREMIUM | `ocr_receipts_per_month` | `-1` (ilimitado) |
| PREMIUM | `scraper_cadence` | `"daily"` |
| PREMIUM | `scenario_simulator` | `true` |
| PREMIUM | `radar_history_days` | `90` |
| PREMIUM | `on_demand_scrape` | `false` |
| BUSINESS | `on_demand_scrape` | `true` |
| BUSINESS | `api_access` | `true` |
| BUSINESS | `seats` | `5` |

Cambiar cualquiera de estos = editar una fila. **Cero deploy.**

## 6. Relaciones de borrado (resumen)

- `Organization` borrada → **cascade** a todo lo del tenant (dev). En prod se usa `archivedAt`.
- `User` borrado → `SetNull` en refs sueltas y en `reporterUserId`; `Membership`/`RefreshToken` cascade.
- `Product` → cascade a recetas, snapshots, escenarios, alertas.
- `ProductRecipe` → cascade a líneas y componentes; los `CostingSnapshot` también (histórico se conserva mientras exista el producto).
- `CanonicalInput` → `Restrict` implícito para merges (usar `mergedIntoId`), cascade a alias y observaciones.
- `OrgInput` usado por `RecipeLine` → `Restrict` (no puedes borrar un insumo que está en una receta).

## 7. Índice de dominios en `schema.prisma`

1. Tenancy & identidad — `Organization`, `User`, `Membership`, `Invitation`, `RefreshToken`, `TelegramLink`, `ApiKey`
2. Billing & planes — `Plan`, `PlanEntitlement`, `Subscription`, `PaymentEvent`
3. Configuración — `AppSetting`, `FeatureFlag`, `NotificationTemplate`, `UnitConversion`
4. Catálogo e insumos — `InputCategory`, `CanonicalInput`, `CanonicalInputAlias`, `OrgInput`, `Supplier`, `SupplierCatalogUpload`, `SupplierCatalogItem`
5. Productos & costeo — `Product`, `ProductRecipe`, `RecipeLine`, `CostComponent`, `CostingSnapshot`, `Scenario`, `ScenarioOverride`, `ScenarioResult`
6. Inteligencia de precios — `PriceObservation`, `PriceConsensus`, `MarketPrice`, `ReputationEvent`
7. Boletas / OCR — `Receipt`, `ReceiptLineItem`
8. Scraping & datos externos — `ScrapingSource`, `ScrapingJob`, `GovDataSource`, `GovDataSync`, `ExchangeRate`
9. Alertas & notificaciones — `Alert`, `Notification`
10. Marketplace (lead-gen) — `MarketplacePlacement`, `MarketplaceEvent`
11. Auditoría — `AuditLog`

## 8. Pendientes / evolución

- **Particionado** de `PriceObservation` y `AuditLog` por mes (`observedAt` / `createdAt`) cuando el volumen lo pida — declararlo en SQL manual, Prisma lo tolera.
- **Read replica** + esquema analítico (`analytics.*`) con vistas materializadas para data-products (§14 arquitectura). No toca este schema.
- **Denormalizar `organizationId`** en tablas hijas si se quiere RLS en ellas (trigger desde el padre).
- **Multi-file schema** (`prismaSchemaFolder`): si el archivo crece, se puede partir en `prisma/schema/*.prisma` por dominio. Hoy un solo archivo es más fácil de revisar.
