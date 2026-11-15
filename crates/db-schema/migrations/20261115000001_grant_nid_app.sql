-- The baseline migration (20261115000000) was generated with
-- `pg_dump --no-privileges`, which strips every GRANT. Without this,
-- nid_app (the least-privilege, no-BYPASSRLS role apps/rust-api's
-- request-serving pool actually connects as) has zero permissions on its
-- own schema, and every query 500s with "permission denied".
--
-- Reproduces the grants from packages/db/prisma/migrations/000_init,
-- .../20261031134340_billing_platform, and
-- .../20261114160000_rust_api_compat_views, collapsed into blanket
-- schema-wide grants (Postgres's "ALL TABLES IN SCHEMA" covers views too,
-- so this also covers the rust_api_compat_views, individually re-granted
-- there only because they were created by a different role than the one
-- that set the default privileges).
GRANT USAGE ON SCHEMA public TO nid_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nid_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nid_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nid_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nid_app;
