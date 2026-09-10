import { describe, expect, it } from 'vitest';
import {
  emptyOverride,
  overrideToPayload,
  scenarioToPayload,
  toComparePayload,
  type DraftOverride,
  type DraftScenario,
} from './scenario-draft';

const ov = (patch: Partial<DraftOverride>): DraftOverride => ({
  ...emptyOverride(),
  ...patch,
});

describe('overrideToPayload', () => {
  it('MARGIN necesita marginPct y no lleva targetRef', () => {
    expect(overrideToPayload(ov({ type: 'MARGIN', patch: {} }))).toBeNull();
    expect(overrideToPayload(ov({ type: 'MARGIN', patch: { marginPct: '0.4' } }))).toEqual({
      type: 'MARGIN',
      targetRef: null,
      patch: { marginPct: 0.4 },
    });
  });

  it('INPUT_PRICE necesita targetRef y unitPrice numérico', () => {
    expect(overrideToPayload(ov({ type: 'INPUT_PRICE', targetRef: '', patch: { unitPrice: '5' } }))).toBeNull();
    expect(
      overrideToPayload(ov({ type: 'INPUT_PRICE', targetRef: 'line-1', patch: { unitPrice: '' } })),
    ).toBeNull();
    expect(
      overrideToPayload(ov({ type: 'INPUT_PRICE', targetRef: 'line-1', patch: { unitPrice: '5.5' } })),
    ).toEqual({ type: 'INPUT_PRICE', targetRef: 'line-1', patch: { unitPrice: 5.5 } });
  });

  it('RECIPE_LINE acepta un patch parcial y descarta campos vacíos / no numéricos', () => {
    expect(
      overrideToPayload(
        ov({
          type: 'RECIPE_LINE',
          targetRef: 'line-1',
          patch: { quantity: '2', wastePct: '', unitCost: 'abc' },
        }),
      ),
    ).toEqual({ type: 'RECIPE_LINE', targetRef: 'line-1', patch: { quantity: 2 } });
  });

  it('RECIPE_LINE sin ningún campo de patch es inválido', () => {
    expect(
      overrideToPayload(ov({ type: 'RECIPE_LINE', targetRef: 'line-1', patch: {} })),
    ).toBeNull();
  });
});

describe('scenarioToPayload / toComparePayload', () => {
  const good: DraftScenario = {
    id: 's1',
    name: '  Sube harina  ',
    overrides: [
      ov({ type: 'INPUT_PRICE', targetRef: 'l1', patch: { unitPrice: '4' } }),
      ov({ type: 'MARGIN', patch: {} }), // inválido, se descarta
    ],
  };

  it('recorta el nombre y filtra overrides inválidos', () => {
    expect(scenarioToPayload(good)).toEqual({
      name: 'Sube harina',
      overrides: [{ type: 'INPUT_PRICE', targetRef: 'l1', patch: { unitPrice: 4 } }],
    });
  });

  it('escenario sin overrides válidos → null; toComparePayload → null si nada listo', () => {
    const empty: DraftScenario = { id: 's2', name: 'x', overrides: [ov({ type: 'MARGIN', patch: {} })] };
    expect(scenarioToPayload(empty)).toBeNull();
    expect(toComparePayload([empty])).toBeNull();
    expect(toComparePayload([good, empty])?.scenarios).toHaveLength(1);
  });

  it('nombre vacío cae a un default', () => {
    const s: DraftScenario = {
      id: 's3',
      name: '   ',
      overrides: [ov({ type: 'MARGIN', patch: { marginPct: '0.3' } })],
    };
    expect(scenarioToPayload(s)?.name).toBe('Escenario');
  });
});
