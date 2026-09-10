import { describe, expect, it } from 'vitest';
import { computeCosting, type EngineConfig, type EngineInput } from './engine.js';
import { analyzeSensitivity } from './sensitivity.js';

const CONFIG: EngineConfig = { igvRate: 0.18, defaultMarginPct: 0.3, priceFromMarkupOnPrice: true };

// targetPrice tal que targetCost ≈ 20 con margen 0.3 e IGV 0.18
const TARGET_PRICE = (20 * 1.18) / 0.7;

function scenario(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    currency: 'PEN',
    outputQuantity: 1,
    laborMinutes: 0,
    lines: [
      { ref: 'tela', label: 'Tela', quantity: 1, unit: 'm', wastePct: 0, unitCost: 20, priceSource: 'override' },
      { ref: 'hilo', label: 'Hilo', quantity: 1, unit: 'cono', wastePct: 0, unitCost: 2, priceSource: 'org_input' },
    ],
    components: [{ ref: 'labor', label: 'Mano de obra', type: 'LABOR', calc: 'FIXED', value: 3 }],
    targetPrice: TARGET_PRICE,
    ...overrides,
  };
}

describe('analyzeSensitivity', () => {
  it('ordena los drivers por contribución descendente', () => {
    const r = analyzeSensitivity(scenario(), CONFIG);
    expect(r.drivers.map((d) => d.ref)).toEqual(['tela', 'labor', 'hilo']);
    expect(r.drivers[0]!.contributionPct).toBeGreaterThan(r.drivers[1]!.contributionPct);
  });

  it('calcula la brecha y el recorte parejo', () => {
    const r = analyzeSensitivity(scenario(), CONFIG);
    expect(r.unitCost).toBe(25);
    expect(r.targetCost).toBeCloseTo(20, 4);
    expect(r.costGap).toBeCloseTo(5, 4);
    expect(r.overallReductionPct).toBeCloseTo(5 / 25, 6);
  });

  it('el precio propuesto para el driver #1 lleva el costo exactamente al objetivo', () => {
    const r = analyzeSensitivity(scenario(), CONFIG);
    const tela = r.drivers.find((d) => d.ref === 'tela')!;
    expect(tela.gapCloseUnitPrice).toBeCloseTo(15, 4);
    expect(tela.gapCloseReductionPct).toBeCloseTo(0.25, 4);
    expect(tela.feasibleAlone).toBe(true);

    // round-trip por el motor
    const patched = scenario();
    patched.lines = patched.lines.map((l) =>
      l.ref === 'tela' ? { ...l, unitCost: tela.gapCloseUnitPrice! } : l,
    );
    expect(computeCosting(patched, CONFIG).unitCost).toBeCloseTo(r.targetCost!, 3);
  });

  it('marca como inviable un driver que no puede cerrar la brecha solo', () => {
    const r = analyzeSensitivity(scenario(), CONFIG);
    const hilo = r.drivers.find((d) => d.ref === 'hilo')!;
    expect(hilo.feasibleAlone).toBe(false);
    expect(hilo.gapCloseUnitPrice).toBeNull(); // requeriría precio negativo
  });

  it('los componentes no llevan precio unitario', () => {
    const r = analyzeSensitivity(scenario(), CONFIG);
    const labor = r.drivers.find((d) => d.ref === 'labor')!;
    expect(labor.kind).toBe('component');
    expect(labor.currentUnitPrice).toBeNull();
    expect(labor.gapCloseUnitPrice).toBeNull();
  });

  it('headline propone bajar el driver #1', () => {
    const r = analyzeSensitivity(scenario(), CONFIG);
    expect(r.headline).toContain('Tela');
    expect(r.headline).toContain('15');
  });

  it('sin precio objetivo: drivers sin números de cierre, headline informativo', () => {
    const r = analyzeSensitivity(scenario({ targetPrice: null }), CONFIG);
    expect(r.costGap).toBeNull();
    expect(r.overallReductionPct).toBeNull();
    expect(r.drivers.every((d) => d.gapCloseUnitPrice === null)).toBe(true);
    expect(r.headline).toContain('Tela');
    expect(r.headline).toContain('%');
  });

  it('costo por debajo del objetivo: no hay brecha que cerrar', () => {
    const r = analyzeSensitivity(
      scenario({
        lines: [
          { ref: 'tela', label: 'Tela', quantity: 1, unit: 'm', wastePct: 0, unitCost: 5, priceSource: 'override' },
        ],
        components: [],
      }),
      CONFIG,
    );
    expect(r.costGap).toBeLessThan(0);
    expect(r.overallReductionPct).toBeNull();
    expect(r.drivers[0]!.gapCloseUnitPrice).toBeNull();
  });

  it('propaga marketMedianPrice a los drivers de insumo y al headline', () => {
    const r = analyzeSensitivity(scenario(), CONFIG, { tela: 13, hilo: null });
    expect(r.drivers.find((d) => d.ref === 'tela')!.marketMedianPrice).toBe(13);
    expect(r.drivers.find((d) => d.ref === 'hilo')!.marketMedianPrice).toBeNull();
    expect(r.drivers.find((d) => d.ref === 'labor')!.marketMedianPrice).toBeNull(); // componente
    expect(r.headline).toContain('mercado');
  });

  it('con merma y varias unidades, el round-trip sigue exacto', () => {
    const input = scenario({
      outputQuantity: 12,
      laborMinutes: 60,
      lines: [
        { ref: 'a', label: 'A', quantity: 4, unit: 'kg', wastePct: 0.1, unitCost: 8, priceSource: 'override' },
        { ref: 'b', label: 'B', quantity: 2, unit: 'u', wastePct: 0, unitCost: 3, priceSource: 'override' },
      ],
      components: [
        { ref: 'lab', label: 'Labor', type: 'LABOR', calc: 'PER_HOUR', value: 9 },
        { ref: 'oh', label: 'Overhead', type: 'OVERHEAD', calc: 'PCT_OF_DIRECT_COST', value: 0.2 },
      ],
      targetPrice: 3,
    });
    const r = analyzeSensitivity(input, CONFIG);
    const feasible = r.drivers.find((d) => d.feasibleAlone && d.gapCloseUnitPrice != null);
    if (feasible) {
      const patched = {
        ...input,
        lines: input.lines.map((l) =>
          l.ref === feasible.ref ? { ...l, unitCost: feasible.gapCloseUnitPrice! } : l,
        ),
        components: input.components.map((c) =>
          c.ref === feasible.ref ? { ...c, value: feasible.gapCloseUnitPrice! } : c,
        ),
      };
      expect(computeCosting(patched, CONFIG).unitCost).toBeCloseTo(r.targetCost!, 2);
    }
    expect(r.drivers.length).toBe(4);
  });
});
