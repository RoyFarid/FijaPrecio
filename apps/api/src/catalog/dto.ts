import { z } from 'zod';
import { CanonicalInputStatus } from '@fijaprecio/db';

export const catalogSearchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});
export type CatalogSearchQuery = z.infer<typeof catalogSearchSchema>;

export const createCanonicalInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  baseUnit: z.string().trim().min(1).max(24),
  categoryId: z.string().uuid().optional(),
  description: z.string().trim().max(500).optional(),
  status: z.nativeEnum(CanonicalInputStatus).optional(),
  aliases: z.array(z.string().trim().min(2).max(160)).max(20).optional(),
  // Término de búsqueda curado para el scraping — ver comentario en schema.prisma.
  radarQuery: z.string().trim().min(2).max(160).optional(),
});
export type CreateCanonicalInput = z.infer<typeof createCanonicalInputSchema>;

export const updateCanonicalInputSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.nativeEnum(CanonicalInputStatus).optional(),
  radarQuery: z.string().trim().min(2).max(160).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateCanonicalInput = z.infer<typeof updateCanonicalInputSchema>;

const attributeValueTypeSchema = z.enum(['TEXT', 'NUMBER', 'NUMBER_WITH_UNIT', 'ENUM', 'BOOLEAN']);

export const createInputCategoryAttributeSchema = z
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
export type CreateInputCategoryAttribute = z.infer<typeof createInputCategoryAttributeSchema>;
