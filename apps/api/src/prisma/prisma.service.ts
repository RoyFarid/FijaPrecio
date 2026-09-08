import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createPrismaClient, type Prisma, type PrismaClient } from '@fijaprecio/db';
import { env } from '../config/env.js';
import { currentOrgContext } from '../tenancy/org-context.js';

/**
 * PrismaService: envuelve el cliente generado. La URL viene de la config YA
 * validada (env.DATABASE_URL), nunca de process.env directo.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient = createPrismaClient({
    databaseUrl: env.DATABASE_URL,
    logLevel: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  /**
   * Ejecuta `fn` dentro de una transacción con `app.current_org` fijado, de modo
   * que las políticas RLS de Postgres filtran por ese tenant (defensa en
   * profundidad; el scoping principal sigue siendo el `where` de cada query).
   *
   * `orgId` por defecto sale del contexto de la request (AsyncLocalStorage).
   */
  withOrg<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, orgId?: string): Promise<T> {
    const organizationId = orgId ?? currentOrgContext()?.organizationId;
    if (!organizationId) {
      throw new Error('withOrg() sin organizationId ni contexto de request');
    }
    return this.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
      return fn(tx);
    });
  }
}
