-- nID Phase 0 initial schema + Row-Level Security.
--
-- Hand-written to match prisma/schema.prisma, because this scaffold was built
-- without a reachable Postgres instance to run `prisma migrate dev` against
-- (see README.md). Before this migration is trusted, run
-- `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma`
-- against a real database and reconcile any drift.
--
-- RLS is the enforcement layer for docs/HOUSE-RULES.md rule 2: tenant
-- isolation must hold even if application code forgets a `where: { tenantId }`
-- clause. Every tenant-owned table gets ENABLE + FORCE ROW LEVEL SECURITY, so
-- isolation holds even for the table owner / migration role — the API
-- connects with a role that is NOT exempted from RLS. apps/api's PrismaService
-- issues `SET LOCAL app.tenant_id = '<id>'` at the start of every request
-- transaction; a session with no tenant context set sees zero rows.

-- ── Enums ────────────────────────────────────────────────────────────────

CREATE TYPE "SubjectType" AS ENUM ('PERSON', 'ORGANIZATION');
CREATE TYPE "CaseStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "AttemptStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'NEEDS_REVIEW');
CREATE TYPE "AuditActorType" AS ENUM ('TENANT_STAFF', 'SUBJECT', 'SYSTEM', 'API_KEY');

-- ── Tables ───────────────────────────────────────────────────────────────

CREATE TABLE "Tenant" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "dataResidencyRegion" TEXT NOT NULL DEFAULT 'global',
    "webhookUrl" TEXT,
    "webhookSecretPlaintext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "TenantApiKey" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL UNIQUE,
    "scopes" TEXT[] NOT NULL DEFAULT '{}',
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "TenantApiKey_tenantId_idx" ON "TenantApiKey"("tenantId");

CREATE TABLE "VerificationPolicy" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "methods" TEXT[] NOT NULL,
    "requireAll" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerificationPolicy_tenantId_name_key" UNIQUE ("tenantId", "name")
);
CREATE INDEX "VerificationPolicy_tenantId_idx" ON "VerificationPolicy"("tenantId");

CREATE TABLE "Subject" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
    "externalRef" TEXT,
    "type" "SubjectType" NOT NULL,
    "givenName" TEXT,
    "familyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationalIdNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Subject_tenantId_idx" ON "Subject"("tenantId");
CREATE INDEX "Subject_tenantId_externalRef_idx" ON "Subject"("tenantId", "externalRef");

CREATE TABLE "Organization" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL UNIQUE REFERENCES "Subject"("id") ON DELETE CASCADE,
    "legalName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Organization_tenantId_idx" ON "Organization"("tenantId");

CREATE TABLE "OrganizationBeneficialOwner" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "personSubjectId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    CONSTRAINT "OrganizationBeneficialOwner_organizationId_personSubjectId_key" UNIQUE ("organizationId", "personSubjectId")
);
CREATE INDEX "OrganizationBeneficialOwner_tenantId_idx" ON "OrganizationBeneficialOwner"("tenantId");

CREATE TABLE "VerificationCase" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
    "subjectId" TEXT NOT NULL REFERENCES "Subject"("id") ON DELETE CASCADE,
    "policyId" TEXT NOT NULL REFERENCES "VerificationPolicy"("id") ON DELETE RESTRICT,
    "status" "CaseStatus" NOT NULL DEFAULT 'PENDING',
    "temporalWorkflowId" TEXT,
    "decision" TEXT,
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX "VerificationCase_tenantId_idx" ON "VerificationCase"("tenantId");
CREATE INDEX "VerificationCase_tenantId_status_idx" ON "VerificationCase"("tenantId", "status");

CREATE TABLE "VerificationMethodAttempt" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL REFERENCES "VerificationCase"("id") ON DELETE CASCADE,
    "method" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'PENDING',
    "providerKey" TEXT NOT NULL,
    "resultMeta" JSONB,
    "score" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "completedAt" TIMESTAMP(3)
);
CREATE INDEX "VerificationMethodAttempt_tenantId_idx" ON "VerificationMethodAttempt"("tenantId");
CREATE INDEX "VerificationMethodAttempt_caseId_idx" ON "VerificationMethodAttempt"("caseId");

CREATE TABLE "DocumentAsset" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "methodAttemptId" TEXT NOT NULL REFERENCES "VerificationMethodAttempt"("id") ON DELETE CASCADE,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "DocumentAsset_tenantId_idx" ON "DocumentAsset"("tenantId");
CREATE INDEX "DocumentAsset_methodAttemptId_idx" ON "DocumentAsset"("methodAttemptId");

CREATE TABLE "AuditLogEntry" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "subjectId" TEXT,
    "caseId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "AuditLogEntry_tenantId_idx" ON "AuditLogEntry"("tenantId");
CREATE INDEX "AuditLogEntry_tenantId_subjectId_idx" ON "AuditLogEntry"("tenantId", "subjectId");

-- ── Row-Level Security ──────────────────────────────────────────────────
-- current_setting('app.tenant_id', true) returns NULL (not an error) when
-- unset, so a session that never calls SET LOCAL app.tenant_id sees no rows
-- in any of these tables — fail closed, not fail open.
--
-- Two roles, deliberately: a migration/seed role (DATABASE_URL — the
-- Postgres superuser created by the official image via POSTGRES_USER, which
-- always bypasses RLS, FORCE or not) and a least-privilege runtime role,
-- created below as "nid_app" (APP_DATABASE_URL — apps/api connects as this
-- one, and it has no BYPASSRLS). FORCE ROW LEVEL SECURITY only matters
-- against nid_app; it is what makes isolation hold even for a query that
-- forgets a `where: { tenantId }` clause. Never point apps/api at
-- DATABASE_URL — that role bypasses every policy below.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nid_app') THEN
    CREATE ROLE nid_app LOGIN PASSWORD 'nid_app';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO nid_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nid_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nid_app;

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_self" ON "Tenant"
  USING ("id" = current_setting('app.tenant_id', true))
  WITH CHECK ("id" = current_setting('app.tenant_id', true));

-- TenantApiKey is a deliberate, narrow exception: resolving *which* tenant a
-- request belongs to (apps/api/src/core/auth/api-key.guard.ts) requires
-- looking a key up by hash before app.tenant_id can be set — a chicken/egg
-- problem RLS can't solve by itself. SELECT is left open (a key's hash and
-- prefix aren't reversible or sensitive the way Subject PII is — the same
-- trust boundary Stripe-style key lookups rely on); writes stay tenant-scoped.
ALTER TABLE "TenantApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantApiKey" FORCE ROW LEVEL SECURITY;
CREATE POLICY "api_key_lookup" ON "TenantApiKey" FOR SELECT USING (true);
CREATE POLICY "api_key_insert_scoped" ON "TenantApiKey" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "api_key_update_scoped" ON "TenantApiKey" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "api_key_delete_scoped" ON "TenantApiKey" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'VerificationPolicy', 'Subject', 'Organization',
    'OrganizationBeneficialOwner', 'VerificationCase',
    'VerificationMethodAttempt', 'DocumentAsset', 'AuditLogEntry'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.tenant_id'', true)) WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END $$;
