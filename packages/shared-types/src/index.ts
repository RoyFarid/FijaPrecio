/**
 * @fijaprecio/shared-types — contratos de dominio compartidos entre servicios
 * (api <-> web <-> bot). Los enums vienen del schema Prisma como fuente única.
 */
import { z } from 'zod';

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
  observedAt: z.string().datetime().optional(),
});
export type PriceObservationInput = z.infer<typeof priceObservationInputSchema>;

export const priceObservationBatchSchema = z.object({
  scrapingJobId: z.string().uuid().optional(),
  observations: z.array(priceObservationInputSchema).min(1).max(500),
});
export type PriceObservationBatch = z.infer<typeof priceObservationBatchSchema>;
