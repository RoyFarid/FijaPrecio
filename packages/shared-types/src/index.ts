/**
 * @fijaprecio/shared-types — contratos de dominio compartidos entre servicios
 * (api <-> web <-> bot). Los enums vienen del schema Prisma como fuente única.
 */
import { z } from 'zod';

export * from './config-keys.js';
export * from './queues.js';
export * from './templates.js';

// Re-export de enums del dominio (fuente: schema.prisma vía @fijaprecio/db)
export {
  MembershipRole,
  SubscriptionStatus,
  PriceScope,
  PriceSource,
  PriceObservationStatus,
  CanonicalInputStatus,
  CostComponentType,
  CostCalcMethod,
  ScenarioOverrideType,
  ReceiptChannel,
  ReceiptStatus,
  OcrProvider,
  ScrapingSourceType,
  ScrapingJobStatus,
  AlertType,
  NotificationChannel,
} from '@fijaprecio/db';

// --- Resultado del motor de costeo (contrato api -> web) ---------------------

/** Origen del precio unitario de una línea de costeo (distinto de `PriceSource`
 *  de las observaciones de mercado). */
export const costPriceSourceSchema = z.enum([
  'override',
  'org_input',
  'consensus',
  'supplier',
  'missing',
]);
export type CostPriceSource = z.infer<typeof costPriceSourceSchema>;

export const costBreakdownLineSchema = z.object({
  kind: z.enum(['input', 'component']),
  ref: z.string(),
  label: z.string(),
  amount: z.number(), // contribución al costo UNITARIO
  pctOfTotal: z.number(), // fracción 0..1
  priceSource: costPriceSourceSchema.optional(),
});

export const costingResultSchema = z.object({
  currency: z.string().length(3),
  outputQuantity: z.number().positive(),
  totalCost: z.number(),
  unitCost: z.number(),
  suggestedPrice: z.number().nullable(),
  marginPct: z.number().nullable(),
  targetPrice: z.number().nullable(),
  targetCost: z.number().nullable(),
  costGap: z.number().nullable(),
  lines: z.array(costBreakdownLineSchema),
  warnings: z.array(z.string()),
  hasMissingPrices: z.boolean(),
  configUsed: z.record(z.string(), z.unknown()),
  computedAt: z.string().datetime(),
});
export type CostingResult = z.infer<typeof costingResultSchema>;

// --- Análisis de sensibilidad / cuello de botella (api -> web) --------------

export const sensitivityDriverSchema = z.object({
  ref: z.string(),
  label: z.string(),
  kind: z.enum(['input', 'component']),
  unitCost: z.number(),
  contributionPct: z.number(),
  currentUnitPrice: z.number().nullable(),
  priceSource: costPriceSourceSchema.optional(),
  gapCloseReductionPct: z.number().nullable(),
  gapCloseUnitPrice: z.number().nullable(),
  feasibleAlone: z.boolean(),
  marketMedianPrice: z.number().nullable(),
});
export type SensitivityDriver = z.infer<typeof sensitivityDriverSchema>;

export const sensitivityResultSchema = z.object({
  currency: z.string().length(3),
  unitCost: z.number(),
  targetCost: z.number().nullable(),
  costGap: z.number().nullable(),
  overallReductionPct: z.number().nullable(),
  drivers: z.array(sensitivityDriverSchema),
  headline: z.string().nullable(),
  computedAt: z.string().datetime(),
});
export type SensitivityResult = z.infer<typeof sensitivityResultSchema>;

// --- Simulador de escenarios (contrato api <-> web) -------------------------

// Los valores coinciden con el enum `ScenarioOverrideType` re-exportado arriba
// (fuente: schema.prisma). Se declara como z.enum para validar payloads.
export const scenarioOverrideTypeSchema = z.enum([
  'RECIPE_LINE',
  'INPUT_PRICE',
  'SUPPLIER_SWAP',
  'COST_COMPONENT',
  'MARGIN',
]);

export const scenarioOverrideSchema = z.object({
  type: scenarioOverrideTypeSchema,
  targetRef: z.string().nullable().default(null),
  patch: z.record(z.string(), z.unknown()),
});
export type ScenarioOverrideDef = z.infer<typeof scenarioOverrideSchema>;

export const scenarioDeltaSchema = z.object({
  unitCost: z.number(),
  suggestedPrice: z.number().nullable(),
  marginPct: z.number().nullable(),
  costGap: z.number().nullable(),
});
export type ScenarioDelta = z.infer<typeof scenarioDeltaSchema>;

