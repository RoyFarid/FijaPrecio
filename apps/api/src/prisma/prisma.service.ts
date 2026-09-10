import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createPrismaClient, type Prisma, type PrismaClient } from '@fijaprecio/db';
import { env } from '../config/env.js';
import { currentOrgId } from '../tenancy/org-context.js';
import { rlsExtension, rlsReentry } from './rls.extension.js';

/**
 * PrismaService.
 *
 * Cuando `DB_RLS_ENFORCED=true` y hay `APP_DATABASE_URL`, `client` conecta con el
 * rol NOBYPASSRLS `fijaprecio_app` y lleva la extensión `rls`: cada query de
 * modelo se envuelve en una tx que fija `app.current_org` (request de tenant) o
 * `app.bypass_rls` (system / sin contexto). El scoping primario sigue siendo el
 * `where: { organizationId }`; RLS es la red de seguridad.
 *
 * `withRls` / `asSystem` usan el cliente BASE (sin extensión) para transacciones
 * interactivas: fijan la variable una vez y corren `fn` bajo `rlsReentry`.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  readonly rlsEnforced = env.DB_RLS_ENFORCED && Boolean(env.APP_DATABASE_URL);

  private readonly base: PrismaClient = createPrismaClient({
    databaseUrl: this.rlsEnforced ? env.APP_DATABASE_URL! : env.DATABASE_URL,
    logLevel: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

  readonly client: PrismaClient = this.rlsEnforced
    ? (this.base.$extends(rlsExtension) as unknown as PrismaClient)
    : this.base;

  async onModuleInit(): Promise<void> {
    await this.base.$connect();
    if (this.rlsEnforced) this.logger.log('RLS activo (rol fijaprecio_app)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect();
  }

  /**
   * Transacción interactiva con `app.current_org` fijado. `orgId` por defecto
   * sale del contexto de la request (AsyncLocalStorage).
   */
  withRls<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, orgId?: string): Promise<T> {
    const organizationId = orgId ?? currentOrgId();
    if (!organizationId) {
      throw new Error('withRls() sin organizationId ni contexto de tenant');
    }
    return this.base.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
      return rlsReentry.run(true, () => fn(tx));
    });
  }

  /** Transacción interactiva con `app.bypass_rls = on` (crons, jobs, ingesta). */
  asSystem<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.base.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return rlsReentry.run(true, () => fn(tx));
    });
  }

  /** Alias retro-compatible de `withRls`. */
  withOrg<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, orgId?: string): Promise<T> {
    return this.withRls(fn, orgId);
  }
}
