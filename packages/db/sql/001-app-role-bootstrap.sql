-- Ensures the "nid_app" role exists before migrations run, so the
-- GRANT/ALTER DEFAULT PRIVILEGES statements in
-- prisma/migrations/000_init/migration.sql have a role to target. Mounted
-- into the postgres container's docker-entrypoint-initdb.d (see
-- docker-compose.yml) so it runs once, on first container init, before any
-- table exists — the actual RLS policies and grants are created later by
-- `prisma migrate deploy`, which is safe to run against tables that don't
-- exist yet at container-init time.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nid_app') THEN
    CREATE ROLE nid_app LOGIN PASSWORD 'nid_app';
  END IF;
END $$;
