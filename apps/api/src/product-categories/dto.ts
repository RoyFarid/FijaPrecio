import { z } from 'zod';

export const listProductCategoriesQuerySchema = z.object({
  parentId: z.string().uuid().optional(),
  // Solo aplica cuando se omite parentId (nivel raíz) — filtra por rubro.
  rubro: z.string().trim().min(1).max(60).optional(),
});
export type ListProductCategoriesQuery = z.infer<typeof listProductCategoriesQuerySchema>;

export const createProductCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    parentId: z.string().uuid().optional(),
    // Requerido solo para categorías raíz (rubro nuevo); las hijas heredan el
    // rubro del padre.
    rubro: z.string().trim().min(2).max(60).optional(),
  })
  .refine((v) => v.parentId != null || v.rubro != null, {
    message: 'rubro es obligatorio para crear una categoría raíz (sin parentId)',
    path: ['rubro'],
  });
export type CreateProductCategory = z.infer<typeof createProductCategorySchema>;

const attributeValueTypeSchema = z.enum(['TEXT', 'NUMBER', 'NUMBER_WITH_UNIT', 'ENUM', 'BOOLEAN']);

export const createProductCategoryAttributeSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z][a-zA-Z0-9]*$/, 'usar camelCase, ej. "tipoHarina"'),
    label: z.string().trim().min(2).max(160),
    valueType: attributeValueTypeSchema,
    unit: z.string().trim().min(1).max(24).optional(),
    options: z.array(z.string().trim().min(1).max(120)).min(1).max(50).optional(),
    required: z.boolean().default(false),
    helpText: z.string().trim().max(300).optional(),
    sortOrder: z.number().int().default(0),
  })
  .refine((v) => v.valueType !== 'ENUM' || (v.options && v.options.length > 0), {
    message: 'ENUM requiere options',
    path: ['options'],
  });
export type CreateProductCategoryAttribute = z.infer<typeof createProductCategoryAttributeSchema>;
