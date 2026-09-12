import { describe, expect, it } from 'vitest';
import { createAlertFormSchema, createProductFormSchema } from './schemas';

const baseProduct = {
  name: 'Torta',
  rubro: '',
  radarQuery: '',
  currency: 'PEN',
  targetPrice: '',
  targetMarginPct: '',
  outputQuantity: '1',
  outputUnit: '',
  laborMinutes: '',
  lines: [{ name: 'Harina', unit: 'kg', quantity: '2', wastePct: '', unitCost: '' }],
  components: [],
};

describe('createProductFormSchema', () => {
  it('acepta un producto mínimo válido', () => {
    expect(createProductFormSchema.safeParse(baseProduct).success).toBe(true);
  });

  it('rechaza cantidad no positiva', () => {
    const bad = { ...baseProduct, lines: [{ ...baseProduct.lines[0], quantity: '0' }] };
    const r = createProductFormSchema.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it('exige al menos un insumo', () => {
    expect(createProductFormSchema.safeParse({ ...baseProduct, lines: [] }).success).toBe(false);
  });

  it('margen objetivo fuera de 0–0.99 falla', () => {
    expect(
      createProductFormSchema.safeParse({ ...baseProduct, targetMarginPct: '1.2' }).success,
    ).toBe(false);
  });
});

describe('createAlertFormSchema', () => {
  const base = {
    name: 'Margen bajo torta',
    type: 'MARGIN_DROP' as const,
    productId: '',
    canonicalInputId: '',
    marginFloorPct: '',
    risePct: '',
    dropPct: '',
    channels: ['IN_APP' as const],
  };

  it('MARGIN_DROP exige productId y marginFloorPct', () => {
    expect(createAlertFormSchema.safeParse(base).success).toBe(false);
    const ok = createAlertFormSchema.safeParse({
      ...base,
      productId: '00000000-0000-7000-8000-000000000000',
      marginFloorPct: '0.3',
    });
    expect(ok.success).toBe(true);
  });

  it('INPUT_PRICE_RISE exige canonicalInputId y risePct', () => {
    const r = createAlertFormSchema.safeParse({ ...base, type: 'INPUT_PRICE_RISE' });
    expect(r.success).toBe(false);
  });

  it('exige al menos un canal', () => {
    expect(createAlertFormSchema.safeParse({ ...base, channels: [] }).success).toBe(false);
  });
});
