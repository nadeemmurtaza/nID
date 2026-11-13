-- CreateEnum
CREATE TYPE "BillingServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PlanMode" AS ENUM ('CREDIT_PACK', 'SUBSCRIPTION', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillingAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "PaymentIntentPurpose" AS ENUM ('CREDIT_TOPUP', 'SUBSCRIPTION', 'INVOICE', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('REQUIRES_CHECKOUT', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CreditEntryReason" AS ENUM ('TOPUP', 'USAGE', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerAccountKind" AS ENUM ('PSP_CLEARING', 'PSP_FEES', 'REVENUE', 'TAX_PAYABLE', 'DEFERRED_REVENUE', 'CUSTOMER_CREDITS', 'REFUNDS', 'ADJUSTMENTS');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('PAYMENT', 'CREDIT_TOPUP', 'CREDIT_USAGE', 'FEE', 'REFUND', 'RECOGNITION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('MATCHED', 'DISCREPANCY');

-- CreateEnum
CREATE TYPE "OutboundEventStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActorType" ADD VALUE 'SERVICE';
ALTER TYPE "AuditActorType" ADD VALUE 'PLATFORM_ADMIN';

-- DropForeignKey
ALTER TABLE "OrganizationMembership" DROP CONSTRAINT "OrganizationMembership_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "TenantStaffMembership" DROP CONSTRAINT "TenantStaffMembership_accountId_fkey";

-- DropForeignKey
ALTER TABLE "TenantStaffMembership" DROP CONSTRAINT "TenantStaffMembership_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "VerifiedAttribute" DROP CONSTRAINT "VerifiedAttribute_caseId_fkey";

-- DropForeignKey
ALTER TABLE "VerifiedAttribute" DROP CONSTRAINT "VerifiedAttribute_subjectId_fkey";

-- AlterTable
ALTER TABLE "AuditLogEntry" ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingWebhookSecretPlaintext" TEXT,
ADD COLUMN     "billingWebhookUrl" TEXT;

-- CreateTable
CREATE TABLE "BillingService" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerRepo" TEXT NOT NULL,
    "status" "BillingServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "PlanMode" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "unitAmountMinor" BIGINT NOT NULL,
    "interval" "PlanInterval",
    "creditsIncluded" INTEGER NOT NULL DEFAULT 0,
    "overageUnitAmountMinor" BIGINT,
    "features" JSONB NOT NULL DEFAULT '{}',
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersedesPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingServiceCredential" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingServiceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" "BillingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditBalanceMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "providerTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "subtotalMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL,
    "amountPaidMinor" BIGINT NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmountMinor" BIGINT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "purpose" "PaymentIntentPurpose" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'REQUIRES_CHECKOUT',
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "checkoutUrl" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "methodType" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'PENDING',
    "returnUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "invoiceLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "deltaMinor" BIGINT NOT NULL,
    "reason" "CreditEntryReason" NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "balanceAfterMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT,
    "kind" "LedgerAccountKind" NOT NULL,
    "currency" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amountMinor" BIGINT NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementRecord" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSettlementId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL,
    "netMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "matchedPaymentId" TEXT,
    "matchedTenantId" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DISCREPANCY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" "OutboundEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "OutboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingService_key_key" ON "BillingService"("key");

-- CreateIndex
CREATE INDEX "Plan_serviceId_status_idx" ON "Plan"("serviceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_serviceId_key_version_key" ON "Plan"("serviceId", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BillingServiceCredential_keyHash_key" ON "BillingServiceCredential"("keyHash");

-- CreateIndex
CREATE INDEX "BillingServiceCredential_serviceId_idx" ON "BillingServiceCredential"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_tenantId_key" ON "BillingAccount"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_status_idx" ON "Subscription"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_currentPeriodEnd_idx" ON "Subscription"("tenantId", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_tenantId_serviceId_idx" ON "InvoiceLine"("tenantId", "serviceId");

-- CreateIndex
CREATE INDEX "PaymentIntent_tenantId_status_idx" ON "PaymentIntent"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_tenantId_idempotencyKey_key" ON "PaymentIntent"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_provider_providerRef_key" ON "PaymentIntent"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "Payment_tenantId_paidAt_idx" ON "Payment"("tenantId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerTransactionId_key" ON "Payment"("provider", "providerTransactionId");

-- CreateIndex
CREATE INDEX "Refund_tenantId_status_idx" ON "Refund"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_paymentIntentId_key" ON "CheckoutSession"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_tenantId_tokenHash_key" ON "CheckoutSession"("tenantId", "tokenHash");

-- CreateIndex
CREATE INDEX "UsageRecord_tenantId_serviceId_occurredAt_idx" ON "UsageRecord"("tenantId", "serviceId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_serviceId_idempotencyKey_key" ON "UsageRecord"("serviceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_tenantId_createdAt_idx" ON "CreditLedgerEntry"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedgerEntry_tenantId_refType_refId_reason_key" ON "CreditLedgerEntry"("tenantId", "refType", "refId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_scopeKey_key" ON "LedgerAccount"("scopeKey");

-- CreateIndex
CREATE INDEX "LedgerAccount_tenantId_kind_idx" ON "LedgerAccount"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "LedgerTransaction_tenantId_occurredAt_idx" ON "LedgerTransaction"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "LedgerTransaction_refType_refId_idx" ON "LedgerTransaction"("refType", "refId");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_idx" ON "LedgerEntry"("accountId");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_status_idx" ON "WebhookEvent"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "SettlementRecord_status_idx" ON "SettlementRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementRecord_provider_providerSettlementId_key" ON "SettlementRecord"("provider", "providerSettlementId");

-- CreateIndex
CREATE INDEX "OutboundEvent_tenantId_status_idx" ON "OutboundEvent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "OutboundEvent_status_nextAttemptAt_idx" ON "OutboundEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AuditLogEntry_tenantId_entityType_entityId_idx" ON "AuditLogEntry"("tenantId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "VerifiedAttribute" ADD CONSTRAINT "VerifiedAttribute_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedAttribute" ADD CONSTRAINT "VerifiedAttribute_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VerificationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantStaffMembership" ADD CONSTRAINT "TenantStaffMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantStaffMembership" ADD CONSTRAINT "TenantStaffMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BillingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingServiceCredential" ADD CONSTRAINT "BillingServiceCredential_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BillingService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BillingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BillingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BillingService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEvent" ADD CONSTRAINT "OutboundEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundEvent" ADD CONSTRAINT "OutboundEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BillingService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Billing sequence + Row-Level Security (hand-written, house rule 2) ───

-- Invoice numbers come from a Postgres sequence rather than a count(*)+1,
-- which two concurrent issues would both win. Global, not per-tenant: the
-- public number is NID-<year>-<seq> and must be unique across tenants.
CREATE SEQUENCE "billing_invoice_number_seq" START 1 INCREMENT 1;

-- 000_init's ALTER DEFAULT PRIVILEGES grant to nid_app covers ON TABLES only,
-- so this sequence would otherwise stay invisible to the least-privilege
-- runtime role and Task 5's invoice-number nextval would fail with 42501.
GRANT USAGE, SELECT ON SEQUENCE "billing_invoice_number_seq" TO nid_app;

-- ── RLS: ordinary tenant-owned tables ───────────────────────────────────
-- Same shape as 000_init's loop. FORCE matters because nid_app is not
-- exempt; a query that forgets its tenant context sees zero rows, not
-- someone else's.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'BillingAccount', 'Subscription', 'Invoice', 'InvoiceLine', 'Payment',
    'Refund', 'UsageRecord', 'CreditLedgerEntry', 'LedgerAccount',
    'LedgerTransaction', 'LedgerEntry', 'OutboundEvent'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.tenant_id'', true)) WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END $$;

-- ── RLS: bootstrap-lookup tables (open SELECT, scoped writes) ───────────
-- Three lookups must happen before app.tenant_id is knowable, exactly like
-- TenantApiKey / VerificationSession / OAuthClient in 000_init:
--   PaymentIntent  — a provider webhook names a providerRef, not a tenant.
--   CheckoutSession — the hosted page presents only a capability token.
--   WebhookEvent   — dedupe on (provider, providerEventId) before any tenant
--                    context exists, so a replay can be recognised as one.
-- SELECT is open; everything else is scoped, so reading is possible but
-- writing another tenant's row still fails closed.

ALTER TABLE "PaymentIntent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentIntent" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payment_intent_lookup" ON "PaymentIntent" FOR SELECT USING (true);
CREATE POLICY "payment_intent_insert_scoped" ON "PaymentIntent" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "payment_intent_update_scoped" ON "PaymentIntent" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "payment_intent_delete_scoped" ON "PaymentIntent" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "CheckoutSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CheckoutSession" FORCE ROW LEVEL SECURITY;
CREATE POLICY "checkout_session_lookup" ON "CheckoutSession" FOR SELECT USING (true);
CREATE POLICY "checkout_session_insert_scoped" ON "CheckoutSession" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "checkout_session_update_scoped" ON "CheckoutSession" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "checkout_session_delete_scoped" ON "CheckoutSession" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY "webhook_event_lookup" ON "WebhookEvent" FOR SELECT USING (true);
CREATE POLICY "webhook_event_insert_scoped" ON "WebhookEvent" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "webhook_event_update_scoped" ON "WebhookEvent" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "webhook_event_delete_scoped" ON "WebhookEvent" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ── RLS: global catalog (read-any, admin-write) ─────────────────────────
-- A permissive SELECT policy plus a restrictive FOR ALL policy OR together,
-- so reads stay open and every write needs app.billing_admin — the context
-- only withBillingAdminContext sets, and only the admin path may use.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['BillingService', 'Plan', 'BillingServiceCredential'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY catalog_read ON %I FOR SELECT USING (true)', t);
    EXECUTE format(
      'CREATE POLICY catalog_write ON %I FOR ALL USING (current_setting(''app.billing_admin'', true) = ''on'') WITH CHECK (current_setting(''app.billing_admin'', true) = ''on'')',
      t
    );
  END LOOP;
END $$;

-- Settlement files describe the single merchant account, not a tenant, so
-- there is no open read: nothing at all is visible without app.billing_admin.
ALTER TABLE "SettlementRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SettlementRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY "settlement_admin_only" ON "SettlementRecord" FOR ALL
  USING (current_setting('app.billing_admin', true) = 'on')
  WITH CHECK (current_setting('app.billing_admin', true) = 'on');
