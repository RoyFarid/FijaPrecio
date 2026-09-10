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
});
export type CreateCanonicalInput = z.infer<typeof createCanonicalInputSchema>;
