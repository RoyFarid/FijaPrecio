import { PrismaClient, Prisma } from '@prisma/client';

export type CreatePrismaOptions = {
  /** URL de conexión ya validada por el servicio (config-schema). */
  databaseUrl: string;
  logLevel?: Prisma.LogLevel[];
};

/**
 * Factory del cliente Prisma. El servicio pasa la URL YA validada
 * (no la leemos de process.env aquí) => coherente con el "cero hardcodeo".
 */
export function createPrismaClient({
  databaseUrl,
  logLevel = ['warn', 'error'],
}: CreatePrismaOptions): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: logLevel,
  });
}

/**
 * Singleton perezoso para scripts / seed / migraciones, donde Prisma lee
 * DATABASE_URL del entorno directamente. NO usar dentro de las apps.
 */
let _default: PrismaClient | undefined;
export function getDefaultPrismaClient(): PrismaClient {
  if (!_default) _default = new PrismaClient();
  return _default;
}
