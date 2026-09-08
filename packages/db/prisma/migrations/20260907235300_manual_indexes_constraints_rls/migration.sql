-- =============================================================================
-- FijaPrecio — Migración manual 0001
-- Cosas que Prisma no puede expresar en el schema:
--   A) Índices UNIQUE parciales
--   B) FKs para las "refs sueltas" (...ById) con ON DELETE SET NULL
--   C) Row-Level Security (defensa en profundidad para multi-tenancy)
--
-- Cómo aplicarla:
--   1. Genera la migración base:   prisma migrate dev --name init --create-only
--   2. Copia el contenido de este archivo AL FINAL del .sql generado por Prisma
--      (o mantenlo como migración separada con su propio directorio bajo
--       prisma/migrations/ y un migration.sql que haga \i de este archivo).
--   3. prisma migrate dev   (o  prisma migrate deploy  en Railway como release cmd)
--
-- Todas las sentencias son idempotentes (IF NOT EXISTS / DROP ... IF EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) ÍNDICES UNIQUE PARCIALES
-- -----------------------------------------------------------------------------

-- AppSetting: exactamente un valor por clave GLOBAL, y uno por (org, clave).
-- (El @@unique de Prisma no basta porque múltiples NULL en organizationId no colisionan.)
CREATE UNIQUE INDEX IF NOT EXISTS "app_setting_global_key_uniq"
  ON "AppSetting" ("key")
  WHERE "scope" = 'GLOBAL';

CREATE UNIQUE INDEX IF NOT EXISTS "app_setting_org_key_uniq"
  ON "AppSetting" ("organizationId", "key")
  WHERE "scope" = 'ORGANIZATION';

-- ProductRecipe: una sola receta activa por producto.
CREATE UNIQUE INDEX IF NOT EXISTS "product_recipe_one_active"
  ON "ProductRecipe" ("productId")
  WHERE "isActive" = true;

-- MarketplacePlacement: un placement activo por (supplier, insumo) y por (supplier, categoría).
CREATE UNIQUE INDEX IF NOT EXISTS "placement_active_input_uniq"
  ON "MarketplacePlacement" ("supplierId", "canonicalInputId")
  WHERE "active" = true AND "canonicalInputId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "placement_active_category_uniq"
  ON "MarketplacePlacement" ("supplierId", "categoryId")
  WHERE "active" = true AND "categoryId" IS NOT NULL;

-- PriceObservation: evita duplicados de crowdsourcing manual (misma persona,
-- mismo insumo, misma región, mismo día). Para scrape/official la idempotencia
-- ya la da @@unique([source, sourceRef]).
CREATE UNIQUE INDEX IF NOT EXISTS "price_obs_manual_daily_uniq"
  ON "PriceObservation" ("reporterUserId", "canonicalInputId", "region", (("observedAt")::date))
  WHERE "source" = 'MANUAL' AND "canonicalInputId" IS NOT NULL AND "reporterUserId" IS NOT NULL;


-- -----------------------------------------------------------------------------
-- B) FOREIGN KEYS PARA REFS SUELTAS  (ON DELETE SET NULL)
--    Prisma no las declara para no inflar el modelo User. Aquí sí las queremos
--    a nivel de base de datos.
-- -----------------------------------------------------------------------------

ALTER TABLE "Invitation"            DROP CONSTRAINT IF EXISTS "Invitation_invitedById_fkey";
ALTER TABLE "Invitation"            ADD  CONSTRAINT "Invitation_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "ApiKey"                DROP CONSTRAINT IF EXISTS "ApiKey_createdById_fkey";
ALTER TABLE "ApiKey"                ADD  CONSTRAINT "ApiKey_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "AppSetting"            DROP CONSTRAINT IF EXISTS "AppSetting_updatedById_fkey";
ALTER TABLE "AppSetting"            ADD  CONSTRAINT "AppSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "CanonicalInput"        DROP CONSTRAINT IF EXISTS "CanonicalInput_createdById_fkey";
ALTER TABLE "CanonicalInput"        ADD  CONSTRAINT "CanonicalInput_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "Supplier"              DROP CONSTRAINT IF EXISTS "Supplier_createdById_fkey";
ALTER TABLE "Supplier"              ADD  CONSTRAINT "Supplier_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "SupplierCatalogUpload" DROP CONSTRAINT IF EXISTS "SupplierCatalogUpload_uploadedById_fkey";
ALTER TABLE "SupplierCatalogUpload" ADD  CONSTRAINT "SupplierCatalogUpload_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "Product"              DROP CONSTRAINT IF EXISTS "Product_createdById_fkey";
ALTER TABLE "Product"              ADD  CONSTRAINT "Product_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "ProductRecipe"        DROP CONSTRAINT IF EXISTS "ProductRecipe_createdById_fkey";
ALTER TABLE "ProductRecipe"        ADD  CONSTRAINT "ProductRecipe_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "Scenario"            DROP CONSTRAINT IF EXISTS "Scenario_createdById_fkey";
ALTER TABLE "Scenario"            ADD  CONSTRAINT "Scenario_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "Alert"              DROP CONSTRAINT IF EXISTS "Alert_createdById_fkey";
ALTER TABLE "Alert"              ADD  CONSTRAINT "Alert_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "ScrapingJob"        DROP CONSTRAINT IF EXISTS "ScrapingJob_requestedById_fkey";
ALTER TABLE "ScrapingJob"        ADD  CONSTRAINT "ScrapingJob_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "PaymentEvent"       DROP CONSTRAINT IF EXISTS "PaymentEvent_organizationId_fkey";
ALTER TABLE "PaymentEvent"       ADD  CONSTRAINT "PaymentEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL;

-- AuditLog.actorId puede ser un id de servicio (no-User) => NO ponemos FK.


-- -----------------------------------------------------------------------------
-- C) ROW-LEVEL SECURITY  (opcional pero recomendado — defensa en profundidad)
--
--    El aislamiento primario es la capa de aplicación (NestJS inyecta
--    organizationId en cada query). RLS es la red de seguridad ante un bug.
--
--    La app debe fijar el tenant por transacción:
--        SET LOCAL app.current_org = '<uuid>';
--        SET LOCAL app.bypass_rls  = 'off';   -- 'on' solo para jobs/admin
--
--    El rol de conexión de la app NO debe ser superusuario ni BYPASSRLS.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  -- SOLO tablas con columna "organizationId" propia. Las tablas hijas
  -- (RecipeLine, CostComponent, ScenarioOverride, ScenarioResult,
  --  ReceiptLineItem, SupplierCatalogItem, CanonicalInputAlias) NO llevan
  --  organizationId: se acceden siempre vía su padre y quedan fuera de RLS.
  tenant_tables text[] := ARRAY[
    'Membership','Invitation','TelegramLink','ApiKey','Subscription',
    'AppSetting','Product','CostingSnapshot','Scenario','OrgInput',
    'Supplier','SupplierCatalogUpload','PriceObservation','MarketPrice',
    'Receipt','ScrapingJob','Alert','Notification','ReputationEvent',
    'AuditLog','MarketplaceEvent'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "organizationId" IS NULL
        OR "organizationId" = NULLIF(current_setting('app.current_org', true), '')::uuid
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR "organizationId" IS NULL
        OR "organizationId" = NULLIF(current_setting('app.current_org', true), '')::uuid
      );
    $f$, t);
  END LOOP;
END $$;

-- Si más adelante quieres RLS también en las tablas hijas, la opción limpia es
-- agregarles una columna "organizationId" denormalizada mantenida por trigger
-- desde el padre. Para el MVP no hace falta: se accede siempre vía el padre.
