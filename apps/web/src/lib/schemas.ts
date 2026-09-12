import { z } from 'zod';

/**
 * Esquemas de los formularios de auth. Réplica intencional de
 * `apps/api/src/auth/dto.ts` (mismas reglas) — no se importan de shared-types
 * para no arrastrar `@fijaprecio/db`/Prisma al bundle del navegador.
 */

export const loginFormSchema = z.object({
  email: z.string().email('Correo inválido').max(200),
  password: z.string().min(1, 'Ingresa tu contraseña').max(200),
});
export type LoginForm = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(120),
  organizationName: z.string().trim().min(1, 'Requerido').max(120),
  email: z.string().email('Correo inválido').max(200),
  password: z.string().min(10, 'Mínimo 10 caracteres').max(200),
});
export type RegisterForm = z.infer<typeof registerFormSchema>;

// --- Alta de producto -----------------------------------------------------
// Los campos numéricos son `string` en el form (inputs); la página los parsea
// al armar el payload para `POST /v1/products`. Así RHF no pelea con coerción.

const REQ = 'Requerido';
const numStr = (msg = 'Número inválido') =>
  z.string().refine((v) => v === '' || Number.isFinite(Number(v)), msg);
const numStrReq = (msg = 'Número inválido') =>
  z.string().min(1, REQ).refine((v) => Number.isFinite(Number(v)), msg);

export const productLineSchema = z.object({
  name: z.string().trim().min(1, REQ).max(160),
  unit: z.string().trim().min(1, REQ).max(24),
  quantity: numStrReq().refine((v) => Number(v) > 0, '> 0'),
  wastePct: numStr(),
  unitCost: numStr(),
});
export type ProductLineForm = z.infer<typeof productLineSchema>;

export const componentTypeValues = [
  'LABOR',
  'OVERHEAD',
  'PACKAGING',
  'SHIPPING',
  'PLATFORM_FEE',
  'TAX',
  'OTHER',
] as const;
export const calcMethodValues = [
  'FIXED',
  'PER_UNIT',
  'PER_HOUR',
  'PCT_OF_DIRECT_COST',
  'PCT_OF_TOTAL_COST',
] as const;

export const productComponentSchema = z.object({
  type: z.enum(componentTypeValues),
  label: z.string().trim().min(1, REQ).max(120),
  calc: z.enum(calcMethodValues),
  value: numStrReq(),
});
export type ProductComponentForm = z.infer<typeof productComponentSchema>;

export const createProductFormSchema = z.object({
  name: z.string().trim().min(1, REQ).max(160),
  rubro: z.string().trim().max(60),
  radarQuery: z.string().trim().max(160),
  currency: z.string().length(3),
  targetPrice: numStr(),
  targetMarginPct: numStr().refine((v) => v === '' || (Number(v) >= 0 && Number(v) < 1), '0–0.99'),
  outputQuantity: numStrReq().refine((v) => Number(v) > 0, '> 0'),
  outputUnit: z.string().trim().max(24),
  laborMinutes: numStr(),
  lines: z.array(productLineSchema).min(1, 'Agrega al menos un insumo').max(200),
  components: z.array(productComponentSchema).max(50),
});
export type CreateProductForm = z.infer<typeof createProductFormSchema>;

// --- Alertas (réplica de shared-types createAlertSchema) -------------------

export const alertTypeValues = [
  'MARGIN_DROP',
  'INPUT_PRICE_RISE',
  'COMPETITOR_PRICE_DROP',
  'CONSENSUS_SHIFT',
] as const;
export const channelValues = ['IN_APP', 'EMAIL', 'TELEGRAM'] as const;

export const createAlertFormSchema = z
  .object({
    name: z.string().trim().min(1, REQ).max(120),
    type: z.enum(alertTypeValues),
    productId: z.string(),
    canonicalInputId: z.string(),
    marginFloorPct: numStr(),
    risePct: numStr(),
    dropPct: numStr(),
    channels: z.array(z.enum(channelValues)).min(1, 'Elige al menos un canal'),
  })
  .superRefine((a, ctx) => {
    const needsProduct = a.type === 'MARGIN_DROP' || a.type === 'COMPETITOR_PRICE_DROP';
    const needsInput = a.type === 'INPUT_PRICE_RISE' || a.type === 'CONSENSUS_SHIFT';
    if (needsProduct && !a.productId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQ, path: ['productId'] });
    }
    if (needsInput && !a.canonicalInputId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQ, path: ['canonicalInputId'] });
    }
    if (a.type === 'MARGIN_DROP' && !a.marginFloorPct) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQ, path: ['marginFloorPct'] });
    }
    if (needsInput && !a.risePct) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQ, path: ['risePct'] });
    }
    if (a.type === 'COMPETITOR_PRICE_DROP' && !a.dropPct) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQ, path: ['dropPct'] });
    }
  });
export type CreateAlertForm = z.infer<typeof createAlertFormSchema>;
