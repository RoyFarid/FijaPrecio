import { z } from 'zod';
import { CostCalcMethod, CostComponentType, ProductStatus } from '@fijaprecio/db';

const money = z.number().nonnegative().finite();
const fraction = z.number().min(0).max(1);

const lineSchema = z.object({
  input: z.object({
    name: z.string().trim().min(1).max(160),
    unit: z.string().trim().min(1).max(24),
    unitCost: money.optional(), // se guarda como lastKnownPrice del OrgInput
  }),
  quantity: z.number().positive().finite(),
  unit: z.string().trim().min(1).max(24).optional(),
  wastePct: fraction.default(0),
  unitCostOverride: money.optional(),
});

const componentSchema = z.object({
  type: z.nativeEnum(CostComponentType),
  label: z.string().trim().min(1).max(120),
  calc: z.nativeEnum(CostCalcMethod),
  value: z.number().finite(),
});

const recipeSchema = z.object({
  outputQuantity: z.number().positive().finite().default(1),
  outputUnit: z.string().trim().min(1).max(24).optional(),
  laborMinutes: z.number().nonnegative().finite().optional(),
  lines: z.array(lineSchema).min(1).max(200),
  components: z.array(componentSchema).max(50).default([]),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  rubro: z.string().trim().max(60).optional(),
  // Término de búsqueda curado para el radar de mercado (scope=FINAL_PRODUCT).
  // Si no se manda, el radar busca por `name` — hace falta cuando el nombre es
  // demasiado genérico ("Pan") para una búsqueda de mercado específica.
  radarQuery: z.string().trim().min(1).max(160).optional(),
  currency: z.string().length(3).default('PEN'),
  targetPrice: money.optional(),
  targetMarginPct: fraction.optional(),
  recipe: recipeSchema,
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

/** PATCH de los datos del producto (no la receta). `null` limpia el valor. */
export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    rubro: z.string().trim().max(60).nullable().optional(),
    radarQuery: z.string().trim().min(1).max(160).nullable().optional(),
    currency: z.string().length(3).optional(),
    targetPrice: money.nullable().optional(),
    targetMarginPct: fraction.nullable().optional(),
    status: z.nativeEnum(ProductStatus).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'Nada que actualizar');
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/** PUT de la receta activa: crea una versión nueva y desactiva la anterior. */
export const replaceRecipeSchema = recipeSchema;
export type ReplaceRecipeInput = z.infer<typeof replaceRecipeSchema>;
