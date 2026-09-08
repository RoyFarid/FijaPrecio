import { describe, expect, it } from 'vitest';
import {
  CostingError,
  computeCosting,
  type EngineConfig,
  type EngineInput,
} from './engine.js';

const CONFIG: EngineConfig = {
  igvRate: 0.18,
  defaultMarginPct: 0.3,
  priceFromMarkupOnPrice: true,
};

function base(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    currency: 'PEN',
    outputQuantity: 1,
    laborMinutes: 0,
    lines: [],
    components: [],
    ...overrides,
  };
}

describe('computeCosting', () => {
  it('un insumo, sin merma ni componentes', () => {
    const r = computeCosting(
      base({
        lines: [
          { ref: 'l1', label: 'Tela', quantity: 2, unit: 'm', wastePct: 0, unitCost: 15, priceSource: 'org_input' },
        ],
      }),
      CONFIG,
    );
    expect(r.totalCost).toBe(30);
    expect(r.unitCost).toBe(30);
    expect(r.suggestedPrice).toBeCloseTo((30 / 0.7) * 1.18, 4);
    expect(r.marginPct).toBeCloseTo(0.3, 6);
    expect(r.hasMissingPrices).toBe(false);
  });

  it('aplica merma por línea', () => {
    const r = computeCosting(
      base({
        lines: [
          { ref: 'l1', label: 'Harina', quantity: 10, unit: 'kg', wastePct: 0.05, unitCost: 4.5, priceSource: 'override' },
        ],
      }),
      CONFIG,
    );
    expect(r.totalCost).toBe(round(10 * 1.05 * 4.5));
  });

  it('reparte el costo total entre outputQuantity', () => {
    const r = computeCosting(
      base({
        outputQuantity: 60,
        lines: [
          { ref: 'l1', label: 'Harina', quantity: 10, unit: 'kg', wastePct: 0, unitCost: 4.5, priceSource: 'override' },
        ],
      }),
      CONFIG,
    );
    expect(r.totalCost).toBe(45);
    expect(r.unitCost).toBe(round(45 / 60));
  });

  it('componentes FIXED, PER_UNIT y PER_HOUR', () => {
    const r = computeCosting(
      base({
        outputQuantity: 10,
        laborMinutes: 120,
        lines: [{ ref: 'l1', label: 'Insumo', quantity: 1, unit: 'u', wastePct: 0, unitCost: 100, priceSource: 'override' }],
        components: [
          { ref: 'c1', label: 'Molde', type: 'OTHER', calc: 'FIXED', value: 20 },
          { ref: 'c2', label: 'Empaque', type: 'PACKAGING', calc: 'PER_UNIT', value: 0.5 },
          { ref: 'c3', label: 'Mano de obra', type: 'LABOR', calc: 'PER_HOUR', value: 6 },
        ],
      }),
      CONFIG,
    );
    // 100 (insumo) + 20 (fixed) + 5 (0.5×10) + 12 (6×2h) = 137
    expect(r.totalCost).toBe(137);
    expect(r.unitCost).toBe(13.7);
  });

  it('PCT_OF_DIRECT_COST se aplica sobre insumos + componentes no-porcentuales', () => {
    const r = computeCosting(
      base({
        lines: [{ ref: 'l1', label: 'X', quantity: 1, unit: 'u', wastePct: 0, unitCost: 80, priceSource: 'override' }],
        components: [
          { ref: 'c1', label: 'Labor', type: 'LABOR', calc: 'FIXED', value: 20 },
          { ref: 'c2', label: 'Overhead', type: 'OVERHEAD', calc: 'PCT_OF_DIRECT_COST', value: 0.15 },
        ],
      }),
      CONFIG,
    );
    // directo = 80 + 20 = 100 ; overhead = 15 ; total = 115
    expect(r.totalCost).toBe(115);
  });

  it('PCT_OF_TOTAL_COST usa como base el subtotal (directo + %directo)', () => {
    const r = computeCosting(
      base({
        lines: [{ ref: 'l1', label: 'X', quantity: 1, unit: 'u', wastePct: 0, unitCost: 100, priceSource: 'override' }],
        components: [
          { ref: 'c1', label: 'Comisión', type: 'PLATFORM_FEE', calc: 'PCT_OF_TOTAL_COST', value: 0.1 },
        ],
      }),
      CONFIG,
    );
    // subtotal = 100 ; comisión = 10 ; total = 110
    expect(r.totalCost).toBe(110);
  });

  it('markup sobre costo en vez de sobre precio', () => {
    const r = computeCosting(
      base({ lines: [{ ref: 'l1', label: 'X', quantity: 1, unit: 'u', wastePct: 0, unitCost: 100, priceSource: 'override' }] }),
      { ...CONFIG, priceFromMarkupOnPrice: false },
    );
    // precioSinIGV = 100 × 1.3 = 130 ; margen realizado = 30/130
    expect(r.suggestedPrice).toBeCloseTo(130 * 1.18, 4);
    expect(r.marginPct).toBeCloseTo(30 / 130, 6);
  });

  it('target costing: calcula targetCost y costGap positivo', () => {
    const r = computeCosting(
      base({
        lines: [{ ref: 'l1', label: 'X', quantity: 1, unit: 'u', wastePct: 0, unitCost: 100, priceSource: 'override' }],
        targetPrice: 118, // sin IGV = 100 ; con margen 0.3 => targetCost = 70
      }),
      CONFIG,
    );
    expect(r.targetCost).toBeCloseTo(70, 4);
    expect(r.costGap).toBeCloseTo(30, 4); // unitCost 100 - targetCost 70
  });

  it('costGap negativo cuando el costo está por debajo del objetivo', () => {
    const r = computeCosting(
      base({
        lines: [{ ref: 'l1', label: 'X', quantity: 1, unit: 'u', wastePct: 0, unitCost: 50, priceSource: 'override' }],
        targetPrice: 118,
      }),
      CONFIG,
    );
    expect(r.costGap).toBeLessThan(0);
  });

  it('marca precios faltantes con warning y hasMissingPrices', () => {
    const r = computeCosting(
      base({
        lines: [
          { ref: 'l1', label: 'Tela', quantity: 2, unit: 'm', wastePct: 0, unitCost: 15, priceSource: 'override' },
          { ref: 'l2', label: 'Botones', quantity: 10, unit: 'u', wastePct: 0, unitCost: 0, priceSource: 'missing' },
        ],
      }),
      CONFIG,
    );
    expect(r.hasMissingPrices).toBe(true);
    expect(r.warnings.some((w) => w.includes('Botones'))).toBe(true);
    expect(r.totalCost).toBe(30); // la línea sin precio no suma
    expect(r.lines.find((l) => l.ref === 'l2')?.priceSource).toBe('missing');
  });

  it('margen ≥ 100% con markup sobre precio: warning y sin precio sugerido', () => {
    const r = computeCosting(
      base({
        lines: [{ ref: 'l1', label: 'X', quantity: 1, unit: 'u', wastePct: 0, unitCost: 100, priceSource: 'override' }],
        targetMarginPct: 1,
      }),
      CONFIG,
    );
    expect(r.suggestedPrice).toBeNull();
    expect(r.marginPct).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('igvRate 0 (organización sin IGV) => precio sin impuesto', () => {
    const r = computeCosting(
      base({ lines: [{ ref: 'l1', label: 'X', quantity: 1, unit: 'u', wastePct: 0, unitCost: 100, priceSource: 'override' }] }),
      { ...CONFIG, igvRate: 0 },
    );
    expect(r.suggestedPrice).toBeCloseTo(100 / 0.7, 4);
  });

  it('outputQuantity <= 0 lanza CostingError', () => {
    expect(() => computeCosting(base({ outputQuantity: 0 }), CONFIG)).toThrow(CostingError);
  });

  it('el breakdown reparte ~100% del costo total', () => {
    const r = computeCosting(
      base({
        outputQuantity: 5,
        laborMinutes: 60,
        lines: [
          { ref: 'l1', label: 'A', quantity: 3, unit: 'kg', wastePct: 0.1, unitCost: 12, priceSource: 'override' },
          { ref: 'l2', label: 'B', quantity: 1, unit: 'u', wastePct: 0, unitCost: 40, priceSource: 'org_input' },
        ],
        components: [
          { ref: 'c1', label: 'Labor', type: 'LABOR', calc: 'PER_HOUR', value: 10 },
          { ref: 'c2', label: 'Overhead', type: 'OVERHEAD', calc: 'PCT_OF_DIRECT_COST', value: 0.2 },
        ],
      }),
      CONFIG,
    );
    const sum = r.lines.reduce((s, l) => s + l.pctOfTotal, 0);
    expect(sum).toBeCloseTo(1, 4);
    const amountSum = r.lines.reduce((s, l) => s + l.amount, 0);
    expect(amountSum).toBeCloseTo(r.unitCost, 3);
  });
});

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}
