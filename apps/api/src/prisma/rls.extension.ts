import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@fijaprecio/db';
import { currentOrgContext } from '../tenancy/org-context.js';

/**
 * Envuelve CADA operación de modelo en una transacción que fija la variable de
 * sesión de RLS según el contexto de la request (AsyncLocalStorage):
 *   - tenant                → `set_config('app.current_org', <orgId>, true)`
 *   - system / sin contexto → `set_config('app.bypass_rls', 'on', true)`
 *
 * Coste: toda query pasa a ser una tx de 2 sentencias. Aceptable a escala MVP;
 * la mejora futura es fijar la variable a nivel de conexión (PgBouncer session).
 *
 * `PrismaService.withRls` / `asSystem` usan el cliente BASE (sin esta extensión)
 * y marcan `rlsReentry`, así que sus queries no se re-envuelven.
 */

export const rlsReentry = new AsyncLocalStorage<true>();

export const rlsExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'rls',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          if (rlsReentry.getStore()) return query(args);

          const ctx = currentOrgContext();
          const setConfig =
            ctx?.mode === 'tenant'
              ? client.$executeRaw`SELECT set_config('app.current_org', ${ctx.organizationId}, true)`
              : client.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

          return rlsReentry.run(true, async () => {
            const [, result] = await client.$transaction([setConfig, query(args)]);
            return result;
          });
        },
      },
    },
  }),
);
