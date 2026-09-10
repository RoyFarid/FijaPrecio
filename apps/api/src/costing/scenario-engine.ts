/**
 * Aplicación de overrides de escenario sobre un `EngineInput`. Puro: no toca DB.
 * El resultado se pasa tal cual a `computeCosting`, así que un escenario reusa
 * exactamente el mismo motor que el costeo real.
 *
 * Tipos de override (enum ScenarioOverrideType):
 *   RECIPE_LINE   targetRef=line   patch { quantity?, wastePct?, unitCost? }
 *   INPUT_PRICE   targetRef=line   patch { unitPrice }
 *   SUPPLIER_SWAP targetRef=line   patch { unitPrice, supplierId? }   (marca priceSource='supplier')
 *   COST_COMPONENT targetRef=comp  patch { value?, calc? }
 *   MARGIN        targetRef=null    patch { marginPct }
 */
import type { CostComponentCalc, EngineInput } from './engine.js';

export type ScenarioOverrideType =
  | 'RECIPE_LINE'
  | 'INPUT_PRICE'
  | 'SUPPLIER_SWAP'
  | 'COST_COMPONENT'
  | 'MARGIN';

export interface ScenarioOverride {
  type: ScenarioOverrideType;
  targetRef: string | null;
  patch: Record<string, unknown>;
}

export class ScenarioOverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioOverrideError';
  }
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

export function applyScenarioOverrides(
  base: EngineInput,
  overrides: ScenarioOverride[],
): EngineInput {
  const lines = base.lines.map((l) => ({ ...l }));
  const components = base.components.map((c) => ({ ...c }));
  let targetMarginPct = base.targetMarginPct ?? null;

  const findLine = (ref: string | null) => {
    const line = lines.find((l) => l.ref === ref);
    if (!line) throw new ScenarioOverrideError(`No existe la línea de receta "${ref}"`);
    return line;
  };
  const findComponent = (ref: string | null) => {
    const comp = components.find((c) => c.ref === ref);
    if (!comp) throw new ScenarioOverrideError(`No existe el componente "${ref}"`);
    return comp;
  };

  for (const ov of overrides) {
    switch (ov.type) {
      case 'RECIPE_LINE': {
        const line = findLine(ov.targetRef);
        const q = num(ov.patch.quantity);
        const w = num(ov.patch.wastePct);
        const uc = num(ov.patch.unitCost);
        if (q !== undefined) line.quantity = q;
        if (w !== undefined) line.wastePct = w;
        if (uc !== undefined) {
          line.unitCost = uc;
          line.priceSource = 'override';
        }
        break;
      }
      case 'INPUT_PRICE':
      case 'SUPPLIER_SWAP': {
        const line = findLine(ov.targetRef);
        const p = num(ov.patch.unitPrice);
        if (p === undefined) throw new ScenarioOverrideError('Falta patch.unitPrice');
        line.unitCost = p;
        line.priceSource = ov.type === 'SUPPLIER_SWAP' ? 'supplier' : 'override';
        break;
      }
      case 'COST_COMPONENT': {
        const comp = findComponent(ov.targetRef);
        const v = num(ov.patch.value);
        const calc = ov.patch.calc as CostComponentCalc | undefined;
        if (v !== undefined) comp.value = v;
        if (calc !== undefined) comp.calc = calc;
        break;
      }
      case 'MARGIN': {
        const m = num(ov.patch.marginPct);
        if (m === undefined) throw new ScenarioOverrideError('Falta patch.marginPct');
        targetMarginPct = m;
        break;
      }
      default:
        throw new ScenarioOverrideError(`Tipo de override desconocido: ${ov.type as string}`);
    }
  }

  return { ...base, lines, components, targetMarginPct };
}
