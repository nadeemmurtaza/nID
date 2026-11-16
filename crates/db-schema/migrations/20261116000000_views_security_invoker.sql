-- The snake_case compat views were owned by the superuser and ran with
-- the owner's rights, so reads through them skipped the base tables'
-- row-level security. security_invoker makes them run as the caller.
DO $$
DECLARE v record;
BEGIN
  FOR v IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.viewname);
  END LOOP;
END $$;
