-- Adds TenantStaffMembership: a real staff identity for a Tenant, backed
-- by the portable Account (phone + OTP) every other "a person signs into
-- something" flow already uses. Closes the Phase 0 gap
-- VerificationCase.reviewerId and OrganizationMembership.addedByApiKeyId's
-- own comments call out — apps/dashboard's staff login moves off raw
-- API-key paste onto this.
--
-- Needs the same open-SELECT-for-bootstrap RLS shape as TenantApiKey/
-- OAuthClient/VerificationSession (see 000_init's own policies): a staff
-- session must be able to discover which tenant(s) an Account belongs to
-- BEFORE app.tenant_id is known — that lookup is how app.tenant_id gets
-- set for a staff request in the first place.

CREATE TABLE "TenantStaffMembership" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
    "accountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    CONSTRAINT "TenantStaffMembership_tenantId_accountId_key" UNIQUE ("tenantId", "accountId")
);
CREATE INDEX "TenantStaffMembership_accountId_idx" ON "TenantStaffMembership"("accountId");

ALTER TABLE "TenantStaffMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantStaffMembership" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_staff_membership_lookup" ON "TenantStaffMembership" FOR SELECT USING (true);
CREATE POLICY "tenant_staff_membership_insert_scoped" ON "TenantStaffMembership" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "tenant_staff_membership_update_scoped" ON "TenantStaffMembership" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "tenant_staff_membership_delete_scoped" ON "TenantStaffMembership" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
