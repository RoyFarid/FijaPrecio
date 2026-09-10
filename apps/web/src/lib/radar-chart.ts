import type { MarketHistoryPoint } from './types';

export interface RadarChartRow {
  t: number;
  median: number | null;
  avg: number;
  /** [min, premium] para la banda del área. */
  range: [number, number];
}

/** Serie de `MarketPrice` → filas para Recharts. */
export function toChartData(points: MarketHistoryPoint[]): RadarChartRow[] {
  return points.map((p) => {
    const hi = p.premiumPrice ?? p.p75 ?? p.avgPrice;
    return {
      t: new Date(p.capturedAt).getTime(),
      median: p.medianPrice,
      avg: p.avgPrice,
      range: [p.minPrice, Math.max(hi, p.minPrice)],
    };
  });
}

export interface ChartBounds {
  min: number;
  max: number;
}

/** Dominio Y con un 8% de padding; null si no hay datos. */
export function chartBounds(rows: RadarChartRow[]): ChartBounds | null {
  if (rows.length === 0) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rows) {
    lo = Math.min(lo, r.range[0]);
    hi = Math.max(hi, r.range[1]);
  }
  const pad = (hi - lo || hi || 1) * 0.08;
  return { min: Math.max(0, lo - pad), max: hi + pad };
}
