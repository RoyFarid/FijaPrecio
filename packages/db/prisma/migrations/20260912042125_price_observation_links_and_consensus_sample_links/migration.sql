-- título/link del ítem real y slug de la tienda detrás de cada PriceObservation
-- de scraping (para el "ver opciones" de Sensibilidad). Null en filas de antes
-- de este campo, y siempre null para MANUAL/OCR/SUPPLIER/OFFICIAL.
ALTER TABLE "PriceObservation" ADD COLUMN     "title" TEXT,
ADD COLUMN     "url" TEXT,
ADD COLUMN     "storeSlug" TEXT;

-- Ítems reales (fuente/título/precio/link) detrás de la mediana de consenso —
-- mismo shape [{ source, title, price, url }] que MarketPrice.sampleLinks.
ALTER TABLE "PriceConsensus" ADD COLUMN     "sampleLinks" JSONB;

-- -----------------------------------------------------------------------------
-- Prisma quiere dropear estas FKs porque las refs "...ById" son escalares sueltos
-- en schema.prisma (a propósito: no inflar el modelo User). Las re-afirmamos aquí
-- de forma idempotente para que `migrate deploy` en un entorno limpio no las pierda.
-- Mismo patrón que 20260908004818_recipe_output_quantity / 20260911034631 / 20260911042907.
-- Fuente: prisma/manual/0001_indexes_constraints_rls.sql (sección B).
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
