-- Row-level security now applies to reads through the snake_case views
-- (20261116000000), so the two legitimate cross-tenant access patterns need
-- explicit, narrow policies instead of relying on the old accidental bypass.
-- Both are asserted by the application per transaction with
-- set_config(..., true), exactly like app.tenant_id.

-- 1. Platform admin (shared-secret guarded routes): manage tenants and read
--    the per-tenant counts shown on the platform overview.
CREATE POLICY tenant_platform_admin ON "Tenant" FOR ALL
  USING (current_setting('app.platform_admin', true) = 'true')
  WITH CHECK (current_setting('app.platform_admin', true) = 'true');
CREATE POLICY subject_platform_count ON "Subject" FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'true');
CREATE POLICY verification_case_platform_count ON "VerificationCase" FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'true');

-- 2. Account-scoped access: a signed-in person sees the tenants they are
--    staff on, and their own subject records and the cases about them,
--    across tenants.
CREATE POLICY tenant_account_staff ON "Tenant" FOR SELECT
  USING (id IN (
    SELECT "tenantId" FROM "TenantStaffMembership"
    WHERE "accountId" = current_setting('app.account_id', true)));
CREATE POLICY subject_own_account ON "Subject" FOR ALL
  USING ("accountId" = current_setting('app.account_id', true))
  WITH CHECK ("accountId" = current_setting('app.account_id', true));
CREATE POLICY verification_case_own_account ON "VerificationCase" FOR ALL
  USING ("subjectId" IN (
    SELECT id FROM "Subject" WHERE "accountId" = current_setting('app.account_id', true)))
  WITH CHECK ("subjectId" IN (
    SELECT id FROM "Subject" WHERE "accountId" = current_setting('app.account_id', true)));
CREATE POLICY verification_method_attempt_own_account ON "VerificationMethodAttempt" FOR ALL
  USING ("caseId" IN (
    SELECT vc.id FROM "VerificationCase" vc
    JOIN "Subject" s ON s.id = vc."subjectId"
    WHERE s."accountId" = current_setting('app.account_id', true)))
  WITH CHECK ("caseId" IN (
    SELECT vc.id FROM "VerificationCase" vc
    JOIN "Subject" s ON s.id = vc."subjectId"
    WHERE s."accountId" = current_setting('app.account_id', true)));