export const scenarioOutcomeSchema = z.object({
  name: z.string(),
  overrides: z.array(scenarioOverrideSchema),
  result: costingResultSchema,
  delta: scenarioDeltaSchema,
});
export type ScenarioOutcome = z.infer<typeof scenarioOutcomeSchema>;

export const scenarioComparisonSchema = z.object({
  currency: z.string().length(3),
  base: costingResultSchema,
  scenarios: z.array(scenarioOutcomeSchema),
  computedAt: z.string().datetime(),
});
export type ScenarioComparison = z.infer<typeof scenarioComparisonSchema>;

export const savedScenarioSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  name: z.string(),
  notes: z.string().nullable(),
  overrides: z.array(scenarioOverrideSchema),
  result: costingResultSchema.nullable(),
  delta: scenarioDeltaSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SavedScenario = z.infer<typeof savedScenarioSchema>;

// --- Catálogo de insumos (contrato api <-> web) ----------------------------

export const catalogMatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  baseUnit: z.string(),
  status: z.string(),
  similarity: z.number().min(0).max(1),
  matchedVia: z.enum(['name', 'alias']),
});
export type CatalogMatch = z.infer<typeof catalogMatchSchema>;

// --- Sugerencia de precio del consenso (contrato api -> web) ----------------

export const priceSuggestionSchema = z.object({
  canonicalInputId: z.string().uuid().nullable(),
  region: z.string(),
  currency: z.string().length(3),
  median: z.number().nullable(),
  p25: z.number().nullable(),
  p75: z.number().nullable(),
  sampleSize: z.number().int(),
  confidence: z.number().min(0).max(1),
  editable: z.literal(true),
});
export type PriceSuggestion = z.infer<typeof priceSuggestionSchema>;

/** Consenso calculado por el worker, tal como lo lee el frontend/costeo. */
export const priceConsensusSchema = z.object({
  canonicalInputId: z.string().uuid(),
  region: z.string(),
  scope: z.enum(['INPUT', 'FINAL_PRODUCT']),
  currency: z.string().length(3),
  median: z.number(),
  p25: z.number(),
  p75: z.number(),
  weightedMean: z.number(),
  mad: z.number(),
  sampleSize: z.number().int(),
  confidence: z.number().min(0).max(1),
  showable: z.boolean(), // confidence >= consensus.confidence_min_to_show
  updatedAt: z.string().datetime(),
});
export type PriceConsensusView = z.infer<typeof priceConsensusSchema>;

// --- Ingesta de observaciones (contrato scraper/gov -> api /internal) -------

export const priceObservationInputSchema = z.object({
  scope: z.enum(['INPUT', 'FINAL_PRODUCT']),
  canonicalInputId: z.string().uuid().optional(),
  productQuery: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().length(3).default('PEN'),
  unit: z.string(),
  region: z.string().default('PE'),
  source: z.enum(['MANUAL', 'OCR', 'SCRAPE', 'OFFICIAL', 'SUPPLIER']),
  sourceRef: z.string().optional(),
  // `{ offset: true }`: los clientes (scraper/OCR/gov en Python) mandan
  // `...+00:00`, no `...Z` — ambos son ISO 8601 válidos.
  observedAt: z.string().datetime({ offset: true }).optional(),
});
export type PriceObservationInput = z.infer<typeof priceObservationInputSchema>;

export const priceObservationBatchSchema = z.object({
  scrapingJobId: z.string().uuid().optional(),
  observations: z.array(priceObservationInputSchema).min(1).max(500),
});
export type PriceObservationBatch = z.infer<typeof priceObservationBatchSchema>;

// --- Radar de competencia (producto final) --------------------------------

/** Un ítem real encontrado (el más cercano a la mediana) para linkear "ver en X". */
export const sampleLinkSchema = z.object({
  source: z.string(),
  title: z.string(),
  price: z.number(),
  url: z.string(),
});
export type SampleLink = z.infer<typeof sampleLinkSchema>;

/** Snapshot agregado que publica el scraper (POST /v1/internal/market-prices). */
export const marketPriceSnapshotSchema = z.object({
  productId: z.string().uuid().nullable().default(null),
  productQuery: z.string().min(2).max(200),
  region: z.string().default('PE'),
  currency: z.string().length(3).default('PEN'),
  minPrice: z.number().positive(),
  p25: z.number().positive().nullable(),
  avgPrice: z.number().positive(),
  medianPrice: z.number().positive().nullable(),
  p75: z.number().positive().nullable(),
  premiumPrice: z.number().positive().nullable(), // p90
  sampleSize: z.number().int().positive(),
  sourceBreakdown: z.record(z.string(), z.number().int()),
  sampleLinks: z.array(sampleLinkSchema).default([]),
  scrapingJobId: z.string().uuid().nullable().default(null),
});
export type MarketPriceSnapshot = z.infer<typeof marketPriceSnapshotSchema>;

