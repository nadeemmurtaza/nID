-- CreateEnum
CREATE TYPE "LoginRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "AuditLogEntry" DROP CONSTRAINT "AuditLogEntry_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentAsset" DROP CONSTRAINT "DocumentAsset_methodAttemptId_fkey";

-- DropForeignKey
ALTER TABLE "Organization" DROP CONSTRAINT "Organization_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationBeneficialOwner" DROP CONSTRAINT "OrganizationBeneficialOwner_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantApiKey" DROP CONSTRAINT "TenantApiKey_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationCase" DROP CONSTRAINT "VerificationCase_policyId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationCase" DROP CONSTRAINT "VerificationCase_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationCase" DROP CONSTRAINT "VerificationCase_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationMethodAttempt" DROP CONSTRAINT "VerificationMethodAttempt_caseId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationPolicy" DROP CONSTRAINT "VerificationPolicy_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationSession" DROP CONSTRAINT "VerificationSession_caseId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationSession" DROP CONSTRAINT "VerificationSession_tenantId_fkey";

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountOtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountOtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthLoginRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT,
    "status" "LoginRequestStatus" NOT NULL DEFAULT 'PENDING',
    "accountId" TEXT,
    "pollTokenHash" TEXT NOT NULL,
    "codeHash" TEXT,
    "codeConsumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthLoginRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_phone_key" ON "Account"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE INDEX "AccountOtpCode_phone_idx" ON "AccountOtpCode"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "AccountSession_tokenHash_key" ON "AccountSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountSession_accountId_idx" ON "AccountSession"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "OAuthClient_tenantId_idx" ON "OAuthClient"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthLoginRequest_pollTokenHash_key" ON "OAuthLoginRequest"("pollTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthLoginRequest_codeHash_key" ON "OAuthLoginRequest"("codeHash");

-- CreateIndex
CREATE INDEX "OAuthLoginRequest_tenantId_idx" ON "OAuthLoginRequest"("tenantId");

-- CreateIndex
CREATE INDEX "OAuthLoginRequest_clientId_idx" ON "OAuthLoginRequest"("clientId");

-- AddForeignKey
ALTER TABLE "TenantApiKey" ADD CONSTRAINT "TenantApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationPolicy" ADD CONSTRAINT "VerificationPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationBeneficialOwner" ADD CONSTRAINT "OrganizationBeneficialOwner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCase" ADD CONSTRAINT "VerificationCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCase" ADD CONSTRAINT "VerificationCase_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCase" ADD CONSTRAINT "VerificationCase_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "VerificationPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationSession" ADD CONSTRAINT "VerificationSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationSession" ADD CONSTRAINT "VerificationSession_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VerificationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationMethodAttempt" ADD CONSTRAINT "VerificationMethodAttempt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VerificationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAsset" ADD CONSTRAINT "DocumentAsset_methodAttemptId_fkey" FOREIGN KEY ("methodAttemptId") REFERENCES "VerificationMethodAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSession" ADD CONSTRAINT "AccountSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthLoginRequest" ADD CONSTRAINT "OAuthLoginRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthLoginRequest" ADD CONSTRAINT "OAuthLoginRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Row-Level Security ──────────────────────────────────────────────────
--
-- Account / AccountOtpCode / AccountSession deliberately get NO tenant RLS
-- policy — they carry no tenantId, the multi-tenant isolation this schema
-- builds doesn't apply to them, and access is gated by the API layer
-- requiring a valid OTP or session token instead. See schema.prisma's
-- comment on this section for the full reasoning.
--
-- OAuthClient and OAuthLoginRequest ARE tenant-owned and get the same
-- two-part treatment as TenantApiKey (000_init) and VerificationSession
-- (001_verification_sessions): an open SELECT for the same reason —
-- resolving which tenant a request belongs to, from a clientId or
-- pollTokenHash the caller presents, has to happen before app.tenant_id can
-- be set. Writes stay tenant-scoped.

ALTER TABLE "OAuthClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthClient" FORCE ROW LEVEL SECURITY;
CREATE POLICY "oauth_client_lookup" ON "OAuthClient" FOR SELECT USING (true);
CREATE POLICY "oauth_client_insert_scoped" ON "OAuthClient" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "oauth_client_update_scoped" ON "OAuthClient" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "oauth_client_delete_scoped" ON "OAuthClient" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "OAuthLoginRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthLoginRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY "login_request_lookup" ON "OAuthLoginRequest" FOR SELECT USING (true);
CREATE POLICY "login_request_insert_scoped" ON "OAuthLoginRequest" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "login_request_update_scoped" ON "OAuthLoginRequest" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "login_request_delete_scoped" ON "OAuthLoginRequest" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
