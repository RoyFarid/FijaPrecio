import { describe, expect, it } from 'vitest';
import { chartBounds, toChartData } from './radar-chart';
import type { MarketHistoryPoint } from './types';

const pt = (over: Partial<MarketHistoryPoint>): MarketHistoryPoint => ({
  capturedAt: '2026-09-01T00:00:00.000Z',
  minPrice: 10,
  p25: null,
  avgPrice: 15,
  medianPrice: 14,
  p75: null,
  premiumPrice: 20,
  sampleSize: 5,
  ...over,
});

describe('toChartData', () => {
  it('mapea a filas con timestamp y rango [min, hi]', () => {
    const rows = toChartData([pt({})]);
    expect(rows[0]!.t).toBe(Date.parse('2026-09-01T00:00:00.000Z'));
    expect(rows[0]!.range).toEqual([10, 20]);
    expect(rows[0]!.median).toBe(14);
  });

  it('cae a p75 → avg cuando falta premium; nunca hi < min', () => {
    expect(toChartData([pt({ premiumPrice: null, p75: 18 })])[0]!.range).toEqual([10, 18]);
    expect(toChartData([pt({ premiumPrice: null, p75: null })])[0]!.range).toEqual([10, 15]);
    expect(toChartData([pt({ minPrice: 30, premiumPrice: 20 })])[0]!.range).toEqual([30, 30]);
  });
});

describe('chartBounds', () => {
  it('null si no hay filas', () => {
    expect(chartBounds([])).toBeNull();
  });

  it('padding del 8% y nunca negativo', () => {
    const b = chartBounds(toChartData([pt({ minPrice: 10, premiumPrice: 20 })]));
    expect(b!.min).toBeGreaterThanOrEqual(0);
    expect(b!.min).toBeLessThan(10);
    expect(b!.max).toBeGreaterThan(20);
  });
});
