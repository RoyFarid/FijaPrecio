/**
 * Verifica que RLS filtra de verdad usando el rol `fijaprecio_app`.
 *
 *   pnpm --filter @fijaprecio/db rls:check
 *
 * Prueba sobre "Product" (tabla de tenant):
 *   1. sin `app.current_org` ni bypass   → 0 filas visibles
 *   2. `app.bypass_rls = on`             → todas
 *   3. `app.current_org = <una org real>`→ solo las de esa org
 */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const url = process.env.APP_DATABASE_URL;
  if (!url) throw new Error('Falta APP_DATABASE_URL (el rol fijaprecio_app).');

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  const countProducts = (setup: string): Promise<number> =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(setup);
      const rows = await tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM "Product"`;
      return Number(rows[0]?.n ?? 0);
    });

  try {
    const blocked = await countProducts(`SELECT set_config('app.current_org', '', true)`);
    const all = await countProducts(`SELECT set_config('app.bypass_rls', 'on', true)`);

    const orgRows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
      return tx.$queryRaw<Array<{ id: string; n: bigint }>>`
        SELECT "organizationId" AS id, count(*) AS n
        FROM "Product" GROUP BY "organizationId" ORDER BY n DESC LIMIT 1`;
    });
    const org = orgRows[0];
    const scoped = org
      ? await countProducts(`SELECT set_config('app.current_org', '${org.id}', true)`)
      : 0;

    console.log(`sin contexto:      ${blocked} productos visibles`);
    console.log(`bypass_rls = on:   ${all} productos`);
    if (org) console.log(`org ${org.id}: ${scoped} propios (de ${Number(org.n)})`);

    if (all > 0 && blocked === all) {
      console.error('\nFAIL - RLS NO filtra (¿el rol tiene BYPASSRLS o es superusuario?)');
      process.exit(1);
    }
    console.log('\nOK - RLS filtra correctamente');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
