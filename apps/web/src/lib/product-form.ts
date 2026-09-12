import type { CreateProductForm } from './schemas';
import type {
  CreateProductInput,
  RecipePayload,
  UpdateProductPayload,
} from './api-payloads';
import type { ProductDetail } from './types';

const num = (v: string): number | undefined => {
  const s = v.trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const str = (n: number | null | undefined): string => (n == null ? '' : String(n));

export const EMPTY_LINE = { name: '', unit: '', quantity: '', wastePct: '', unitCost: '' };
export const EMPTY_COMPONENT = {
  type: 'LABOR',
  label: '',
  calc: 'FIXED',
  value: '',
} as const;

/** `ProductDetail` (o nada) → valores iniciales del form. */
export function productToFormValues(product?: ProductDetail | null): CreateProductForm {
  const recipe = product?.recipe ?? null;
  return {
    name: product?.name ?? '',
    rubro: product?.rubro ?? '',
    radarQuery: product?.radarQuery ?? '',
    currency: product?.currency ?? 'PEN',
    targetPrice: str(product?.targetPrice),
    targetMarginPct: str(product?.targetMarginPct),
    outputQuantity: recipe ? str(recipe.outputQuantity) : '1',
    outputUnit: recipe?.outputUnit ?? '',
    laborMinutes: recipe ? str(recipe.laborMinutes) : '',
    lines:
      recipe && recipe.lines.length > 0
        ? recipe.lines.map((l) => ({
            name: l.displayName,
            unit: l.unit,
            quantity: str(l.quantity),
            wastePct: l.wastePct ? str(l.wastePct) : '',
            unitCost: str(l.unitCostOverride ?? l.lastKnownPrice),
          }))
        : [{ ...EMPTY_LINE }],
    components: (recipe?.components ?? []).map((c) => ({
      type: c.type,
      label: c.label,
      calc: c.calc,
      value: str(c.value),
    })),
  };
}

export function formToRecipePayload(values: CreateProductForm): RecipePayload {
  return {
    outputQuantity: num(values.outputQuantity) ?? 1,
    outputUnit: values.outputUnit.trim() || undefined,
    laborMinutes: num(values.laborMinutes),
    lines: values.lines.map((l) => ({
      input: { name: l.name.trim(), unit: l.unit.trim(), unitCost: num(l.unitCost) },
      quantity: num(l.quantity) ?? 0,
      wastePct: num(l.wastePct) ?? 0,
    })),
    components: values.components.map((c) => ({
      type: c.type,
      label: c.label.trim(),
      calc: c.calc,
      value: num(c.value) ?? 0,
    })),
  };
}

const cleanCurrency = (v: string): string => (v.trim().toUpperCase() || 'PEN').slice(0, 3);

export function formToCreatePayload(values: CreateProductForm): CreateProductInput {
  return {
    name: values.name.trim(),
    rubro: values.rubro.trim() || undefined,
    radarQuery: values.radarQuery.trim() || undefined,
    currency: cleanCurrency(values.currency),
    targetPrice: num(values.targetPrice),
    targetMarginPct: num(values.targetMarginPct),
    recipe: formToRecipePayload(values),
  };
}

/** Campos del producto para el PATCH (rubro/radarQuery/targets vacíos → null = limpiar). */
export function formToUpdatePayload(values: CreateProductForm): UpdateProductPayload {
  return {
    name: values.name.trim(),
    rubro: values.rubro.trim() || null,
    radarQuery: values.radarQuery.trim() || null,
    currency: cleanCurrency(values.currency),
    targetPrice: num(values.targetPrice) ?? null,
    targetMarginPct: num(values.targetMarginPct) ?? null,
  };
}