export const marketPriceBatchSchema = z.object({
  snapshots: z.array(marketPriceSnapshotSchema).min(1).max(200),
});
export type MarketPriceBatch = z.infer<typeof marketPriceBatchSchema>;

export const marketRadarVerdictSchema = z.enum([
  'below_market', // por debajo del mínimo del mercado
  'value', // entre min y p25
  'competitive', // entre p25 y p75
  'premium', // entre p75 y p90
  'above_market', // por encima del p90
]);
export type MarketRadarVerdict = z.infer<typeof marketRadarVerdictSchema>;

export const marketRadarViewSchema = z.object({
  productId: z.string().uuid(),
  region: z.string(),
  currency: z.string().length(3),
  market: z
    .object({
      minPrice: z.number(),
      p25: z.number().nullable(),
      avgPrice: z.number(),
      medianPrice: z.number().nullable(),
      p75: z.number().nullable(),
      premiumPrice: z.number().nullable(),
      sampleSize: z.number().int(),
      sourceBreakdown: z.record(z.string(), z.number()),
      sampleLinks: z.array(sampleLinkSchema).default([]),
      capturedAt: z.string().datetime(),
    })
    .nullable(),
  yourPrice: z.object({
    suggested: z.number().nullable(),
    target: z.number().nullable(),
  }),
  position: z
    .object({
      vsMedianPct: z.number().nullable(), // (suggested - median) / median
      headroomToMedian: z.number().nullable(), // median - suggested
      verdict: marketRadarVerdictSchema,
    })
    .nullable(),
});
export type MarketRadarView = z.infer<typeof marketRadarViewSchema>;

// --- Alertas y notificaciones --------------------------------------------

// Valores del enum `AlertType` re-exportado arriba (fuente: schema.prisma).
export const alertTypeSchema = z.enum([
  'MARGIN_DROP',
  'INPUT_PRICE_RISE',
  'COMPETITOR_PRICE_DROP',
  'CONSENSUS_SHIFT',
]);

export const notificationChannelSchema = z.enum(['IN_APP', 'EMAIL', 'TELEGRAM']);
export type NotificationChannelName = z.infer<typeof notificationChannelSchema>;

export const alertThresholdsSchema = z
  .object({
    marginFloorPct: z.number().min(0).max(1).optional(), // MARGIN_DROP
    risePct: z.number().positive().optional(), // INPUT_PRICE_RISE / CONSENSUS_SHIFT
    dropPct: z.number().positive().max(1).optional(), // COMPETITOR_PRICE_DROP
  })
  .strict();
export type AlertThresholds = z.infer<typeof alertThresholdsSchema>;

export const createAlertSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: alertTypeSchema,
    productId: z.string().uuid().optional(),
    canonicalInputId: z.string().uuid().optional(),
    thresholds: alertThresholdsSchema,
    channels: z.array(notificationChannelSchema).min(1).max(3),
  })
  .superRefine((a, ctx) => {
    const needsProduct = a.type === 'MARGIN_DROP' || a.type === 'COMPETITOR_PRICE_DROP';
    const needsInput = a.type === 'INPUT_PRICE_RISE' || a.type === 'CONSENSUS_SHIFT';
    if (needsProduct && !a.productId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.type} requiere productId`, path: ['productId'] });
    }
    if (needsInput && !a.canonicalInputId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${a.type} requiere canonicalInputId`, path: ['canonicalInputId'] });
    }
    if (a.type === 'MARGIN_DROP' && a.thresholds.marginFloorPct == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'thresholds.marginFloorPct requerido', path: ['thresholds', 'marginFloorPct'] });
    }
    if (needsInput && a.thresholds.risePct == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'thresholds.risePct requerido', path: ['thresholds', 'risePct'] });
    }
    if (a.type === 'COMPETITOR_PRICE_DROP' && a.thresholds.dropPct == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'thresholds.dropPct requerido', path: ['thresholds', 'dropPct'] });
    }
  });
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

export const updateAlertSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    thresholds: alertThresholdsSchema.optional(),
    channels: z.array(notificationChannelSchema).min(1).max(3).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'nada que actualizar');
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;

export const notificationViewSchema = z.object({
  id: z.string().uuid(),
  channel: notificationChannelSchema,
  templateCode: z.string(),
  payload: z.record(z.string(), z.unknown()),
  title: z.string(),
  body: z.string(),
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'READ', 'CANCELED']),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type NotificationView = z.infer<typeof notificationViewSchema>;
