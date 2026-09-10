import { z } from 'zod';
import {
  priceObservationBatchSchema,
  priceObservationInputSchema,
} from '@fijaprecio/shared-types';

/** Aporte manual: MANUAL se fuerza en el servicio; el scope define qué ref exige. */
export const manualObservationSchema = priceObservationInputSchema
  .omit({ source: true })
  .superRefine((o, ctx) => {
    if (o.scope === 'INPUT' && !o.canonicalInputId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scope=INPUT requiere canonicalInputId', path: ['canonicalInputId'] });
    }
    if (o.scope === 'FINAL_PRODUCT' && !o.productQuery) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scope=FINAL_PRODUCT requiere productQuery', path: ['productQuery'] });
    }
  });
export type ManualObservationInput = z.infer<typeof manualObservationSchema>;

export const ingestBatchSchema = priceObservationBatchSchema;

export const consensusQuerySchema = z.object({
  region: z.string().trim().min(2).max(10).default('PE'),
  currency: z.string().trim().length(3).default('PEN'),
});
export type ConsensusQuery = z.infer<typeof consensusQuerySchema>;

export const scrapeTargetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ScrapeTargetsQuery = z.infer<typeof scrapeTargetsQuerySchema>;

export interface ScrapeTarget {
  canonicalInputId: string;
  query: string;
  baseUnit: string;
}
