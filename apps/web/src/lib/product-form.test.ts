import { describe, expect, it } from 'vitest';
import {
  formToCreatePayload,
  formToRecipePayload,
  formToUpdatePayload,
  productToFormValues,
} from './product-form';
import type { CreateProductForm } from './schemas';
import type { ProductDetail } from './types';

const form: CreateProductForm = {
  name: '  Torta  ',
  rubro: '',
  currency: 'pen',
  targetPrice: '50',
  targetMarginPct: '',
  outputQuantity: '2',
  outputUnit: 'porción',
  laborMinutes: '',
  lines: [{ name: ' Harina ', unit: 'kg', quantity: '1', wastePct: '0.05', unitCost: '4' }],
  components: [{ type: 'PACKAGING', label: 'Caja', calc: 'PER_UNIT', value: '0.8' }],
};

describe('formToCreatePayload', () => {
  it('recorta strings, normaliza moneda y parsea números', () => {
    const p = formToCreatePayload(form);
    expect(p.name).toBe('Torta');
    expect(p.currency).toBe('PEN');
    expect(p.rubro).toBeUndefined();
    expect(p.targetPrice).toBe(50);
    expect(p.targetMarginPct).toBeUndefined();
    expect(p.recipe.outputQuantity).toBe(2);
    expect(p.recipe.lines[0]).toEqual({
      input: { name: 'Harina', unit: 'kg', unitCost: 4 },
      quantity: 1,
      wastePct: 0.05,
    });
    expect(p.recipe.components[0]).toEqual({
      type: 'PACKAGING',
      label: 'Caja',
      calc: 'PER_UNIT',
      value: 0.8,
    });
  });

  it('cantidades vacías caen a 0 y outputQuantity a 1', () => {
    const bad = { ...form, outputQuantity: '', lines: [{ ...form.lines[0]!, quantity: '' }] };
    const r = formToRecipePayload(bad);
    expect(r.outputQuantity).toBe(1);
    expect(r.lines[0]!.quantity).toBe(0);
  });
});

describe('formToUpdatePayload', () => {
  it('rubro/targets vacíos → null (limpiar)', () => {
    expect(formToUpdatePayload(form)).toMatchObject({
      name: 'Torta',
      rubro: null,
      currency: 'PEN',
      targetPrice: 50,
      targetMarginPct: null,
    });
  });
});

describe('productToFormValues', () => {
  it('sin producto → defaults con una línea vacía', () => {
    const v = productToFormValues();
    expect(v.currency).toBe('PEN');
    expect(v.outputQuantity).toBe('1');
    expect(v.lines).toHaveLength(1);
    expect(v.lines[0]!.name).toBe('');
  });

  it('con producto → precarga strings desde la receta', () => {
    const product = {
      id: 'p1',
      name: 'Pan',
      slug: null,
      rubro: 'panadería',
      description: null,
      currency: 'PEN',
      status: 'ACTIVE',
      targetPrice: 12,
      targetMarginPct: null,
      createdAt: '',
      updatedAt: '',
      recipe: {
        id: 'r1',
        version: 3,
        outputQuantity: 10,
        outputUnit: 'unidad',
        laborMinutes: 30,
        lines: [
          {
            id: 'l1',
            orgInputId: 'oi1',
            displayName: 'Harina',
            canonicalInputId: null,
            quantity: 5,
            unit: 'kg',
            wastePct: 0,
            unitCostOverride: null,
            lastKnownPrice: 3.5,
          },
        ],
        components: [],
      },
    } as unknown as ProductDetail;

    const v = productToFormValues(product);
    expect(v.name).toBe('Pan');
    expect(v.targetPrice).toBe('12');
    expect(v.targetMarginPct).toBe('');
    expect(v.outputUnit).toBe('unidad');
    expect(v.lines[0]).toMatchObject({ name: 'Harina', unit: 'kg', quantity: '5', unitCost: '3.5' });
    expect(v.lines[0]!.wastePct).toBe('');
  });
});
