import { describe, expect, it } from 'vitest';
import {
  computeConsensus,
  type ConsensusConfig,
  type ConsensusObservation,
  type ObsSource,
} from './engine.js';

const CONFIG: ConsensusConfig = {
  windowDays: 90,
  minSampleSize: 5,
  outlierMethod: 'MAD',
  madThreshold: 3.5,
  iqrMultiplier: 1.5,
  recencyHalflifeDays: 45,
  sourceWeights: { OFFICIAL: 1.0, OCR: 0.9, SUPPLIER: 0.8, SCRAPE: 0.7, MANUAL: 0.5 },
  confidenceMinToShow: 0.4,
  reputationFullWeightAt: 500,
  maxReputationWeightMultiplier: 2.0,
  confidenceWeights: { size: 0.4, dispersion: 0.35, diversity: 0.25 },
};

const NOW = new Date('2026-09-08T00:00:00Z');
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * 86_400_000);

function obs(
  id: string,
  price: number,
  opts: { source?: ObsSource; observedAt?: Date; rep?: number | null } = {},
): ConsensusObservation {
  return {
    id,
    price,
    source: opts.source ?? 'MANUAL',
    observedAt: opts.observedAt ?? NOW,
    reporterReputation: opts.rep ?? 0,
  };
}

const cluster = (base: number, spread: number, n: number, prefix = 'c'): ConsensusObservation[] =>
  Array.from({ length: n }, (_, i) =>
    obs(`${prefix}${i}`, base + spread * (i / (n - 1) - 0.5)),
  );

describe('computeConsensus', () => {
  it('muestra insuficiente => INSUFFICIENT, sin stats', () => {
    const r = computeConsensus([obs('a', 10), obs('b', 11), obs('c', 12)], CONFIG, NOW);
    expect(r.status).toBe('INSUFFICIENT');
    expect(r.stats).toBeNull();
    expect(r.showable).toBe(false);
  });

  it('cluster limpio => median/p25/p75 coherentes, todo aceptado', () => {
    const r = computeConsensus(cluster(10, 1, 12), CONFIG, NOW);
    expect(r.status).toBe('OK');
    expect(r.rejectedIds).toHaveLength(0);
    expect(r.stats!.median).toBeCloseTo(10, 1);
    expect(r.stats!.p25).toBeLessThan(r.stats!.median);
    expect(r.stats!.p75).toBeGreaterThan(r.stats!.median);
    expect(r.stats!.confidence).toBeGreaterThan(0);
  });

  it('MAD descarta un outlier evidente y no contamina la media', () => {
    const data = [...cluster(10, 1, 12), obs('bad', 250)];
    const r = computeConsensus(data, CONFIG, NOW);
    expect(r.rejectedIds).toContain('bad');
    expect(r.stats!.weightedMean).toBeLessThan(15);
    expect(r.sampleSize).toBe(12);
  });

  it('muestra chica (< 2×min) usa IQR en vez de MAD', () => {
    // 6 obs: dentro de [min, 2×min) => rama IQR. Un valor lejano se descarta.
    const data = [obs('a', 10), obs('b', 10.2), obs('c', 9.8), obs('d', 10.1), obs('e', 9.9), obs('f', 40)];
    const r = computeConsensus(data, CONFIG, NOW);
    expect(r.rejectedIds).toContain('f');
    expect(r.sampleSize).toBe(5);
  });

  it('si el recorte deja < min_sample_size, revierte y acepta todo', () => {
    // 5 obs muy dispersas: casi todas parecen outliers entre sí
    const data = [obs('a', 1), obs('b', 5), obs('c', 20), obs('d', 80), obs('e', 300)];
    const r = computeConsensus(data, CONFIG, NOW);
    expect(r.status).toBe('OK');
    expect(r.rejectedIds).toHaveLength(0);
    expect(r.sampleSize).toBe(5);
  });

  it('pondera por fuente: OFFICIAL pesa más que MANUAL', () => {
    const data = [
      ...Array.from({ length: 5 }, (_, i) => obs(`m${i}`, 10, { source: 'MANUAL' })),
      ...Array.from({ length: 5 }, (_, i) => obs(`o${i}`, 20, { source: 'OFFICIAL' })),
    ];
    const r = computeConsensus(data, CONFIG, NOW);
    expect(r.stats!.median).toBeCloseTo(15, 4);
    expect(r.stats!.weightedMean).toBeGreaterThan(16); // sesgada hacia OFFICIAL
    expect(r.stats!.weightedMean).toBeLessThan(17);
  });

  it('decaimiento por recencia: lo viejo pesa menos', () => {
    const data = [
      ...Array.from({ length: 5 }, (_, i) => obs(`new${i}`, 10, { observedAt: NOW })),
      ...Array.from({ length: 5 }, (_, i) => obs(`old${i}`, 30, { observedAt: daysAgo(80) })),
    ];
    const r = computeConsensus(data, CONFIG, NOW);
    expect(r.stats!.median).toBeCloseTo(20, 4);
    expect(r.stats!.weightedMean).toBeLessThan(18); // lo reciente (10) domina
  });

  it('filtra observaciones fuera de la ventana temporal', () => {
    const data = [
      ...cluster(10, 1, 6, 'in'),
      ...Array.from({ length: 6 }, (_, i) => obs(`out${i}`, 999, { observedAt: daysAgo(200) })),
    ];
    const r = computeConsensus(data, CONFIG, NOW);
    expect(r.sampleSize).toBe(6);
    expect(r.stats!.median).toBeCloseTo(10, 1);
  });

  it('reputación alta del aportante empuja la media ponderada', () => {
    const data = [
      ...Array.from({ length: 5 }, (_, i) => obs(`lo${i}`, 10, { rep: 0 })),
      ...Array.from({ length: 5 }, (_, i) => obs(`hi${i}`, 20, { rep: 500 })),
    ];
    const r = computeConsensus(data, CONFIG, NOW);
    expect(r.stats!.weightedMean).toBeGreaterThan(16);
  });

  it('showable depende de confidence_min_to_show', () => {
    const tight = computeConsensus(cluster(10, 0.2, 20), CONFIG, NOW);
    const strict = computeConsensus(cluster(10, 0.2, 20), { ...CONFIG, confidenceMinToShow: 0.99 }, NOW);
    expect(tight.showable).toBe(true);
    expect(strict.showable).toBe(false);
  });
});
