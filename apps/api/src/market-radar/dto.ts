import { z } from 'zod';
import { marketPriceBatchSchema } from '@fijaprecio/shared-types';

export const ingestMarketPricesSchema = marketPriceBatchSchema;

export const radarTargetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type RadarTargetsQuery = z.infer<typeof radarTargetsQuerySchema>;

export const radarQuerySchema = z.object({
  region: z.string().trim().min(2).max(10).optional(),
});
export type RadarQuery = z.infer<typeof radarQuerySchema>;
