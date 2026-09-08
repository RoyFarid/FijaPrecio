import { AsyncLocalStorage } from 'node:async_hooks';
import type { MembershipRole } from '@fijaprecio/db';

export interface OrgContext {
  userId: string;
  organizationId: string;
  role: MembershipRole;
}

const storage = new AsyncLocalStorage<OrgContext>();

export const orgContextStorage = storage;

export function runWithOrgContext<T>(ctx: OrgContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** Contexto de la request en curso, si lo hay. */
export function currentOrgContext(): OrgContext | undefined {
  return storage.getStore();
}

/** Igual que arriba pero exige que exista (rutas autenticadas). */
export function requireOrgContext(): OrgContext {
  const ctx = storage.getStore();
  if (!ctx) throw new Error('No hay contexto de organización en este scope');
  return ctx;
}
