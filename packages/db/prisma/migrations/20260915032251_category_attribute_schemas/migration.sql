-- Esquema de atributos por categoría: qué preguntarle al usuario para armar
-- una búsqueda de scraping precisa en vez de depender solo del nombre libre
-- ("Pan" → peso + tipo de harina). Dos árboles separados a propósito (insumos
-- vs. producto final) — se evalúa unificarlos más adelante.

CREATE TYPE "AttributeValueType" AS ENUM ('TEXT', 'NUMBER', 'NUMBER_WITH_UNIT', 'ENUM', 'BOOLEAN');

-- Plantilla de búsqueda en la categoría de insumos existente.
ALTER TABLE "InputCategory" ADD COLUMN "searchQueryTemplate" TEXT;

CREATE TABLE "InputCategoryAttribute" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" "AttributeValueType" NOT NULL,
    "unit" TEXT,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "helpText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InputCategoryAttribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InputCategoryAttribute_categoryId_key_key" ON "InputCategoryAttribute"("categoryId", "key");
CREATE INDEX "InputCategoryAttribute_categoryId_idx" ON "InputCategoryAttribute"("categoryId");

ALTER TABLE "InputCategoryAttribute" ADD CONSTRAINT "InputCategoryAttribute_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "InputCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Árbol de categorías de producto final (rubro → categoría → subcategoría → tipo).
CREATE TABLE "ProductCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" UUID,
    "rubro" TEXT,
    "searchQueryTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");
CREATE INDEX "ProductCategory_parentId_idx" ON "ProductCategory"("parentId");
CREATE INDEX "ProductCategory_rubro_idx" ON "ProductCategory"("rubro");

ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProductCategoryAttribute" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" "AttributeValueType" NOT NULL,
    "unit" TEXT,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "helpText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategoryAttribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCategoryAttribute_categoryId_key_key" ON "ProductCategoryAttribute"("categoryId", "key");
CREATE INDEX "ProductCategoryAttribute_categoryId_idx" ON "ProductCategoryAttribute"("categoryId");

ALTER TABLE "ProductCategoryAttribute" ADD CONSTRAINT "ProductCategoryAttribute_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Producto final: a qué categoría pertenece + los valores de sus atributos.
ALTER TABLE "Product" ADD COLUMN "categoryId" UUID;
ALTER TABLE "Product" ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Prisma quiere dropear estas FKs porque las refs "...ById" son escalares sueltos
-- en schema.prisma (a propósito: no inflar el modelo User). Las re-afirmamos aquí
-- de forma idempotente para que `migrate deploy` en un entorno limpio no las pierda.
-- Mismo patrón que 20260908004818_recipe_output_quantity / .../20260913004254.
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
