-- Adds VerificationSession: a subject-facing credential for one case, used
-- by apps/verify-ui instead of the tenant's API key (which a subject's
-- browser must never hold). RLS mirrors TenantApiKey's bootstrap shape
-- exactly — see 000_init/migration.sql's comment on api_key_lookup for why
-- an open SELECT is the correct, narrow exception here too.

CREATE TABLE "VerificationSession" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
    "caseId" TEXT NOT NULL REFERENCES "VerificationCase"("id") ON DELETE CASCADE,
    "tokenHash" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "VerificationSession_tenantId_idx" ON "VerificationSession"("tenantId");
CREATE INDEX "VerificationSession_caseId_idx" ON "VerificationSession"("caseId");

ALTER TABLE "VerificationSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationSession" FORCE ROW LEVEL SECURITY;

CREATE POLICY "session_lookup" ON "VerificationSession" FOR SELECT USING (true);
CREATE POLICY "session_insert_scoped" ON "VerificationSession" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "session_update_scoped" ON "VerificationSession" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "session_delete_scoped" ON "VerificationSession" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
