import { describe, expect, it } from 'vitest';
import { computeCosting, type EngineConfig, type EngineInput } from './engine.js';
import { ScenarioOverrideError, applyScenarioOverrides } from './scenario-engine.js';

const CONFIG: EngineConfig = { igvRate: 0.18, defaultMarginPct: 0.3, priceFromMarkupOnPrice: true };

function base(): EngineInput {
  return {
    currency: 'PEN',
    outputQuantity: 1,
    laborMinutes: 60,
    lines: [
      { ref: 'tela', label: 'Tela', quantity: 1, unit: 'm', wastePct: 0, unitCost: 20, priceSource: 'org_input' },
      { ref: 'hilo', label: 'Hilo', quantity: 1, unit: 'cono', wastePct: 0, unitCost: 2, priceSource: 'org_input' },
    ],
    components: [{ ref: 'labor', label: 'Mano de obra', type: 'LABOR', calc: 'PER_HOUR', value: 8 }],
    targetPrice: 60,
    targetMarginPct: 0.3,
  };
}

describe('applyScenarioOverrides', () => {
  it('RECIPE_LINE: cambia cantidad', () => {
    const out = applyScenarioOverrides(base(), [
      { type: 'RECIPE_LINE', targetRef: 'tela', patch: { quantity: 2 } },
    ]);
    expect(out.lines.find((l) => l.ref === 'tela')?.quantity).toBe(2);
    expect(computeCosting(out, CONFIG).totalCost).toBe(20 * 2 + 2 + 8);
  });

  it('INPUT_PRICE: reemplaza el precio unitario y marca override', () => {
    const out = applyScenarioOverrides(base(), [
      { type: 'INPUT_PRICE', targetRef: 'tela', patch: { unitPrice: 12 } },
    ]);
    const tela = out.lines.find((l) => l.ref === 'tela')!;
    expect(tela.unitCost).toBe(12);
    expect(tela.priceSource).toBe('override');
  });

  it('SUPPLIER_SWAP: marca priceSource=supplier', () => {
    const out = applyScenarioOverrides(base(), [
      { type: 'SUPPLIER_SWAP', targetRef: 'tela', patch: { unitPrice: 14, supplierId: 'x' } },
    ]);
    expect(out.lines.find((l) => l.ref === 'tela')?.priceSource).toBe('supplier');
  });

  it('COST_COMPONENT: cambia el value', () => {
    const out = applyScenarioOverrides(base(), [
      { type: 'COST_COMPONENT', targetRef: 'labor', patch: { value: 12 } },
    ]);
    expect(out.components.find((c) => c.ref === 'labor')?.value).toBe(12);
  });

  it('MARGIN: cambia targetMarginPct y afecta el precio', () => {
    const out = applyScenarioOverrides(base(), [
      { type: 'MARGIN', targetRef: null, patch: { marginPct: 0.5 } },
    ]);
    expect(out.targetMarginPct).toBe(0.5);
    const r = computeCosting(out, CONFIG);
    expect(r.marginPct).toBeCloseTo(0.5, 6);
  });

  it('compone varios overrides', () => {
    const out = applyScenarioOverrides(base(), [
      { type: 'INPUT_PRICE', targetRef: 'tela', patch: { unitPrice: 15 } },
      { type: 'RECIPE_LINE', targetRef: 'hilo', patch: { quantity: 3 } },
      { type: 'COST_COMPONENT', targetRef: 'labor', patch: { value: 10 } },
    ]);
    expect(computeCosting(out, CONFIG).totalCost).toBe(15 + 2 * 3 + 10);
  });

  it('no muta el EngineInput base', () => {
    const input = base();
    applyScenarioOverrides(input, [
      { type: 'INPUT_PRICE', targetRef: 'tela', patch: { unitPrice: 1 } },
    ]);
    expect(input.lines.find((l) => l.ref === 'tela')?.unitCost).toBe(20);
    expect(input.targetMarginPct).toBe(0.3);
  });

  it('lanza si la línea no existe', () => {
    expect(() =>
      applyScenarioOverrides(base(), [{ type: 'RECIPE_LINE', targetRef: 'nope', patch: { quantity: 1 } }]),
    ).toThrow(ScenarioOverrideError);
  });

  it('lanza si MARGIN no trae marginPct', () => {
    expect(() =>
      applyScenarioOverrides(base(), [{ type: 'MARGIN', targetRef: null, patch: {} }]),
    ).toThrow(ScenarioOverrideError);
  });
});
