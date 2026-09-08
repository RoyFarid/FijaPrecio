import { z } from 'zod';

/**
 * Registro tipado de TODAS las claves de configuración de negocio.
 *
 * Regla del proyecto ("cero hardcodeo"): el *contrato* de cada clave (tipo,
 * rango) vive aquí; el *valor* vive en la base (`AppSetting` global/de-org o
 * `PlanEntitlement`) y se siembra en `packages/db/prisma/seed.ts`.
 *
 * `AppConfigService.get(orgId, key)` valida contra estos esquemas y su tipo de
 * retorno se infiere de aquí. Añadir una clave => añadirla al seed también.
 */

const fraction = z.number().min(0).max(1);
const cadence = z.enum(['weekly', 'daily']);

export const CONFIG_SCHEMAS = {
  // --- impuestos / costeo (AppSetting GLOBAL, override por organización) -------
  'tax.igv_rate': fraction,
  'costing.default_margin_pct': z.number().min(0).max(0.99),
  'costing.overhead_method': z.enum(['PCT_OF_DIRECT_COST', 'FIXED_PER_UNIT', 'PCT_OF_TOTAL']),
  'costing.price_from_markup_on_price': z.boolean(),

  // --- consenso estadístico --------------------------------------------------
  'consensus.window_days': z.number().int().positive(),
  'consensus.min_sample_size': z.number().int().positive(),
  'consensus.outlier_method': z.enum(['MAD', 'IQR']),
  'consensus.mad_threshold': z.number().positive(),
  'consensus.iqr_multiplier': z.number().positive(),
  'consensus.recency_halflife_days': z.number().positive(),
  'consensus.source_weights': z.record(z.string(), z.number().min(0)),
  'consensus.confidence_min_to_show': fraction,
  'consensus.notify_change_pct': fraction,

  // --- reputación de aportantes --------------------------------------------
  'reputation.points': z.record(z.string(), z.number()),
  'reputation.max_weight_multiplier': z.number().positive(),

  // --- catálogo / matching -------------------------------------------------
  'catalog.match_min_similarity': fraction,
  'catalog.autocreate_canonical_status': z.string(),

  // --- scraping ----------------------------------------------------------
  'scraper.default_cadence': cadence,
  'scraper.top_n_nightly': z.number().int().positive(),
  'scraper.result_ttl_hours': z.number().positive(),
  'scraper.outlier_trim_pct': fraction,

  // --- boletas / OCR ----------------------------------------------------
  'receipts.retention_days': z.number().int().positive(),
  'ocr.provider_by_plan': z.record(z.string(), z.string()),
  'ocr.min_line_confidence': fraction,

  // --- vocabularios ----------------------------------------------------
  'units.allowed': z.array(z.string()).min(1),
  'regions.supported': z.array(z.string()).min(1),

  // --- alertas -------------------------------------------------------
  'alerts.check_cron': z.string(),
  'alerts.digest_cron_free': z.string(),

  // --- entitlements de plan (PlanEntitlement; -1 = ilimitado) -----------
  'ocr_receipts_per_month': z.number().int(),
  'scraper_cadence': cadence,
  'on_demand_scrape': z.boolean(),
  'scenario_simulator': z.boolean(),
  'scenario_max_overrides': z.number().int(),
  'radar_history_days': z.number().int().positive(),
  'alerts_max': z.number().int(),
  'pdf_export': z.boolean(),
  'public_catalog': z.boolean(),
  'api_access': z.boolean(),
  'data_export': z.boolean(),
  'seats': z.number().int().positive(),
} satisfies Record<string, z.ZodTypeAny>;

export type ConfigKey = keyof typeof CONFIG_SCHEMAS;
export type ConfigValue<K extends ConfigKey> = z.infer<(typeof CONFIG_SCHEMAS)[K]>;

/** Claves cuyo esquema es exactamente `z.boolean()` (para EntitlementsGuard). */
export type BooleanConfigKey = {
  [K in ConfigKey]: ConfigValue<K> extends boolean
    ? boolean extends ConfigValue<K>
      ? K
      : never
    : never;
}[ConfigKey];

export function isConfigKey(value: string): value is ConfigKey {
  return Object.prototype.hasOwnProperty.call(CONFIG_SCHEMAS, value);
}
