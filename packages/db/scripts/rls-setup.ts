/**
 * Da LOGIN + contraseña al rol `fijaprecio_app` (creado NOLOGIN por la migración
 * `rls_app_role`). Solo para DESARROLLO LOCAL.
 *
 *   pnpm --filter @fijaprecio/db rls:setup           # contraseña 'fijaprecio_app'
 *   APP_DB_PASSWORD=xxx pnpm --filter @fijaprecio/db rls:setup
 *
 * En Railway/producción: `ALTER ROLE fijaprecio_app WITH LOGIN PASSWORD '<secreto>'`
 * a mano con las credenciales del owner.
 */
import { getDefaultPrismaClient } from '../src/index.js';

async function main(): Promise<void> {
  const password = process.env.APP_DB_PASSWORD ?? 'fijaprecio_app';
  if (!/^[A-Za-z0-9_-]{6,}$/.test(password)) {
    throw new Error('APP_DB_PASSWORD inválida (usa [A-Za-z0-9_-], mín. 6)');
  }

  const prisma = getDefaultPrismaClient();
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fijaprecio_app') AS exists`;
    if (!rows[0]?.exists) {
      throw new Error('El rol fijaprecio_app no existe. Aplica la migración rls_app_role primero.');
    }
    await prisma.$executeRawUnsafe(
      `ALTER ROLE fijaprecio_app WITH LOGIN PASSWORD '${password}'`,
    );
    console.log(`OK - fijaprecio_app: LOGIN habilitado (password "${password}")`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
