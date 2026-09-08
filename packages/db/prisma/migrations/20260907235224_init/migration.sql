-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'CANCELED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "SettingScope" AS ENUM ('GLOBAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "CanonicalInputStatus" AS ENUM ('ACTIVE', 'PENDING_REVIEW', 'MERGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AliasSource" AS ENUM ('USER', 'SYSTEM', 'IMPORT');

-- CreateEnum
CREATE TYPE "SupplierCatalogSource" AS ENUM ('CSV', 'MANUAL', 'API');

-- CreateEnum
CREATE TYPE "CatalogUploadStatus" AS ENUM ('RECEIVED', 'VALIDATING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CostComponentType" AS ENUM ('LABOR', 'OVERHEAD', 'PACKAGING', 'SHIPPING', 'PLATFORM_FEE', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "CostCalcMethod" AS ENUM ('FIXED', 'PER_UNIT', 'PER_HOUR', 'PCT_OF_DIRECT_COST', 'PCT_OF_TOTAL_COST');

-- CreateEnum
CREATE TYPE "ScenarioOverrideType" AS ENUM ('RECIPE_LINE', 'COST_COMPONENT', 'MARGIN', 'INPUT_PRICE', 'SUPPLIER_SWAP');

-- CreateEnum
CREATE TYPE "PriceScope" AS ENUM ('INPUT', 'FINAL_PRODUCT');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('MANUAL', 'OCR', 'SCRAPE', 'OFFICIAL', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "PriceObservationStatus" AS ENUM ('ACTIVE', 'REJECTED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "ReputationReason" AS ENUM ('OBSERVATION_SURVIVED', 'OBSERVATION_REJECTED', 'OCR_VERIFIED', 'SUPPLIER_CONTRIBUTION', 'MANUAL_ADJUST');

-- CreateEnum
CREATE TYPE "ReceiptChannel" AS ENUM ('TELEGRAM', 'WEB', 'API');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PARSED', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "OcrProvider" AS ENUM ('PADDLE', 'TESSERACT', 'TEXTRACT', 'VISION', 'GEMINI');

-- CreateEnum
CREATE TYPE "ScrapingSourceType" AS ENUM ('PLAYWRIGHT', 'HTTP', 'API');

-- CreateEnum
CREATE TYPE "ScrapingJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ScrapingTrigger" AS ENUM ('CRON', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "GovDataKind" AS ENUM ('SISAP', 'MIDAGRI', 'EXCHANGE_RATE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('MARGIN_DROP', 'INPUT_PRICE_RISE', 'COMPETITOR_PRICE_DROP', 'CONSENSUS_SHIFT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ', 'CANCELED');

-- CreateEnum
CREATE TYPE "MarketplaceBidType" AS ENUM ('CPM', 'CPC', 'CPL');

-- CreateEnum
CREATE TYPE "MarketplaceEventType" AS ENUM ('IMPRESSION', 'CLICK', 'LEAD');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'SERVICE');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'PE',
    "region" TEXT NOT NULL DEFAULT 'PE',
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "locale" TEXT NOT NULL DEFAULT 'es-PE',
    "timezone" TEXT NOT NULL DEFAULT 'America/Lima',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-PE',
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "invitedById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" UUID NOT NULL,
    "replacedById" UUID,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "telegramUserId" BIGINT,
    "telegramUsername" TEXT,
    "code" TEXT NOT NULL,
    "codeExpiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdById" UUID,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonth" DECIMAL(14,4),
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntitlement" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "provider" TEXT,
    "providerRef" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organizationId" UUID,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" UUID NOT NULL,
    "scope" "SettingScope" NOT NULL,
    "organizationId" UUID,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "strategy" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-PE',
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitConversion" (
    "id" UUID NOT NULL,
    "fromUnit" TEXT NOT NULL,
    "toUnit" TEXT NOT NULL,
    "factor" DECIMAL(20,10) NOT NULL,
    "category" TEXT,
    "notes" TEXT,

    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" UUID,
    "rubro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InputCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalInput" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "categoryId" UUID,
    "baseUnit" TEXT NOT NULL,
    "status" "CanonicalInputStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "mergedIntoId" UUID,
    "description" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalInputAlias" (
    "id" UUID NOT NULL,
    "canonicalInputId" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "weight" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "source" "AliasSource" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalInputAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgInput" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "canonicalInputId" UUID,
    "displayName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "lastKnownPrice" DECIMAL(14,4),
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "preferredSupplierId" UUID,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" CITEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "regions" TEXT[],
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCatalogUpload" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "organizationId" UUID,
    "uploadedById" UUID,
    "storageKey" TEXT NOT NULL,
    "status" "CatalogUploadStatus" NOT NULL DEFAULT 'RECEIVED',
    "rowCount" INTEGER,
    "errorReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierCatalogUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCatalogItem" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "canonicalInputId" UUID NOT NULL,
    "uploadId" UUID,
    "price" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "unit" TEXT NOT NULL,
    "region" TEXT,
    "minOrderQty" DECIMAL(16,6),
    "source" "SupplierCatalogSource" NOT NULL DEFAULT 'CSV',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "rubro" TEXT,
    "description" TEXT,
    "targetMarginPct" DECIMAL(6,4),
    "targetPrice" DECIMAL(14,4),
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecipe" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "laborMinutes" DECIMAL(12,4),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLine" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "orgInputId" UUID NOT NULL,
    "quantity" DECIMAL(16,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "wastePct" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "unitCostOverride" DECIMAL(14,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostComponent" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "type" "CostComponentType" NOT NULL,
    "label" TEXT NOT NULL,
    "calc" "CostCalcMethod" NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CostComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostingSnapshot" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "totalCost" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "suggestedPrice" DECIMAL(14,4),
    "marginPct" DECIMAL(6,4),
    "targetPrice" DECIMAL(14,4),
    "targetCost" DECIMAL(14,4),
    "costGap" DECIMAL(14,4),
    "breakdown" JSONB NOT NULL,
    "configUsed" JSONB NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "baseRecipeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioOverride" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "type" "ScenarioOverrideType" NOT NULL,
    "targetRef" TEXT,
    "patch" JSONB NOT NULL,

    CONSTRAINT "ScenarioOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioResult" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "totalCost" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "suggestedPrice" DECIMAL(14,4),
    "marginPct" DECIMAL(6,4),
    "breakdown" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" UUID NOT NULL,
    "scope" "PriceScope" NOT NULL,
    "canonicalInputId" UUID,
    "productQuery" TEXT,
    "organizationId" UUID,
    "reporterUserId" UUID,
    "price" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "unit" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'PE',
    "source" "PriceSource" NOT NULL,
    "sourceRef" TEXT,
    "reporterReputation" INTEGER,
    "weight" DECIMAL(6,4),
    "status" "PriceObservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "rejectionReason" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceConsensus" (
    "id" UUID NOT NULL,
    "canonicalInputId" UUID NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'PE',
    "scope" "PriceScope" NOT NULL DEFAULT 'INPUT',
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "median" DECIMAL(14,4) NOT NULL,
    "p25" DECIMAL(14,4) NOT NULL,
    "p75" DECIMAL(14,4) NOT NULL,
    "mean" DECIMAL(14,4) NOT NULL,
    "mad" DECIMAL(14,6) NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceConsensus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "productId" UUID,
    "productQuery" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'PE',
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "minPrice" DECIMAL(14,4) NOT NULL,
    "p25" DECIMAL(14,4),
    "avgPrice" DECIMAL(14,4) NOT NULL,
    "medianPrice" DECIMAL(14,4),
    "p75" DECIMAL(14,4),
    "premiumPrice" DECIMAL(14,4),
    "sampleSize" INTEGER NOT NULL,
    "sourceBreakdown" JSONB NOT NULL,
    "scrapingJobId" UUID,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID,
    "delta" INTEGER NOT NULL,
    "reason" "ReputationReason" NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "channel" "ReceiptChannel" NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
    "ocrProvider" "OcrProvider",
    "rawText" TEXT,
    "issuerRuc" TEXT,
    "documentNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "currency" TEXT,
    "totalAmount" DECIMAL(14,4),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptLineItem" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "rawDescription" TEXT NOT NULL,
    "matchedCanonicalInputId" UUID,
    "quantity" DECIMAL(16,6),
    "unit" TEXT,
    "unitPrice" DECIMAL(14,4),
    "total" DECIMAL(14,4),
    "confidence" DECIMAL(5,4),
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "priceObservationId" UUID,

    CONSTRAINT "ReceiptLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingSource" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ScrapingSourceType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitRpm" INTEGER NOT NULL DEFAULT 10,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingJob" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "organizationId" UUID,
    "requestedById" UUID,
    "scope" "PriceScope" NOT NULL,
    "query" TEXT,
    "normalizedQuery" TEXT,
    "status" "ScrapingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "ScrapingTrigger" NOT NULL DEFAULT 'CRON',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovDataSource" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GovDataKind" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovDataSync" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "rowCount" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GovDataSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" UUID NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL,
    "validOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "productId" UUID,
    "canonicalInputId" UUID,
    "thresholds" JSONB NOT NULL,
    "channels" "NotificationChannel"[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "lastCheckedAt" TIMESTAMP(3),
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "templateCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePlacement" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "canonicalInputId" UUID,
    "categoryId" UUID,
    "regions" TEXT[],
    "bidType" "MarketplaceBidType" NOT NULL,
    "bidAmount" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "dailyBudget" DECIMAL(14,4),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceEvent" (
    "id" UUID NOT NULL,
    "placementId" UUID NOT NULL,
    "type" "MarketplaceEventType" NOT NULL,
    "organizationId" UUID,
    "userId" UUID,
    "context" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "diff" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_archivedAt_idx" ON "Organization"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_organizationId_email_key" ON "Invitation"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_family_idx" ON "RefreshToken"("family");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_userId_key" ON "TelegramLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_telegramUserId_key" ON "TelegramLink"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_code_key" ON "TelegramLink"("code");

-- CreateIndex
CREATE INDEX "TelegramLink_organizationId_idx" ON "TelegramLink"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntitlement_planId_key_key" ON "PlanEntitlement"("planId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "PaymentEvent_organizationId_idx" ON "PaymentEvent"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "AppSetting_key_idx" ON "AppSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_scope_organizationId_key_key" ON "AppSetting"("scope", "organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_code_locale_channel_key" ON "NotificationTemplate"("code", "locale", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "UnitConversion_fromUnit_toUnit_key" ON "UnitConversion"("fromUnit", "toUnit");

-- CreateIndex
CREATE UNIQUE INDEX "InputCategory_slug_key" ON "InputCategory"("slug");

-- CreateIndex
CREATE INDEX "InputCategory_parentId_idx" ON "InputCategory"("parentId");

-- CreateIndex
CREATE INDEX "InputCategory_rubro_idx" ON "InputCategory"("rubro");

-- CreateIndex
CREATE INDEX "CanonicalInput_categoryId_idx" ON "CanonicalInput"("categoryId");

-- CreateIndex
CREATE INDEX "CanonicalInput_status_idx" ON "CanonicalInput"("status");

-- CreateIndex
CREATE INDEX "CanonicalInput_mergedIntoId_idx" ON "CanonicalInput"("mergedIntoId");

-- CreateIndex
CREATE INDEX "CanonicalInput_normalizedName_idx" ON "CanonicalInput" USING GIN ("normalizedName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "CanonicalInputAlias_normalizedAlias_idx" ON "CanonicalInputAlias" USING GIN ("normalizedAlias" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalInputAlias_canonicalInputId_normalizedAlias_key" ON "CanonicalInputAlias"("canonicalInputId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "OrgInput_organizationId_idx" ON "OrgInput"("organizationId");

-- CreateIndex
CREATE INDEX "OrgInput_canonicalInputId_idx" ON "OrgInput"("canonicalInputId");

-- CreateIndex
CREATE INDEX "OrgInput_preferredSupplierId_idx" ON "OrgInput"("preferredSupplierId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgInput_organizationId_displayName_key" ON "OrgInput"("organizationId", "displayName");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_idx" ON "Supplier"("organizationId");

-- CreateIndex
CREATE INDEX "Supplier_normalizedName_idx" ON "Supplier" USING GIN ("normalizedName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "SupplierCatalogUpload_supplierId_idx" ON "SupplierCatalogUpload"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierCatalogUpload_organizationId_idx" ON "SupplierCatalogUpload"("organizationId");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_supplierId_idx" ON "SupplierCatalogItem"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_canonicalInputId_idx" ON "SupplierCatalogItem"("canonicalInputId");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_uploadId_idx" ON "SupplierCatalogItem"("uploadId");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_canonicalInputId_validFrom_idx" ON "SupplierCatalogItem"("canonicalInputId", "validFrom");

-- CreateIndex
CREATE INDEX "Product_organizationId_idx" ON "Product"("organizationId");

-- CreateIndex
CREATE INDEX "Product_organizationId_status_idx" ON "Product"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_slug_key" ON "Product"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "ProductRecipe_productId_idx" ON "ProductRecipe"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecipe_productId_version_key" ON "ProductRecipe"("productId", "version");

-- CreateIndex
CREATE INDEX "RecipeLine_recipeId_idx" ON "RecipeLine"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeLine_orgInputId_idx" ON "RecipeLine"("orgInputId");

-- CreateIndex
CREATE INDEX "CostComponent_recipeId_idx" ON "CostComponent"("recipeId");

-- CreateIndex
CREATE INDEX "CostingSnapshot_productId_computedAt_idx" ON "CostingSnapshot"("productId", "computedAt");

-- CreateIndex
CREATE INDEX "CostingSnapshot_recipeId_idx" ON "CostingSnapshot"("recipeId");

-- CreateIndex
CREATE INDEX "CostingSnapshot_organizationId_idx" ON "CostingSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "Scenario_organizationId_idx" ON "Scenario"("organizationId");

-- CreateIndex
CREATE INDEX "Scenario_productId_idx" ON "Scenario"("productId");

-- CreateIndex
CREATE INDEX "Scenario_baseRecipeId_idx" ON "Scenario"("baseRecipeId");

-- CreateIndex
CREATE INDEX "ScenarioOverride_scenarioId_idx" ON "ScenarioOverride"("scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioResult_scenarioId_computedAt_idx" ON "ScenarioResult"("scenarioId", "computedAt");

-- CreateIndex
CREATE INDEX "PriceObservation_canonicalInputId_region_scope_observedAt_idx" ON "PriceObservation"("canonicalInputId", "region", "scope", "observedAt");

-- CreateIndex
CREATE INDEX "PriceObservation_organizationId_idx" ON "PriceObservation"("organizationId");

-- CreateIndex
CREATE INDEX "PriceObservation_status_idx" ON "PriceObservation"("status");

-- CreateIndex
CREATE INDEX "PriceObservation_source_idx" ON "PriceObservation"("source");

-- CreateIndex
CREATE UNIQUE INDEX "PriceObservation_source_sourceRef_key" ON "PriceObservation"("source", "sourceRef");

-- CreateIndex
CREATE INDEX "PriceConsensus_canonicalInputId_idx" ON "PriceConsensus"("canonicalInputId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceConsensus_canonicalInputId_region_scope_currency_key" ON "PriceConsensus"("canonicalInputId", "region", "scope", "currency");

-- CreateIndex
CREATE INDEX "MarketPrice_normalizedQuery_region_capturedAt_idx" ON "MarketPrice"("normalizedQuery", "region", "capturedAt");

-- CreateIndex
CREATE INDEX "MarketPrice_productId_idx" ON "MarketPrice"("productId");

-- CreateIndex
CREATE INDEX "MarketPrice_organizationId_idx" ON "MarketPrice"("organizationId");

-- CreateIndex
CREATE INDEX "ReputationEvent_userId_idx" ON "ReputationEvent"("userId");

-- CreateIndex
CREATE INDEX "ReputationEvent_organizationId_idx" ON "ReputationEvent"("organizationId");

-- CreateIndex
CREATE INDEX "Receipt_organizationId_createdAt_idx" ON "Receipt"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Receipt_uploadedById_idx" ON "Receipt"("uploadedById");

-- CreateIndex
CREATE INDEX "Receipt_status_idx" ON "Receipt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptLineItem_priceObservationId_key" ON "ReceiptLineItem"("priceObservationId");

-- CreateIndex
CREATE INDEX "ReceiptLineItem_receiptId_idx" ON "ReceiptLineItem"("receiptId");

-- CreateIndex
CREATE INDEX "ReceiptLineItem_matchedCanonicalInputId_idx" ON "ReceiptLineItem"("matchedCanonicalInputId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingSource_name_key" ON "ScrapingSource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingSource_slug_key" ON "ScrapingSource"("slug");

-- CreateIndex
CREATE INDEX "ScrapingJob_sourceId_status_idx" ON "ScrapingJob"("sourceId", "status");

-- CreateIndex
CREATE INDEX "ScrapingJob_organizationId_idx" ON "ScrapingJob"("organizationId");

-- CreateIndex
CREATE INDEX "ScrapingJob_status_createdAt_idx" ON "ScrapingJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovDataSource_name_key" ON "GovDataSource"("name");

-- CreateIndex
CREATE INDEX "GovDataSync_sourceId_startedAt_idx" ON "GovDataSync"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "ExchangeRate_base_quote_validOn_idx" ON "ExchangeRate"("base", "quote", "validOn");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_base_quote_validOn_source_key" ON "ExchangeRate"("base", "quote", "validOn", "source");

-- CreateIndex
CREATE INDEX "Alert_organizationId_idx" ON "Alert"("organizationId");

-- CreateIndex
CREATE INDEX "Alert_productId_idx" ON "Alert"("productId");

-- CreateIndex
CREATE INDEX "Alert_canonicalInputId_idx" ON "Alert"("canonicalInputId");

-- CreateIndex
CREATE INDEX "Alert_enabled_idx" ON "Alert"("enabled");

-- CreateIndex
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledFor_idx" ON "Notification"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "MarketplacePlacement_supplierId_idx" ON "MarketplacePlacement"("supplierId");

-- CreateIndex
CREATE INDEX "MarketplacePlacement_canonicalInputId_idx" ON "MarketplacePlacement"("canonicalInputId");

-- CreateIndex
CREATE INDEX "MarketplacePlacement_categoryId_idx" ON "MarketplacePlacement"("categoryId");

-- CreateIndex
CREATE INDEX "MarketplacePlacement_active_idx" ON "MarketplacePlacement"("active");

-- CreateIndex
CREATE INDEX "MarketplaceEvent_placementId_type_createdAt_idx" ON "MarketplaceEvent"("placementId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceEvent_organizationId_idx" ON "MarketplaceEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputCategory" ADD CONSTRAINT "InputCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InputCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalInput" ADD CONSTRAINT "CanonicalInput_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InputCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalInput" ADD CONSTRAINT "CanonicalInput_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "CanonicalInput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalInputAlias" ADD CONSTRAINT "CanonicalInputAlias_canonicalInputId_fkey" FOREIGN KEY ("canonicalInputId") REFERENCES "CanonicalInput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInput" ADD CONSTRAINT "OrgInput_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInput" ADD CONSTRAINT "OrgInput_canonicalInputId_fkey" FOREIGN KEY ("canonicalInputId") REFERENCES "CanonicalInput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInput" ADD CONSTRAINT "OrgInput_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogUpload" ADD CONSTRAINT "SupplierCatalogUpload_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogUpload" ADD CONSTRAINT "SupplierCatalogUpload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_canonicalInputId_fkey" FOREIGN KEY ("canonicalInputId") REFERENCES "CanonicalInput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "SupplierCatalogUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "ProductRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_orgInputId_fkey" FOREIGN KEY ("orgInputId") REFERENCES "OrgInput"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostComponent" ADD CONSTRAINT "CostComponent_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "ProductRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostingSnapshot" ADD CONSTRAINT "CostingSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostingSnapshot" ADD CONSTRAINT "CostingSnapshot_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "ProductRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostingSnapshot" ADD CONSTRAINT "CostingSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_baseRecipeId_fkey" FOREIGN KEY ("baseRecipeId") REFERENCES "ProductRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioOverride" ADD CONSTRAINT "ScenarioOverride_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioResult" ADD CONSTRAINT "ScenarioResult_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_canonicalInputId_fkey" FOREIGN KEY ("canonicalInputId") REFERENCES "CanonicalInput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceConsensus" ADD CONSTRAINT "PriceConsensus_canonicalInputId_fkey" FOREIGN KEY ("canonicalInputId") REFERENCES "CanonicalInput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_scrapingJobId_fkey" FOREIGN KEY ("scrapingJobId") REFERENCES "ScrapingJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLineItem" ADD CONSTRAINT "ReceiptLineItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLineItem" ADD CONSTRAINT "ReceiptLineItem_matchedCanonicalInputId_fkey" FOREIGN KEY ("matchedCanonicalInputId") REFERENCES "CanonicalInput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLineItem" ADD CONSTRAINT "ReceiptLineItem_priceObservationId_fkey" FOREIGN KEY ("priceObservationId") REFERENCES "PriceObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingJob" ADD CONSTRAINT "ScrapingJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ScrapingSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingJob" ADD CONSTRAINT "ScrapingJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovDataSync" ADD CONSTRAINT "GovDataSync_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GovDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_canonicalInputId_fkey" FOREIGN KEY ("canonicalInputId") REFERENCES "CanonicalInput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePlacement" ADD CONSTRAINT "MarketplacePlacement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePlacement" ADD CONSTRAINT "MarketplacePlacement_canonicalInputId_fkey" FOREIGN KEY ("canonicalInputId") REFERENCES "CanonicalInput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePlacement" ADD CONSTRAINT "MarketplacePlacement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InputCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceEvent" ADD CONSTRAINT "MarketplaceEvent_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "MarketplacePlacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceEvent" ADD CONSTRAINT "MarketplaceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
