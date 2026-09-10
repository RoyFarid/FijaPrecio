import { z } from 'zod';
import { scenarioOverrideTypeSchema } from '@fijaprecio/shared-types';

/** Un override. La validación fina del `patch` por tipo se hace en superRefine;
 *  el motor (`applyScenarioOverrides`) es la última línea de defensa. */
export const overrideSchema = z
  .object({
    type: scenarioOverrideTypeSchema,
    targetRef: z.string().uuid().nullable().default(null),
    patch: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((ov, ctx) => {
    if (ov.type !== 'MARGIN' && !ov.targetRef) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${ov.type} requiere targetRef`, path: ['targetRef'] });
    }
    const needsNumber = (key: string) => {
      if (typeof ov.patch[key] !== 'number') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `patch.${key} debe ser un número`, path: ['patch', key] });
      }
    };
    if (ov.type === 'MARGIN') needsNumber('marginPct');
    if (ov.type === 'INPUT_PRICE' || ov.type === 'SUPPLIER_SWAP') needsNumber('unitPrice');
  });

const scenarioDefSchema = z.object({
  name: z.string().trim().min(1).max(80),
  overrides: z.array(overrideSchema).min(1).max(25),
});

export const compareScenariosSchema = z.object({
  scenarios: z.array(scenarioDefSchema).min(1).max(10),
});
export type CompareScenariosInput = z.infer<typeof compareScenariosSchema>;

export const createScenarioSchema = z.object({
  name: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(1000).optional(),
  overrides: z.array(overrideSchema).min(1).max(50),
});
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
