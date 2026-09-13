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
});
export type UpdateCanonicalInput = z.infer<typeof updateCanonicalInputSchema>;
