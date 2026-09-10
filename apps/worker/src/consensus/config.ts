import {
  CONFIG_SCHEMAS,
  type ConfigKey,
  type ConfigValue,
} from '@fijaprecio/shared-types';
import type { PrismaClient } from '@fijaprecio/db';
import type { ConsensusConfig } from './engine.js';

const KEYS = [
  'consensus.window_days',
  'consensus.min_sample_size',
  'consensus.outlier_method',
  'consensus.mad_threshold',
  'consensus.iqr_multiplier',
  'consensus.recency_halflife_days',
  'consensus.source_weights',
  'consensus.confidence_min_to_show',
  'consensus.reputation_full_weight_at',
  'consensus.confidence_weights',
  'reputation.max_weight_multiplier',
] as const satisfies readonly ConfigKey[];

/**
 * El consenso es una computación GLOBAL (por insumo × región), no por org: sus
 * parámetros solo viven en `AppSetting` scope=GLOBAL. Falla ruidoso si falta uno.
 */
export async function loadConsensusConfig(prisma: PrismaClient): Promise<ConsensusConfig> {
  const rows = await prisma.appSetting.findMany({
    where: { scope: 'GLOBAL', key: { in: [...KEYS] } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const get = <K extends (typeof KEYS)[number]>(key: K): ConfigValue<K> => {
    if (!map.has(key)) {
      throw new Error(`Falta AppSetting global "${key}". Corre \`pnpm db:seed\`.`);
    }
    const parsed = CONFIG_SCHEMAS[key].safeParse(map.get(key));
    if (!parsed.success) {
      throw new Error(`AppSetting "${key}" inválido: ${parsed.error.issues[0]?.message ?? ''}`);
    }
    return parsed.data as ConfigValue<K>;
  };

  return {
    windowDays: get('consensus.window_days'),
    minSampleSize: get('consensus.min_sample_size'),
    outlierMethod: get('consensus.outlier_method'),
    madThreshold: get('consensus.mad_threshold'),
    iqrMultiplier: get('consensus.iqr_multiplier'),
    recencyHalflifeDays: get('consensus.recency_halflife_days'),
    sourceWeights: get('consensus.source_weights'),
    confidenceMinToShow: get('consensus.confidence_min_to_show'),
    reputationFullWeightAt: get('consensus.reputation_full_weight_at'),
    maxReputationWeightMultiplier: get('reputation.max_weight_multiplier'),
    confidenceWeights: get('consensus.confidence_weights'),
  };
}
