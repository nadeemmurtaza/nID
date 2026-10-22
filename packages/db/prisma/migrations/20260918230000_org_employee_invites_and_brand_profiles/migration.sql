-- Three additive pieces for "an organization can invite employees who
-- don't have an nID account yet, and manage its own verified brand
-- profile" — while account control stays entirely with the person (see
-- schema.prisma's own comments on each column below for the full
-- reasoning):
--
-- 1. Subject.accountId: the join key from a tenant's own KYC record back
--    to the person's real portable Account, once known.
-- 2. OrganizationMembership gains a real invite lifecycle (status) and an
--    explicit admin flag (isAdmin) — previously every membership row was
--    an immediate, already-confirmed attestation; now a row can exist as
--    an unaccepted invite the person hasn't acted on yet.
-- 3. Profile becomes ownable by either an Account (personal, unchanged) or
--    an Organization (a brand profile) — accountId drops its NOT NULL,
--    organizationId is added, and a CHECK constraint makes "exactly one
--    owner" a database guarantee, not just application discipline.
-- 4. OrganizationMembership and Organization both gain an open-SELECT
--    bootstrap exception (see each one's own comment below) — an
--    account's own cross-tenant "what am I a member of / who invited me"
--    reads need to work before any single tenant context applies, the
--    same shape TenantApiKey/OAuthClient/VerificationSession/
--    TenantStaffMembership already established.

-- 1. Subject.accountId — NOT unique: one Account can have many Subjects
-- (one per tenant that's KYC'd them), the reverse of the accountId <->
-- Subject direction TenantStaffMembership/Profile use elsewhere.
ALTER TABLE "Subject" ADD COLUMN "accountId" TEXT;
CREATE INDEX "Subject_accountId_idx" ON "Subject"("accountId");
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. OrganizationMembership: invite lifecycle + admin flag + a
--    denormalized accountId (see schema.prisma's own comment on why this
--    is copied rather than joined through Subject — Subject carries real
--    PII and must never get an open-SELECT policy; this table carries
--    none, so it safely can).
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED');
ALTER TABLE "OrganizationMembership" ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "OrganizationMembership" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationMembership" ADD COLUMN "accountId" TEXT;
ALTER TABLE "OrganizationMembership" ADD COLUMN "respondedAt" TIMESTAMP(3);
CREATE INDEX "OrganizationMembership_accountId_idx" ON "OrganizationMembership"("accountId");
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An account's own "my pending invites" query (GET
-- /v1/accounts/me/organization-invites) runs before any single tenant
-- context applies — the same bootstrap-lookup shape TenantApiKey/
-- OAuthClient/VerificationSession/TenantStaffMembership already carry
-- (see TenantStaffMembership's migration comment for the general
-- reasoning). INSERT/UPDATE/DELETE stay tenant-scoped; only SELECT opens
-- up, and this table holds no PII, unlike Subject.
DROP POLICY "tenant_isolation" ON "OrganizationMembership";
CREATE POLICY "organization_membership_lookup" ON "OrganizationMembership" FOR SELECT USING (true);
CREATE POLICY "organization_membership_insert_scoped" ON "OrganizationMembership" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "organization_membership_update_scoped" ON "OrganizationMembership" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "organization_membership_delete_scoped" ON "OrganizationMembership" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- An invited account's own "who invited me" read (GET
-- /v1/accounts/me/organization-invites, joining OrganizationMembership to
-- Organization for a display name) needs Organization readable the same
-- cross-tenant, no-context-yet way. Unlike Subject, a legal business name/
-- registration number/country is inherently public-record information
-- (the same category a companies-house registry already publishes) — a
-- materially smaller exposure than Subject's nationalIdNumber/DOB/address,
-- which is exactly why Subject never gets this exception. Writes stay
-- tenant-scoped.
DROP POLICY "tenant_isolation" ON "Organization";
CREATE POLICY "organization_lookup" ON "Organization" FOR SELECT USING (true);
CREATE POLICY "organization_insert_scoped" ON "Organization" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "organization_update_scoped" ON "Organization" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "organization_delete_scoped" ON "Organization" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- 3. Profile: accountId OR organizationId, never neither, never both
ALTER TABLE "Profile" ALTER COLUMN "accountId" DROP NOT NULL;
ALTER TABLE "Profile" ADD COLUMN "organizationId" TEXT;
CREATE UNIQUE INDEX "Profile_organizationId_key" ON "Profile"("organizationId");
CREATE INDEX "Profile_organizationId_idx" ON "Profile"("organizationId");
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_owner_xor_check"
  CHECK (("accountId" IS NOT NULL) <> ("organizationId" IS NOT NULL));
