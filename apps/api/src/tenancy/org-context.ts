import { AsyncLocalStorage } from 'node:async_hooks';
import type { MembershipRole } from '@fijaprecio/db';

/**
 * Contexto por request para RLS:
 *   - `tenant`: request autenticada → las queries fijan `app.current_org`.
 *   - `system`: cron / ingesta interna / auth → las queries usan `app.bypass_rls`.
 * Sin contexto (health, rutas sueltas) el PrismaService trata la query como `system`.
 */
export type OrgContext =
  | { mode: 'tenant'; userId: string; organizationId: string; role: MembershipRole }
  | { mode: 'system' };

const storage = new AsyncLocalStorage<OrgContext>();

export const orgContextStorage = storage;

export function runWithOrgContext<T>(ctx: OrgContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** Contexto de la request en curso, si lo hay. */
export function currentOrgContext(): OrgContext | undefined {
  return storage.getStore();
}

/** organizationId si la request es de tenant. */
export function currentOrgId(): string | undefined {
  const ctx = storage.getStore();
  return ctx?.mode === 'tenant' ? ctx.organizationId : undefined;
}
