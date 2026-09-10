import type { ScenarioOverrideType } from './types';

/**
 * Estado local del simulador de escenarios (puro, testeable). Los valores del
 * `patch` son strings mientras se editan; `toComparePayload` los convierte.
 */

export interface DraftOverride {
  id: string;
  type: ScenarioOverrideType;
  targetRef: string;
  patch: Record<string, string>;
}

export interface DraftScenario {
  id: string;
  name: string;
  overrides: DraftOverride[];
}

/** Campos numéricos del `patch` según el tipo de override. */
export const PATCH_FIELDS: Record<ScenarioOverrideType, readonly string[]> = {
  RECIPE_LINE: ['quantity', 'wastePct', 'unitCost'],
  INPUT_PRICE: ['unitPrice'],
  SUPPLIER_SWAP: ['unitPrice'],
  COST_COMPONENT: ['value'],
  MARGIN: ['marginPct'],
};

export const REQUIRES_LINE: readonly ScenarioOverrideType[] = [
  'RECIPE_LINE',
  'INPUT_PRICE',
  'SUPPLIER_SWAP',
];
export const REQUIRES_COMPONENT: readonly ScenarioOverrideType[] = ['COST_COMPONENT'];

let counter = 0;
export const uid = (): string => {
  counter += 1;
  return `d${counter}~${Math.random().toString(36).slice(2, 8)}`;
};

export function emptyOverride(type: ScenarioOverrideType = 'INPUT_PRICE'): DraftOverride {
  return { id: uid(), type, targetRef: '', patch: {} };
}

export function emptyScenario(name: string): DraftScenario {
  return { id: uid(), name, overrides: [emptyOverride()] };
}

const parseNum = (v: string | undefined): number | undefined => {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export interface OverridePayload {
  type: ScenarioOverrideType;
  targetRef: string | null;
  patch: Record<string, number>;
}

/** Convierte un override de draft a payload de API; `null` si está incompleto. */
export function overrideToPayload(ov: DraftOverride): OverridePayload | null {
  const patch: Record<string, number> = {};
  for (const field of PATCH_FIELDS[ov.type]) {
    const n = parseNum(ov.patch[field]);
    if (n !== undefined) patch[field] = n;
  }

  if (ov.type === 'MARGIN') {
    if (patch.marginPct === undefined) return null;
    return { type: ov.type, targetRef: null, patch };
  }

  if (!ov.targetRef) return null;

  if (ov.type === 'INPUT_PRICE' || ov.type === 'SUPPLIER_SWAP') {
    if (patch.unitPrice === undefined) return null;
  }
  if (Object.keys(patch).length === 0) return null;

  return { type: ov.type, targetRef: ov.targetRef, patch };
}

export interface ScenarioPayload {
  name: string;
  overrides: OverridePayload[];
}

/** Escenario listo para enviar, o `null` si no tiene overrides válidos. */
export function scenarioToPayload(s: DraftScenario): ScenarioPayload | null {
  const overrides = s.overrides
    .map(overrideToPayload)
    .filter((o): o is OverridePayload => o !== null);
  if (overrides.length === 0) return null;
  return { name: s.name.trim() || 'Escenario', overrides };
}

export function toComparePayload(
  scenarios: DraftScenario[],
): { scenarios: ScenarioPayload[] } | null {
  const ready = scenarios
    .map(scenarioToPayload)
    .filter((s): s is ScenarioPayload => s !== null);
  return ready.length > 0 ? { scenarios: ready } : null;
}
