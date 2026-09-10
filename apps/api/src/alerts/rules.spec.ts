import { describe, expect, it } from 'vitest';
import {
  evaluateCompetitorDrop,
  evaluateInputPriceRise,
  evaluateMarginDrop,
} from './rules.js';

describe('evaluateMarginDrop', () => {
  it('dispara si el margen cae bajo el piso', () => {
    expect(evaluateMarginDrop(0.18, 0.25).triggered).toBe(true);
  });
  it('no dispara si el margen está bien', () => {
    expect(evaluateMarginDrop(0.3, 0.25).triggered).toBe(false);
  });
  it('no dispara sin margen (sin receta/precio)', () => {
    expect(evaluateMarginDrop(null, 0.25).triggered).toBe(false);
  });
});

describe('evaluateInputPriceRise', () => {
  it('dispara si el mercado supera tu precio en > risePct', () => {
    const r = evaluateInputPriceRise(6.0, 4.5, 0.2); // +33%
    expect(r.triggered).toBe(true);
    expect(r.context.changePct).toBeCloseTo(1 / 3, 4);
  });
  it('no dispara si la subida es menor al umbral', () => {
    expect(evaluateInputPriceRise(4.8, 4.5, 0.2).triggered).toBe(false); // +6.7%
  });
  it('no dispara sin baseline', () => {
    expect(evaluateInputPriceRise(6.0, null, 0.2).triggered).toBe(false);
  });
});

describe('evaluateCompetitorDrop', () => {
  it('dispara si la mediana de mercado bajó > dropPct', () => {
    expect(evaluateCompetitorDrop(34, 42, 0.1).triggered).toBe(true); // -19%
  });
  it('no dispara con una baja pequeña', () => {
    expect(evaluateCompetitorDrop(40, 42, 0.1).triggered).toBe(false); // -4.8%
  });
  it('no dispara si subió', () => {
    expect(evaluateCompetitorDrop(45, 42, 0.1).triggered).toBe(false);
  });
});
