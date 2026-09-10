import { describe, expect, it } from 'vitest';
import { computeRadarPosition, type MarketBands } from './position.js';

const BANDS: MarketBands = {
  minPrice: 20,
  p25: 28,
  avgPrice: 35,
  medianPrice: 34,
  p75: 42,
  premiumPrice: 55,
};

describe('computeRadarPosition', () => {
  it('por debajo del mínimo → below_market', () => {
    expect(computeRadarPosition(15, BANDS).verdict).toBe('below_market');
  });

  it('entre min y p25 → value', () => {
    expect(computeRadarPosition(25, BANDS).verdict).toBe('value');
  });

  it('entre p25 y p75 → competitive', () => {
    expect(computeRadarPosition(34, BANDS).verdict).toBe('competitive');
  });

  it('entre p75 y p90 → premium', () => {
    expect(computeRadarPosition(48, BANDS).verdict).toBe('premium');
  });

  it('por encima del p90 → above_market', () => {
    expect(computeRadarPosition(60, BANDS).verdict).toBe('above_market');
  });

  it('calcula el margen contra la mediana', () => {
    const r = computeRadarPosition(30, BANDS);
    expect(r.vsMedianPct).toBeCloseTo((30 - 34) / 34, 4);
    expect(r.headroomToMedian).toBe(4); // 34 - 30
  });

  it('sin cuartiles usa la mediana/avg y cae en competitive', () => {
    const bare: MarketBands = {
      minPrice: 20,
      p25: null,
      avgPrice: 30,
      medianPrice: null,
      p75: null,
      premiumPrice: null,
    };
    const r = computeRadarPosition(25, bare);
    expect(r.verdict).toBe('competitive');
    expect(r.headroomToMedian).toBe(5); // 30 - 25
  });
});
