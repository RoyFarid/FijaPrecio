/**
 * @fijaprecio/db — punto único de acceso a la capa de datos.
 * Re-exporta el cliente Prisma generado (tipos, enums, namespace Prisma)
 * y la factory tipada.
 */
export * from '@prisma/client';
export { createPrismaClient, getDefaultPrismaClient, type CreatePrismaOptions } from './client.js';
