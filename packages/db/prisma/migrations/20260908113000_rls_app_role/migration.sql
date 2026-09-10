-- =============================================================================
-- Rol de aplicación NOBYPASSRLS + grants
--
-- El rol dueño (owner / superusuario en local y en Railway) hace BYPASS de RLS
-- aunque las tablas estén FORCE ROW LEVEL SECURITY. Para que las políticas de
-- `20260907235300_manual_*` filtren de verdad, la app debe conectarse con un rol
-- **no-superusuario y NOBYPASSRLS**.
--
-- Este rol se crea NOLOGIN. El paso de OPS (fuera de la migración, porque la
-- contraseña es un secreto) es:
--     ALTER ROLE fijaprecio_app WITH LOGIN PASSWORD '<secreto>';
-- En local:  ALTER ROLE fijaprecio_app WITH LOGIN PASSWORD 'fijaprecio_app';
--
-- Luego: APP_DATABASE_URL apuntando a ese rol + DB_RLS_ENFORCED=true.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fijaprecio_app') THEN
    CREATE ROLE fijaprecio_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  ELSE
    ALTER ROLE fijaprecio_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO fijaprecio_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fijaprecio_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fijaprecio_app;

-- Tablas / secuencias que creen futuras migraciones (las corre el owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fijaprecio_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO fijaprecio_app;

-- -----------------------------------------------------------------------------
-- PaymentEvent tiene organizationId pero quedó fuera de la lista de RLS de la
-- migración manual (son webhooks de la pasarela). Le ponemos la misma política
-- por consistencia — el rol de app no debería ver eventos de otra org.
-- -----------------------------------------------------------------------------
ALTER TABLE "PaymentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PaymentEvent";
CREATE POLICY tenant_isolation ON "PaymentEvent"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "organizationId" IS NULL
    OR "organizationId" = NULLIF(current_setting('app.current_org', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "organizationId" IS NULL
    OR "organizationId" = NULLIF(current_setting('app.current_org', true), '')::uuid
  );
