-- Adds OrganizationMembership: the record of an org admin confirming a
-- person Subject is a member (employee) of an Organization — the real
-- attestation act org_membership's provider checks for before letting that
-- person inherit a badge from the Organization's own verified status. A
-- normal tenant-owned table, same standard RLS shape as every other one
-- (docs/HOUSE-RULES.md rule 2) — no bootstrap-lookup exception needed here,
-- unlike TenantApiKey/VerificationSession, since nothing needs to read this
-- table before app.tenant_id is known.

CREATE TABLE "OrganizationMembership" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "personSubjectId" TEXT NOT NULL,
    "role" TEXT,
    "addedByApiKeyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    CONSTRAINT "OrganizationMembership_organizationId_personSubjectId_key" UNIQUE ("organizationId", "personSubjectId")
);
CREATE INDEX "OrganizationMembership_tenantId_idx" ON "OrganizationMembership"("tenantId");
CREATE INDEX "OrganizationMembership_personSubjectId_idx" ON "OrganizationMembership"("personSubjectId");

ALTER TABLE "OrganizationMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationMembership" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "OrganizationMembership"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
