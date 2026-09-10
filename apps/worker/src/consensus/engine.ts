/**
 * Motor de consenso estadístico (ARQUITECTURA §9.5). Función PURA: sin DB, sin
 * config global — todo entra por `config` (lo carga el processor desde AppSetting).
 *
 * 1. Filtra a la ventana temporal.
 * 2. Detecta outliers: MAD (modified z-score) o IQR (fallback con muestra chica).
 * 3. Si tras el filtro quedan < min_sample_size, revierte el filtro (no confía en
 *    el recorte con tan pocos datos).
 * 4. Sobre las aceptadas: median, p25, p75, media PONDERADA (source × recencia ×
 *    reputación) y MAD.
 * 5. confidence = f(tamaño, dispersión relativa, diversidad de fuentes).
 */

export type ObsSource = 'MANUAL' | 'OCR' | 'SCRAPE' | 'OFFICIAL' | 'SUPPLIER';

export interface ConsensusObservation {
  id: string;
  price: number; // ya normalizado a la unidad canónica
  source: ObsSource;
  observedAt: Date;
  reporterReputation: number | null;
}

export interface ConsensusConfig {
  windowDays: number;
  minSampleSize: number;
  outlierMethod: 'MAD' | 'IQR';
  madThreshold: number;
  iqrMultiplier: number;
  recencyHalflifeDays: number;
  sourceWeights: Record<string, number>;
  confidenceMinToShow: number;
  reputationFullWeightAt: number;
  maxReputationWeightMultiplier: number;
  confidenceWeights: { size: number; dispersion: number; diversity: number };
}

export interface ConsensusStats {
  median: number;
  p25: number;
  p75: number;
  weightedMean: number;
  mad: number;
  confidence: number;
}

export interface ConsensusOutput {
  status: 'OK' | 'INSUFFICIENT';
  sampleSize: number; // observaciones aceptadas
  distinctSources: number;
  stats: ConsensusStats | null;
  acceptedIds: string[];
  rejectedIds: string[];
  showable: boolean;
}

const DEFAULT_SOURCE_WEIGHT = 0.5;
const MAD_SCALE = 0.6745; // 1 / Φ⁻¹(0.75): hace el MAD comparable a la desv. estándar

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);
const round = (n: number, dp = 4): number => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

/** Cuantil con interpolación lineal (tipo 7, como numpy). `sorted` ascendente. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (pos - lo) * (sorted[hi]! - sorted[lo]!);
}

const ageDays = (date: Date, now: Date): number =>
  (now.getTime() - date.getTime()) / 86_400_000;

const recencyDecay = (age: number, halflife: number): number =>
  halflife > 0 ? 0.5 ** (Math.max(age, 0) / halflife) : 1;

const reputationWeight = (
  rep: number | null,
  fullAt: number,
  maxMult: number,
): number => 1 + (maxMult - 1) * clamp((rep ?? 0) / fullAt, 0, 1);

function detectOutliers(
  obs: ConsensusObservation[],
  config: ConsensusConfig,
): { accepted: ConsensusObservation[]; rejected: ConsensusObservation[] } {
  const prices = obs.map((o) => o.price);
  const med = median(prices);
  const useMad =
    config.outlierMethod === 'MAD' && obs.length >= config.minSampleSize * 2;

  let isOutlier: (p: number) => boolean;

  if (useMad) {
    const mad = median(prices.map((p) => Math.abs(p - med)));
    isOutlier =
      mad === 0
        ? () => false
        : (p) => Math.abs((MAD_SCALE * (p - med)) / mad) > config.madThreshold;
  } else {
    const sorted = [...prices].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    isOutlier =
      iqr === 0
        ? () => false
        : (p) => p < q1 - config.iqrMultiplier * iqr || p > q3 + config.iqrMultiplier * iqr;
  }

  const accepted: ConsensusObservation[] = [];
  const rejected: ConsensusObservation[] = [];
  for (const o of obs) (isOutlier(o.price) ? rejected : accepted).push(o);
  return { accepted, rejected };
}

export function computeConsensus(
  observations: ConsensusObservation[],
  config: ConsensusConfig,
  now: Date = new Date(),
): ConsensusOutput {
  const inWindow = observations.filter(
    (o) =>
      Number.isFinite(o.price) &&
      o.price > 0 &&
      ageDays(o.observedAt, now) <= config.windowDays,
  );

  if (inWindow.length < config.minSampleSize) {
    return {
      status: 'INSUFFICIENT',
      sampleSize: inWindow.length,
      distinctSources: new Set(inWindow.map((o) => o.source)).size,
      stats: null,
      acceptedIds: inWindow.map((o) => o.id),
      rejectedIds: [],
      showable: false,
    };
  }

  let { accepted, rejected } = detectOutliers(inWindow, config);
  if (accepted.length < config.minSampleSize) {
    // recortó demasiado: no confiar, quedarse con toda la ventana
    accepted = inWindow;
    rejected = [];
  }

  const prices = accepted.map((o) => o.price).sort((a, b) => a - b);
  const med = median(prices);
  const p25 = quantile(prices, 0.25);
  const p75 = quantile(prices, 0.75);
  const mad = median(prices.map((p) => Math.abs(p - med)));

  let wSum = 0;
  let wpSum = 0;
  for (const o of accepted) {
    const w =
      (config.sourceWeights[o.source] ?? DEFAULT_SOURCE_WEIGHT) *
      recencyDecay(ageDays(o.observedAt, now), config.recencyHalflifeDays) *
      reputationWeight(
        o.reporterReputation,
        config.reputationFullWeightAt,
        config.maxReputationWeightMultiplier,
      );
    wSum += w;
    wpSum += w * o.price;
  }
  const weightedMean =
    wSum > 0 ? wpSum / wSum : prices.reduce((s, p) => s + p, 0) / prices.length;

  const distinctSources = new Set(accepted.map((o) => o.source)).size;

  const sizeScore = clamp(accepted.length / (config.minSampleSize * 3), 0, 1);
  const dispersionScore = med > 0 ? clamp(1 - mad / med, 0, 1) : 0;
  const diversityScore = clamp(distinctSources / 3, 0, 1);
  const cw = config.confidenceWeights;
  const cwSum = cw.size + cw.dispersion + cw.diversity;
  const confidence =
    cwSum > 0
      ? round(
          (cw.size * sizeScore + cw.dispersion * dispersionScore + cw.diversity * diversityScore) /
            cwSum,
        )
      : 0;

  return {
    status: 'OK',
    sampleSize: accepted.length,
    distinctSources,
    stats: {
      median: round(med),
      p25: round(p25),
      p75: round(p75),
      weightedMean: round(weightedMean),
      mad: round(mad, 6),
      confidence,
    },
    acceptedIds: accepted.map((o) => o.id),
    rejectedIds: rejected.map((o) => o.id),
    showable: confidence >= config.confidenceMinToShow,
  };
}
