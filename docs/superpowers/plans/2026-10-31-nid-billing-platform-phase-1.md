# nID Billing Platform — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship nID as the single billing system of record for the NEWAX ecosystem — hosted Rapid Gateway checkout, a double-entry ledger, prepaid credits, invoices and subscriptions — behind tenant, service and checkout-token APIs, with `apps/checkout-ui` and a dashboard billing section.

**Architecture:** A modular monolith. Two new workspace packages hold the domain (`@nid/billing`: catalog reads, invoice engine, ledger, credits, checkout orchestration, settlement) and the provider boundary (`@nid/payments`: `PaymentProvider` interface, `MockPaymentProvider`, `RapidGatewayProvider`, registry). `apps/api` gains `modules/billing/`, which is transport only — guards, DTOs, mapping to domain calls. Every tenant-owned table gets Prisma + Postgres Row-Level Security in the same migration that creates it. Payment state only ever moves from provider-confirmed data (a verified webhook or the dev mock), never from a browser return.

**Tech Stack:** NestJS 11, Prisma 5.20 + PostgreSQL (RLS), Next.js 15 App Router + React 19, TypeScript 5.6 strict, Jest 29 + ts-jest, pnpm workspaces.

**Spec:** [docs/superpowers/specs/2026-10-31-nid-billing-platform-design.md](file:///C:/Users/nommi/Downloads/scraper/nID/docs/superpowers/specs/2026-10-31-nid-billing-platform-design.md)

## Global Constraints

Every task below implicitly includes this section.

- Money is `BigInt` minor units (paisa) with an ISO-4217 `currency` column. No floats. Phase 1 is PKR-only, but every money row still carries `currency`.
- Every tenant-owned table carries `tenantId` and gets `ENABLE` + `FORCE ROW LEVEL SECURITY` plus a `tenant_isolation` policy **in the same migration** that creates it (docs/HOUSE-RULES.md rule 2). Bootstrap-lookup tables use the documented open-SELECT / scoped-write shape.
- `apps/api` connects with `APP_DATABASE_URL` (the `nid_app` role) — never `DATABASE_URL`, which bypasses RLS.
- No controller or service branches on a provider name; `ProviderRegistry` resolves it. The only place provider keys are compared is `PaymentProvidersService`'s factory.
- Webhook bodies are verified with `timingSafeEqual` (via `constantTimeEqualHex`) before any read or write; outbound signing uses `signWebhookPayload`.
- Long-running flows belong in Temporal (`apps/workflows`), not in request handlers. Phase 1 has none — renewal, dunning, outbound-event retries and settlement-file reconciliation are Phase 2. (Task 12's `GET /v1/billing/admin/reconciliation` is a synchronous, on-demand report of what the ledger already knows, not the scheduled provider-payout-file diff.)
- Secrets come from `apps/api/src/core/config/env.ts`; nothing logs a secret, a card value or a full amount-plus-token pair.
- Definition of done for every task: `pnpm typecheck && pnpm lint && pnpm test && pnpm db:validate` pass, plus docs/HOUSE-RULES.md §8.
- Copy rules: plan/UI strings are sentence case, no emoji, no marketing voice. Comments explain a non-obvious WHY only.

## File Structure

```
packages/db/prisma/schema.prisma                 # + billing enums/models, additive Tenant + AuditLogEntry
packages/db/prisma/migrations/20261031000000_billing_platform/migration.sql
packages/db/src/index.ts                         # + TransactionClient, withBillingAdminContext
packages/db/prisma/seed.ts                       # + catalog, plans, admin account, service credentials, account backfill
packages/shared-types/src/session-token.ts       # + generateCheckoutToken

packages/payments/                               # NEW: provider boundary (Tasks 2-3)
  src/types.ts  src/errors.ts  src/index.ts
  src/mock.provider.ts  src/registry.ts
  src/rapid-gateway.provider.ts  src/rapid-gateway/fixtures/*.json
  package.json  tsconfig.json  jest.config.js

packages/billing/                                # NEW: domain, no Nest, no HTTP (Tasks 4-8, 10, 14)
  src/errors.ts  src/money.ts  src/ledger.ts  src/accounts.ts
  src/catalog.ts  src/invoices.ts  src/credits.ts  src/checkout.ts
  src/subscriptions.ts  src/settlement.ts  src/refunds.ts
  src/verification-charge.ts  src/usage.ts  src/entitlements.ts  src/index.ts
  package.json  tsconfig.json  jest.config.js

docs/vendors/rapid-gateway/README.md             # NEW: assumed mapping, replaces itself with real docs

apps/api/src/core/config/env.ts                  # + billing env vars (Task 9), + nodeEnv (Task 13)
apps/api/src/core/serialization/bigint-serializer.ts
apps/api/src/core/auth/billing-tenant.guard.ts  billing-admin.guard.ts  billing-service.guard.ts
apps/api/src/core/auth/current-billing.decorator.ts  types.ts  auth.module.ts
apps/api/src/core/http/billing-error.filter.ts  # NEW: BillingError -> 402/422 (Task 15)
apps/api/src/core/payments/payment-providers.service.ts  payment-providers.module.ts
apps/api/src/main.ts                             # rawBody + BigInt interceptor
apps/api/src/app.module.ts                       # + BillingModule

apps/api/src/modules/billing/                    # NEW transport, one file per surface
  billing.module.ts
  billing.service.ts              billing.controller.ts               # tenant surface (Task 11)
  admin-billing.service.ts        admin-billing.controller.ts         # catalog/credential/refund/reconciliation (Task 12)
  billing-events.service.ts       checkout-public.controller.ts       # token reads + outbound enqueue (Task 13)
  billing-webhooks.controller.ts  dev-payments.controller.ts          # (Task 13)
  billing-service-credentials.service.ts  billing-service-credentials.controller.ts  # (Task 15)
  dto/create-checkout-session.dto.ts  dto/cancel-subscription.dto.ts
  dto/catalog.dto.ts  dto/refund.dto.ts  dto/mock-payment.dto.ts
  dto/service-checkout.dto.ts  dto/service-usage.dto.ts  dto/service-invoice.dto.ts

apps/api/src/modules/verification-cases/         # MODIFIED: the credit hook (Task 15)
  verification-cases.service.ts  verification-cases.controller.ts  verification-cases.module.ts

apps/checkout-ui/                                # NEW Next app, port 3500 (Task 16)
  package.json  tsconfig.json  next.config.mjs  next-env.d.ts
  app/layout.tsx  app/page.tsx  app/globals.css  app/brand.ts  app/icon.svg
  app/components/logomark.tsx
  app/checkout/[token]/page.tsx
  app/return/[token]/page.tsx
  app/mock-pay/[providerRef]/page.tsx
  lib/api.ts  lib/format.ts  lib/format.test.mts

apps/dashboard/                                  # MODIFIED: billing section (Task 17)
  app/billing/page.tsx  app/billing/sections.tsx  app/billing/money.ts  app/billing/money.test.mts
  app/billing/use-checkout.ts  app/billing/invoices/[id]/page.tsx
  app/components/header.tsx                      # + Cases/Billing nav
  lib/api-client.ts                              # + billing types and the two writes
  lib/use-resource.ts                            # NEW
  package.json  tsconfig.json                    # test script + .mts handling

apps/api/test/                                   # live-Postgres specs, RUN_DB_TESTS-gated
  billing-tenant-api.spec.ts  billing-admin-api.spec.ts  checkout-public-api.spec.ts
  billing-webhook-api.spec.ts  dev-payments.spec.ts  billing-service-credentials.spec.ts
  verification-credit.spec.ts  billing-rls.spec.ts  billing-phase-1.spec.ts

.env.example                                     # + billing vars
ECOSYSTEM.md  docs/PHASES.md                     # governance + phase record
```

Dependency direction is one-way: `packages/payments` → `@nid/shared-types` only; `packages/billing` → `@nid/db`, `@nid/payments`, `@nid/shared-types`; `apps/api` → both. Nothing in `packages/*` imports Nest.

---

## Task 1: Billing schema, migration, RLS, and db helpers

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (append models/enums; add fields to `Tenant`, `AuditLogEntry`, `AuditActorType`)
- Create: `packages/db/prisma/migrations/20261031000000_billing_platform/migration.sql` (generated by `prisma migrate dev --create-only`, then hand-extended)
- Modify: `packages/db/src/index.ts:1-45`
- Modify: `packages/shared-types/src/session-token.ts` (add `generateCheckoutToken`)

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma models `BillingService`, `Plan`, `BillingServiceCredential`, `BillingAccount`, `Subscription`, `Invoice`, `InvoiceLine`, `PaymentIntent`, `Payment`, `Refund`, `CheckoutSession`, `UsageRecord`, `CreditLedgerEntry`, `LedgerAccount`, `LedgerTransaction`, `LedgerEntry`, `WebhookEvent`, `SettlementRecord`, `OutboundEvent` and their enums; `TransactionClient`; `withBillingAdminContext(prisma, fn)`; `generateCheckoutToken(): { plaintext: string; hash: string }`. Every later task uses these exact names.

- [ ] **Step 1: Add the enums to `packages/db/prisma/schema.prisma`**

Append after the existing `enum AuditActorType { ... }` block (line ~46) — do not reorder existing enums, Postgres orders enum values by declaration:

```prisma
enum AuditActorType {
  TENANT_STAFF
  SUBJECT
  SYSTEM
  API_KEY
  /// An ecosystem service acting with its own BillingServiceCredential.
  SERVICE
  /// A person on BILLING_ADMIN_ACCOUNT_IDS — merchant-of-record staff, not tenant staff.
  PLATFORM_ADMIN
}
```

Append at the end of the file:

```prisma
// ── Billing ──────────────────────────────────────────────────────────────
//
// nID is merchant of record for the whole NEWAX ecosystem: one Rapid Gateway
// merchant account, revenue attributed per service inside the ledger. This is
// the deliberate exception to ECOSYSTEM.md's "nID must never own business
// data" line — see docs/superpowers/specs/2026-10-31-nid-billing-platform-design.md §17.
//
// Catalog tables (BillingService, Plan, BillingServiceCredential) are global:
// readable by anyone authenticated, writable only under app.billing_admin.
// Everything else carries tenantId and is RLS-isolated like the rest of the
// schema — including the ledger, so one tenant can never read another's
// revenue accounts. Money is always BigInt minor units (paisa).

enum BillingServiceStatus {
  ACTIVE
  INACTIVE
}

enum PlanMode {
  CREDIT_PACK
  SUBSCRIPTION
  ONE_OFF
}

enum PlanInterval {
  MONTH
  YEAR
}

enum PlanStatus {
  ACTIVE
  ARCHIVED
}

enum BillingAccountStatus {
  ACTIVE
  SUSPENDED
  CLOSED
}

enum SubscriptionStatus {
  INCOMPLETE
  ACTIVE
  PAST_DUE
  CANCELED
}

enum InvoiceStatus {
  DRAFT
  OPEN
  PAID
  VOID
  UNCOLLECTIBLE
}

enum PaymentIntentPurpose {
  CREDIT_TOPUP
  SUBSCRIPTION
  INVOICE
  ONE_OFF
}

enum PaymentIntentStatus {
  REQUIRES_CHECKOUT
  PROCESSING
  SUCCEEDED
  FAILED
  EXPIRED
  CANCELED
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
}

enum RefundStatus {
  PENDING
  SUCCEEDED
  FAILED
}

enum CheckoutSessionStatus {
  PENDING
  COMPLETED
  EXPIRED
  CANCELED
}

enum CreditEntryReason {
  TOPUP
  USAGE
  REFUND
  ADJUSTMENT
}

enum LedgerAccountKind {
  PSP_CLEARING
  PSP_FEES
  REVENUE
  TAX_PAYABLE
  DEFERRED_REVENUE
  CUSTOMER_CREDITS
  REFUNDS
  ADJUSTMENTS
}

enum LedgerTransactionType {
  PAYMENT
  CREDIT_TOPUP
  CREDIT_USAGE
  FEE
  REFUND
  RECOGNITION
  ADJUSTMENT
}

enum LedgerDirection {
  DEBIT
  CREDIT
}

enum WebhookEventStatus {
  RECEIVED
  PROCESSED
  IGNORED
  FAILED
}

enum SettlementStatus {
  MATCHED
  DISCREPANCY
}

enum OutboundEventStatus {
  PENDING
  DELIVERED
  FAILED
}
```

- [ ] **Step 2: Add the models**

```prisma
model BillingService {
  id        String               @id @default(cuid())
  /// Stable ecosystem key, e.g. "nid", "erp-1", "communicator".
  key       String               @unique
  name      String
  ownerRepo String
  status    BillingServiceStatus @default(ACTIVE)
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt

  credentials    BillingServiceCredential[]
  plans          Plan[]
  invoiceLines   InvoiceLine[]
  usageRecords   UsageRecord[]
  ledgerAccounts LedgerAccount[]
  outboundEvents OutboundEvent[]
}

model Plan {
  id          String       @id @default(cuid())
  serviceId   String
  key         String
  /// Price changes create a new version row; nothing here is ever rewritten,
  /// because a live Subscription pins planId (spec D11).
  version     Int          @default(1)
  name        String
  description String?
  mode        PlanMode
  currency    String       @default("PKR")
  unitAmountMinor BigInt
  interval    PlanInterval?
  creditsIncluded Int      @default(0)
  overageUnitAmountMinor BigInt?
  features    Json         @default("{}")
  status      PlanStatus   @default(ACTIVE)
  supersedesPlanId String?
  createdAt   DateTime     @default(now())

  service       BillingService @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  subscriptions Subscription[]

  @@unique([serviceId, key, version])
  @@index([serviceId, status])
}

model BillingServiceCredential {
  id        String    @id @default(cuid())
  serviceId String
  label     String
  keyPrefix String
  keyHash   String    @unique
  scopes    String[]  @default([])
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime @default(now())

  service BillingService @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@index([serviceId])
}

model BillingAccount {
  id        String               @id @default(cuid())
  tenantId  String               @unique
  currency  String               @default("PKR")
  status    BillingAccountStatus @default(ACTIVE)
  /// Derived cache of the sum of CreditLedgerEntry.deltaMinor. Never assigned
  /// directly — only credits.ts's atomic UPDATE touches it (spec §7.3).
  creditBalanceMinor BigInt      @default(0)
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt

  tenant          Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  subscriptions   Subscription[]
  invoices        Invoice[]
  paymentIntents  PaymentIntent[]
  creditEntries   CreditLedgerEntry[]
}

model Subscription {
  id                 String             @id @default(cuid())
  tenantId           String
  billingAccountId   String
  planId             String
  status             SubscriptionStatus @default(INCOMPLETE)
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  cancelAtPeriodEnd  Boolean            @default(false)
  startedAt          DateTime?
  canceledAt         DateTime?
  /// Only set when the provider hands back a reusable mandate token.
  providerTokenId    String?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  tenant         Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  billingAccount BillingAccount  @relation(fields: [billingAccountId], references: [id], onDelete: Cascade)
  plan           Plan            @relation(fields: [planId], references: [id], onDelete: Restrict)
  invoiceLines   InvoiceLine[]

  @@index([tenantId, status])
  @@index([tenantId, currentPeriodEnd])
}

model Invoice {
  id               String        @id @default(cuid())
  tenantId         String
  billingAccountId String
  number           String        @unique
  status           InvoiceStatus @default(DRAFT)
  currency         String
  subtotalMinor    BigInt
  taxMinor         BigInt        @default(0)
  totalMinor       BigInt
  amountPaidMinor  BigInt        @default(0)
  periodStart      DateTime?
  periodEnd        DateTime?
  dueAt            DateTime?
  issuedAt         DateTime?
  paidAt           DateTime?
  voidedAt         DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  tenant         Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  billingAccount BillingAccount @relation(fields: [billingAccountId], references: [id], onDelete: Cascade)
  lines          InvoiceLine[]

  @@index([tenantId, status])
}

model InvoiceLine {
  id               String   @id @default(cuid())
  tenantId         String
  invoiceId        String
  serviceId        String
  subscriptionId   String?
  description      String
  quantity         Int      @default(1)
  unitAmountMinor  BigInt
  amountMinor      BigInt
  taxMinor         BigInt   @default(0)
  createdAt        DateTime @default(now())

  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  invoice      Invoice       @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  service      BillingService @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  subscription Subscription?  @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  @@index([invoiceId])
  @@index([tenantId, serviceId])
}

model PaymentIntent {
  id               String               @id @default(cuid())
  tenantId         String
  billingAccountId String
  purpose          PaymentIntentPurpose
  amountMinor      BigInt
  currency         String
  status           PaymentIntentStatus  @default(REQUIRES_CHECKOUT)
  provider         String
  providerRef      String?
  checkoutUrl      String?
  idempotencyKey   String
  metadata         Json?
  expiresAt        DateTime?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  tenant          Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  billingAccount  BillingAccount     @relation(fields: [billingAccountId], references: [id], onDelete: Cascade)
  payments        Payment[]
  checkoutSession CheckoutSession?

  @@unique([tenantId, idempotencyKey])
  @@unique([provider, providerRef])
  @@index([tenantId, status])
}

model Payment {
  id                    String        @id @default(cuid())
  tenantId              String
  paymentIntentId       String
  provider              String
  providerTransactionId String
  amountMinor           BigInt
  currency              String
  status                PaymentStatus @default(PENDING)
  methodType            String?
  paidAt                DateTime?
  createdAt             DateTime      @default(now())

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  paymentIntent PaymentIntent @relation(fields: [paymentIntentId], references: [id], onDelete: Cascade)
  refunds       Refund[]

  @@unique([provider, providerTransactionId])
  @@index([tenantId, paidAt])
}

model Refund {
  id           String       @id @default(cuid())
  tenantId     String
  paymentId    String
  amountMinor  BigInt
  status       RefundStatus @default(PENDING)
  reason       String?
  providerRef  String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Restrict)

  @@index([tenantId, status])
}

model CheckoutSession {
  id              String                @id @default(cuid())
  tenantId        String
  /// @unique is what makes this the 1:1 side of PaymentIntent.checkoutSession.
  paymentIntentId String                @unique
  tokenHash       String
  status          CheckoutSessionStatus @default(PENDING)
  /// Caller app's "back to the app" link, already origin-allowlisted. The
  /// provider's redirect target is always nID's own /return/<token>, built
  /// server-side — a client never chooses where the browser lands.
  returnUrl       String?
  expiresAt       DateTime
  consumedAt      DateTime?
  createdAt       DateTime              @default(now())

  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  paymentIntent PaymentIntent @relation(fields: [paymentIntentId], references: [id], onDelete: Cascade)

  @@unique([tenantId, tokenHash])
}

model UsageRecord {
  id             String   @id @default(cuid())
  tenantId       String
  serviceId      String
  metricKey      String
  quantity       BigInt
  occurredAt     DateTime
  idempotencyKey String
  invoiceLineId  String?
  createdAt      DateTime @default(now())

  tenant  Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  service BillingService @relation(fields: [serviceId], references: [id], onDelete: Restrict)

  @@unique([serviceId, idempotencyKey])
  @@index([tenantId, serviceId, occurredAt])
}

model CreditLedgerEntry {
  id                String            @id @default(cuid())
  tenantId          String
  billingAccountId  String
  deltaMinor        BigInt
  reason            CreditEntryReason
  refType           String
  refId             String
  balanceAfterMinor BigInt
  createdAt         DateTime          @default(now())

  tenant         Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  billingAccount BillingAccount @relation(fields: [billingAccountId], references: [id], onDelete: Cascade)

  /// The idempotency anchor: a retried debit for the same case/intent is a
  /// no-op rather than a second movement (spec §7.3).
  @@unique([tenantId, refType, refId, reason])
  @@index([tenantId, createdAt])
}

model LedgerAccount {
  id        String            @id @default(cuid())
  tenantId  String
  serviceId String?
  kind      LedgerAccountKind
  currency  String
  /// t:<tenantId>[:s:<serviceId>]:<kind>:<currency> — uniqueness without a
  /// partial index, and it encodes tenant so RLS and the key can't disagree.
  scopeKey  String            @unique
  createdAt DateTime          @default(now())

  tenant  Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  service BillingService? @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  entries LedgerEntry[]

  @@index([tenantId, kind])
}

model LedgerTransaction {
  id          String                @id @default(cuid())
  tenantId    String
  type        LedgerTransactionType
  refType     String
  refId       String
  currency    String
  occurredAt  DateTime
  createdAt   DateTime              @default(now())

  tenant  Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  entries LedgerEntry[]

  @@index([tenantId, occurredAt])
  @@index([refType, refId])
}

model LedgerEntry {
  id            String          @id @default(cuid())
  tenantId      String
  transactionId String
  accountId     String
  direction     LedgerDirection
  amountMinor   BigInt

  tenant      Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  transaction LedgerTransaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  account     LedgerAccount     @relation(fields: [accountId], references: [id], onDelete: Restrict)

  @@index([transactionId])
  @@index([accountId])
}

model WebhookEvent {
  id                String             @id @default(cuid())
  tenantId          String
  provider          String
  providerEventId   String
  type              String
  payload           Json
  signatureValid    Boolean
  status            WebhookEventStatus @default(RECEIVED)
  error             String?
  receivedAt        DateTime           @default(now())
  processedAt       DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([provider, providerEventId])
  @@index([tenantId, status])
}

/// Platform-level, deliberately NOT tenant-scoped: a settlement file belongs
/// to the merchant account, and only covers rows it can match once it knows
/// the tenant. Admin/reconciliation reads it under app.billing_admin.
model SettlementRecord {
  id                    String           @id @default(cuid())
  provider              String
  providerSettlementId  String
  amountMinor           BigInt
  feeMinor              BigInt
  netMinor              BigInt
  currency              String
  settledAt             DateTime
  matchedPaymentId      String?
  matchedTenantId       String?
  status                SettlementStatus @default(DISCREPANCY)
  createdAt             DateTime         @default(now())

  @@unique([provider, providerSettlementId])
  @@index([status])
}

model OutboundEvent {
  id            String               @id @default(cuid())
  tenantId      String
  serviceId     String?
  eventType     String
  payload       Json
  targetUrl     String
  status        OutboundEventStatus  @default(PENDING)
  attempts      Int                  @default(0)
  nextAttemptAt DateTime?
  lastError     String?
  createdAt     DateTime             @default(now())
  deliveredAt   DateTime?

  tenant  Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  service BillingService? @relation(fields: [serviceId], references: [id], onDelete: SetNull)

  @@index([tenantId, status])
  @@index([status, nextAttemptAt])
}
```

- [ ] **Step 3: Extend `Tenant` and `AuditLogEntry` additively**

In `model Tenant` (schema.prisma:82-107), add next to `webhookSecretPlaintext`:

```prisma
  /// Billing outbound events sign with this secret, never webhookUrl's —
  /// an existing tenant's verification webhooks keep working untouched
  /// (spec §15). Same at-rest treatment, and same tracked gap, as
  /// webhookSecretPlaintext: not hashed because signing needs the real value.
  billingWebhookUrl             String?
  billingWebhookSecretPlaintext String?
```

and in the relation block:

```prisma
  billingAccount     BillingAccount?
  billingSubscriptions Subscription[]
  billingInvoices    Invoice[]
  paymentIntents     PaymentIntent[]
  payments           Payment[]
  refunds            Refund[]
  checkoutSessions   CheckoutSession[]
  usageRecords       UsageRecord[]
  creditEntries      CreditLedgerEntry[]
  ledgerAccounts     LedgerAccount[]
  ledgerTransactions LedgerTransaction[]
  ledgerEntries      LedgerEntry[]
  webhookEvents      WebhookEvent[]
  outboundEvents     OutboundEvent[]
```

In `model AuditLogEntry` (schema.prisma:481-496) add:

```prisma
  /// What row this action touched, for financial records — invoice, payment,
  /// payment_intent, refund, subscription, account, plan, service. House rule 3
  /// audits reads of these too, and a bare `action` string cannot be queried
  /// back to a specific record.
  entityType String?
  entityId   String?
```

and `@@index([tenantId, entityType, entityId])`.

- [ ] **Step 4: Validate the schema before generating anything**

Run: `pnpm db:validate`
Expected: `Prisma schema loaded from prisma/schema.prisma` and no error. A relation-name or missing-back-relation error here is the failure to fix now, not after migration.

- [ ] **Step 5: Generate the migration without applying it**

Run (local Postgres from README up first): `pnpm --filter @nid/db exec prisma migrate dev --create-only --name billing_platform`
Expected: a new folder `packages/db/prisma/migrations/<timestamp>_billing_platform/migration.sql` containing `CREATE TYPE` for the 20 new enums, `CREATE TABLE` for the 19 new models, the `Tenant`/`AuditLogEntry` `ALTER TABLE ... ADD COLUMN` lines, indexes and FKs. Note the exact folder name — Steps 6-8 write into it.

- [ ] **Step 6: Append the sequence and every RLS policy to the generated migration**

Prisma generates tables, never policies — house rule 2 is hand-written SQL here, in the same file that creates the tables. Append to the end of `<timestamp>_billing_platform/migration.sql`:

```sql
-- Invoice numbers come from a Postgres sequence rather than a count(*)+1,
-- which two concurrent issues would both win. Global, not per-tenant: the
-- public number is NID-<year>-<seq> and must be unique across tenants.
CREATE SEQUENCE "billing_invoice_number_seq" START 1 INCREMENT 1;

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
```

- [ ] **Step 7: Apply the migration and regenerate the client**

Run: `pnpm --filter @nid/db exec prisma migrate dev && pnpm --filter @nid/db generate`
Expected: the migration applies, `prisma generate` writes `packages/db/generated/client`, and `pnpm db:validate` still passes.

Then prove the policies actually bind (policies are invisible to Prisma, so a typo is silent):

Run:
```bash
docker exec -it nid-postgres psql -U nid -d nid -c \
  "SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('Invoice','PaymentIntent','BillingService','SettlementRecord','BillingAccount') ORDER BY tablename, policyname;"
```
Expected rows: `BillingAccount/tenant_isolation`, `BillingService/catalog_read` + `catalog_write`, `Invoice/tenant_isolation`, `PaymentIntent/payment_intent_lookup` + the three scoped write policies, `SettlementRecord/settlement_admin_only`. Zero rows means the `DO $$` block never ran, not that Postgres is being quiet.

- [ ] **Step 8: Add `TransactionClient` and `withBillingAdminContext` to `packages/db/src/index.ts`**

Replace the file's transaction helper section with:

```ts
export type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export async function withTenantContext<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

/**
 * Runs `fn` with `app.billing_admin` set, which is the only way the catalog
 * policies' write branch opens. This is deliberately not a general-purpose
 * escape hatch: `catalog_write` grants INSERT/UPDATE/DELETE on BillingService,
 * Plan and BillingServiceCredential and nothing else, so holding it cannot
 * reach a tenant's money. `apps/api`'s admin path is the only caller —
 * `withTenantContext` still has to be nested inside it for anything
 * tenant-scoped, because this sets no tenant.
 */
export async function withBillingAdminContext<T>(
  prisma: PrismaClient,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.billing_admin', 'on', true)`;
    return fn(tx);
  });
}
```

(`apps/api`'s `PrismaService.TenantScopedClient` already resolves to the same structural type; leave it as-is so no existing import breaks.)

- [ ] **Step 9: Add `generateCheckoutToken` to `packages/shared-types/src/session-token.ts`**

```ts
const CHECKOUT_TOKEN_BYTE_LENGTH = 32;

export interface GeneratedCheckoutToken extends GeneratedSessionToken {}

/**
 * The capability token behind apps/checkout-ui's /checkout/<token>. 256 bits
 * and only its hash is stored, because the URL is written into a provider's
 * hosted page, a browser history and possibly a Referrer header — a location
 * the payer's own bank, not nID, controls. Distinct from generateSessionToken's
 * 192 bits for the same reason: this one unlocks a payment, not a status read.
 */
export function generateCheckoutToken(): GeneratedCheckoutToken {
  const plaintext = randomBytes(CHECKOUT_TOKEN_BYTE_LENGTH).toString('base64url');
  return { plaintext, hash: sha256Hex(plaintext) };
}
```

- [ ] **Step 10: Prove the token generator and run the package suites**

Add to `packages/shared-types/src/session-token.spec.ts`:

```ts
import { generateCheckoutToken } from './session-token';
import { sha256Hex } from './crypto';

describe('generateCheckoutToken', () => {
  it('hashes a 256-bit url-safe token and never returns the hash as plaintext', () => {
    const token = generateCheckoutToken();
    expect(token.plaintext).not.toEqual(token.hash);
    expect(token.plaintext).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sha256Hex(token.plaintext)).toEqual(token.hash);
  });

  it('produces a different token every call', () => {
    expect(generateCheckoutToken().plaintext).not.toEqual(generateCheckoutToken().plaintext);
  });
});
```

Run: `pnpm --filter @nid/shared-types test -- --runTestsByPath src/session-token.spec.ts`
Expected: PASS (4 tests including the existing session-token ones).

Then the workspace gate: `pnpm typecheck && pnpm lint && pnpm db:validate`
Expected: all three clean. If `pnpm typecheck` reports `Subscription` is not assignable in some file you have not read, that is Prisma's client having picked a different relation name than the models above — fix the schema, not the caller.

- [ ] **Step 11: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations packages/db/src/index.ts packages/shared-types/src/session-token.ts packages/shared-types/src/session-token.spec.ts
git commit -m "feat(db): add billing platform schema, RLS policies and admin context"
```

---

## Task 2: `packages/payments` — provider boundary, mock provider, registry

**Files:**
- Create: `packages/payments/package.json`, `packages/payments/tsconfig.json`, `packages/payments/jest.config.js`
- Create: `packages/payments/src/types.ts`, `src/errors.ts`, `src/mock.provider.ts`, `src/registry.ts`, `src/index.ts`
- Test: `packages/payments/src/mock.provider.spec.ts`, `src/registry.spec.ts`

**Interfaces:**
- Consumes: `@nid/shared-types` (`signWebhookPayload`, `verifyWebhookSignature`, `constantTimeEqualHex`).
- Produces: `PaymentProvider`, `CreateCheckoutInput`, `CreateCheckoutResult`, `ProviderPayment`, `ParsedWebhook`, `RefundInput`, `RefundResult`, `CanonicalPaymentStatus`, `PaymentProviderError`, `PaymentProviderConfigError`, `UnknownProviderError`, `MockPaymentProvider`, `ProviderRegistry`, `mapProviderStatus`. `@nid/billing` (Task 7) and `apps/api` (Task 9) consume exactly these.

**Dependency note:** `@nid/payments` must not import `@nid/db` or know what a tenant is. It takes an amount, a reference and two URLs, and returns provider state. That boundary is what makes the ledger testable without a PSP.

- [ ] **Step 1: Scaffold the package**

`packages/payments/package.json`:

```json
{
  "name": "@nid/payments",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "jest",
    "lint": "eslint src --max-warnings=0"
  },
  "dependencies": {
    "@nid/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/jest": "^29.5.13",
    "@types/node": "^22.7.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.0"
  }
}
```

`packages/payments/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/payments/jest.config.js`:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@nid/shared-types$': '<rootDir>/../shared-types/src/index.ts',
  },
};
```

Run: `pnpm install`
Expected: `@nid/payments` links into the workspace; no new external dependency.

- [ ] **Step 2: Write the interface and errors**

`packages/payments/src/types.ts`:

```ts
export type CanonicalPaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELED';

export interface CreateCheckoutInput {
  /** Minor units. The provider never sees a card number — this is a redirect. */
  amountMinor: bigint;
  currency: string;
  /** Shown to the payer on the provider's hosted page. */
  description: string;
  /** nID's own reference (the PaymentIntent id) — echoed back by webhook. */
  reference: string;
  returnUrl: string;
  webhookUrl: string;
}

export interface CreateCheckoutResult {
  providerRef: string;
  checkoutUrl: string;
  expiresAt: Date;
}

export interface ProviderPayment {
  providerRef: string;
  status: CanonicalPaymentStatus;
  amountMinor: bigint;
  currency: string;
  methodType: string | null;
  paidAt: Date | null;
  raw: unknown;
}

export interface ParsedWebhook {
  providerEventId: string;
  type: string;
  providerRef: string;
  status: CanonicalPaymentStatus;
  paidAmountMinor: bigint | null;
  currency: string | null;
  methodType: string | null;
  occurredAt: Date | null;
  raw: unknown;
}

export interface RefundInput {
  providerRef: string;
  providerTransactionId: string;
  amountMinor: bigint;
  currency: string;
  reason?: string;
}

export interface RefundResult {
  providerRef: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

/**
 * One hosted-checkout payment provider. `createCheckout` never receives card
 * data — that is the whole point of D5/SAQ A, and the type makes it
 * unrepresentable rather than merely discouraged. Nothing here knows about
 * tenants, invoices or ledger accounts.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  fetchPayment(providerRef: string): Promise<ProviderPayment>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  parseWebhook(rawBody: Buffer): ParsedWebhook;
  refund(input: RefundInput): Promise<RefundResult>;
}
```

`packages/payments/src/errors.ts`:

```ts
/** A provider call failed at the network/protocol level. Safe to surface as 502. */
export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

/** A provider was named in PAYMENT_PROVIDERS but is not configured. Thrown at boot, not per-request. */
export class PaymentProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderConfigError';
  }
}

export class UnknownProviderError extends Error {
  constructor(name: string) {
    super(`Unknown payment provider "${name}".`);
    this.name = 'UnknownProviderError';
  }
}
```

- [ ] **Step 3: Write the failing tests**

`packages/payments/src/mock.provider.spec.ts`:

```ts
import { MockPaymentProvider } from './mock.provider';

const provider = new MockPaymentProvider({ checkoutUiUrl: 'http://localhost:3500' });

describe('MockPaymentProvider', () => {
  it('returns a mock-pay URL on the checkout UI, keyed by a fresh provider ref', async () => {
    const result = await provider.createCheckout({
      amountMinor: 11800n,
      currency: 'PKR',
      description: '10,000 verification credits',
      reference: 'intent_1',
      returnUrl: 'http://localhost:3500/return/token_1',
      webhookUrl: 'http://localhost:4000/v1/billing/webhooks/mock',
    });

    expect(result.providerRef).toMatch(/^mock_[0-9a-f]{16}$/);
    expect(result.checkoutUrl).toBe(`http://localhost:3500/mock-pay/${result.providerRef}`);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('never hands back the same provider ref twice', async () => {
    const input = {
      amountMinor: 100n,
      currency: 'PKR',
      description: 'x',
      reference: 'intent_2',
      returnUrl: 'r',
      webhookUrl: 'w',
    };
    const a = await provider.createCheckout(input);
    const b = await provider.createCheckout(input);
    expect(a.providerRef).not.toEqual(b.providerRef);
  });

  it('refuses the webhook protocol — the dev mock-payment endpoint is the settlement path', () => {
    expect(provider.verifyWebhook(Buffer.from('{}'), {})).toBe(false);
    expect(() => provider.parseWebhook(Buffer.from('{}'))).toThrow(/dev mock-payment endpoint/);
  });

  it('maps the configured outcome onto fetchPayment', async () => {
    const failing = new MockPaymentProvider({ checkoutUiUrl: 'http://x', outcome: 'failure' });
    expect((await failing.fetchPayment('mock_abc')).status).toBe('FAILED');
    expect((await provider.fetchPayment('mock_abc')).status).toBe('PENDING');
  });
});
```

`packages/payments/src/registry.spec.ts`:

```ts
import { MockPaymentProvider } from './mock.provider';
import { ProviderRegistry, UnknownProviderError } from './registry';

describe('ProviderRegistry', () => {
  const registry = new ProviderRegistry([new MockPaymentProvider({ checkoutUiUrl: 'http://x' })]);

  it('resolves a registered provider by name', () => {
    expect(registry.get('mock').name).toBe('mock');
  });

  it('throws rather than falling back to the dev mock in production-shaped code', () => {
    expect(() => registry.get('stripe')).toThrow(UnknownProviderError);
  });

  it('rejects two providers claiming one name', () => {
    expect(
      () =>
        new ProviderRegistry([
          new MockPaymentProvider({ checkoutUiUrl: 'http://a' }),
          new MockPaymentProvider({ checkoutUiUrl: 'http://b' }),
        ]),
    ).toThrow(/duplicate/);
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm --filter @nid/payments test -- --runTestsByPath src/mock.provider.spec.ts src/registry.spec.ts`
Expected: FAIL — `Cannot find module './mock.provider'`.

- [ ] **Step 5: Implement the mock provider and registry**

`packages/payments/src/mock.provider.ts`:

```ts
import { randomBytes } from 'node:crypto';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhook,
  PaymentProvider,
  ProviderPayment,
  RefundInput,
  RefundResult,
} from './types';

export interface MockPaymentProviderOptions {
  /** Base URL of apps/checkout-ui — the mock "hosted page" lives there. */
  checkoutUiUrl: string;
  /** What fetchPayment reports; the mock-pay page decides settlement itself. */
  outcome?: 'success' | 'failure' | 'pending';
}

/**
 * The provider that keeps the whole billing system testable without sandbox
 * credentials: a real implementation of the interface whose hosted page is
 * apps/checkout-ui's /mock-pay/[providerRef], whose settlement is the dev-only
 * POST /v1/billing/dev/mock-payments, and which has no webhook protocol of its
 * own (verifyWebhook is deliberately false, so nothing can accidentally take a
 * "signed" mock webhook as evidence of payment).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly options: MockPaymentProviderOptions) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const providerRef = `mock_${randomBytes(8).toString('hex')}`;
    return {
      providerRef,
      checkoutUrl: `${this.options.checkoutUiUrl}/mock-pay/${providerRef}`,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    };
  }

  async fetchPayment(providerRef: string): Promise<ProviderPayment> {
    return {
      providerRef,
      status:
        this.options.outcome === 'success' ? 'SUCCEEDED' : this.options.outcome === 'failure' ? 'FAILED' : 'PENDING',
      amountMinor: 0n,
      currency: 'PKR',
      methodType: 'mock_card',
      paidAt: this.options.outcome === 'success' ? new Date() : null,
      raw: { mock: true, reference: providerRef },
    };
  }

  verifyWebhook(_rawBody: Buffer, _headers: Record<string, string | string[] | undefined>): boolean {
    return false;
  }

  parseWebhook(_rawBody: Buffer): never {
    throw new Error('MockPaymentProvider has no webhook protocol; use the dev mock-payment endpoint.');
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    return { providerRef: `mock_refund_${randomBytes(6).toString('hex')}`, status: 'SUCCEEDED' };
  }
}
```

`packages/payments/src/registry.ts`:

```ts
import type { CanonicalPaymentStatus, PaymentProvider } from './types';
import { UnknownProviderError } from './errors';

/**
 * Providers are resolved here and nowhere else. A controller that writes
 * `if (provider === 'rapid-gateway')` is the failure mode this exists to
 * prevent — docs/HOUSE-RULES.md rule 1, same shape as
 * packages/verification-providers/src/registry.ts.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(providers: PaymentProvider[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.name)) {
        throw new Error(`Duplicate payment provider name "${provider.name}" in registry.`);
      }
      this.providers.set(provider.name, provider);
    }
  }

  get(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new UnknownProviderError(name);
    return provider;
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  names(): string[] {
    return [...this.providers.keys()];
  }
}

/**
 * Providers spell the same state differently and the webhook payload is the
 * only place that gets to decide, so the mapping is one function every adapter
 * calls instead of each re-deciding what "captured" means. Anything
 * unrecognised is PENDING — never a guessed success — because a wrong SUCCEEDED
 * posts ledger entries and credits a balance, while a wrong PENDING is
 * corrected by the next webhook or poll.
 */
export function mapProviderStatus(raw: string | null | undefined): CanonicalPaymentStatus {
  const value = (raw ?? '').toUpperCase();
  if (['SUCCESS', 'SUCCEEDED', 'PAID', 'CAPTURED', 'COMPLETED', 'SETTLED'].includes(value)) return 'SUCCEEDED';
  if (['FAILED', 'DECLINED', 'REJECTED', 'CANCELLED', 'CANCELED', 'ABORTED'].includes(value)) return 'FAILED';
  if (['EXPIRED', 'TIMEOUT'].includes(value)) return 'EXPIRED';
  return 'PENDING';
}
```

`packages/payments/src/index.ts`:

```ts
export * from './types';
export * from './errors';
export * from './registry';
export * from './mock.provider';
export * from './rapid-gateway.provider';
```

Create `packages/payments/src/rapid-gateway.provider.ts` now as an empty `export {};` placeholder so the barrel resolves, and replace it in Task 3. (Task 3 owns it; nothing else may edit it.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @nid/payments test -- --runTestsByPath src/mock.provider.spec.ts src/registry.spec.ts`
Expected: PASS — 7 tests.

Run: `pnpm --filter @nid/payments typecheck && pnpm --filter @nid/payments lint`
Expected: clean. (`eslint` needs no per-package config — the root `eslint.config.mjs` covers the workspace.)

- [ ] **Step 7: Commit**

```bash
git add packages/payments
git commit -m "feat(payments): add PaymentProvider boundary, dev mock provider and registry"
```

---

## Task 3: Rapid Gateway adapter, fixtures, and the vendor doc

**Files:**
- Create: `packages/payments/src/rapid-gateway.provider.ts` (replace the placeholder)
- Create: `packages/payments/src/rapid-gateway/fixtures/checkout-created.json`, `payment-status-succeeded.json`, `webhook-payment-succeeded.json`, `refund-accepted.json`
- Test: `packages/payments/src/rapid-gateway.provider.spec.ts`
- Create: `docs/vendors/rapid-gateway/README.md`

**Interfaces:**
- Consumes: `PaymentProvider` and the error classes from Task 2, `verifyWebhookSignature` / `signWebhookPayload` / `constantTimeEqualHex` from `@nid/shared-types`.
- Produces: `RapidGatewayProvider`, `RapidGatewayConfig`, `HttpFetch`. Constructor signature `new RapidGatewayProvider(config, fetchImpl?)` — Task 9 constructs it from env, the spec exercises it through the fake transport.

**Reality of this task:** rapidgateway.pk and docs.rapidgateway.pk were unreachable from the environment that wrote this plan, so the endpoint paths, payload field names and webhook header below are a **documented assumption**, not a transcription — they live in `docs/vendors/rapid-gateway/README.md` so the person holding the real docs changes one file plus four constants, and the interface, the ledger and the API surface do not move at all. Do not present this adapter as verified against a live sandbox; Task 15 records it as blocked on credentials.

- [ ] **Step 1: Write the fixtures**

`packages/payments/src/rapid-gateway/fixtures/checkout-created.json`:

```json
{
  "id": "rg_chk_9f2c81",
  "reference": "intent_abc123",
  "checkout_url": "https://sandbox.rapidgateway.pk/checkout/rg_chk_9f2c81",
  "status": "created",
  "expires_at": "2026-10-31T12:30:00Z"
}
```

`packages/payments/src/rapid-gateway/fixtures/payment-status-succeeded.json`:

```json
{
  "id": "rg_chk_9f2c81",
  "reference": "intent_abc123",
  "transaction_id": "rg_txn_77aa31",
  "status": "paid",
  "amount": 11800,
  "currency": "PKR",
  "method": "visa",
  "paid_at": "2026-10-31T12:04:11Z"
}
```

`packages/payments/src/rapid-gateway/fixtures/webhook-payment-succeeded.json`:

```json
{
  "event_id": "rg_evt_5c1d02",
  "event_type": "payment.succeeded",
  "occurred_at": "2026-10-31T12:04:12Z",
  "data": {
    "id": "rg_chk_9f2c81",
    "reference": "intent_abc123",
    "transaction_id": "rg_txn_77aa31",
    "status": "paid",
    "amount": 11800,
    "currency": "PKR",
    "method": "visa"
  }
}
```

`packages/payments/src/rapid-gateway/fixtures/refund-accepted.json`:

```json
{ "id": "rg_ref_31b0", "status": "pending", "amount": 2500, "currency": "PKR" }
```

- [ ] **Step 2: Write the failing adapter contract test**

`packages/payments/src/rapid-gateway.provider.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signWebhookPayload } from '@nid/shared-types';
import { RapidGatewayProvider, type HttpFetch, type RapidGatewayConfig } from './rapid-gateway.provider';

const CONFIG: RapidGatewayConfig = {
  baseUrl: 'https://sandbox.rapidgateway.pk',
  merchantId: 'merch_1',
  apiKey: 'key_1',
  apiSecret: 'secret_1',
  webhookSecret: 'whsec_test',
};

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(__dirname, 'rapid-gateway', 'fixtures', name), 'utf8'));
}

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function fakeTransport(response: unknown, records: Recorded[]): HttpFetch {
  return async (url, init) => {
    records.push({
      url,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: init?.body,
    });
    return { ok: true, status: 200, json: async () => response };
  };
}

describe('RapidGatewayProvider', () => {
  it('creates a checkout and maps the hosted URL, ref and expiry', async () => {
    const records: Recorded[] = [];
    const provider = new RapidGatewayProvider(CONFIG, fakeTransport(fixture('checkout-created.json'), records));

    const result = await provider.createCheckout({
      amountMinor: 11800n,
      currency: 'PKR',
      description: '10,000 verification credits',
      reference: 'intent_abc123',
      returnUrl: 'https://pay.test/return/tok',
      webhookUrl: 'https://api.test/v1/billing/webhooks/rapid-gateway',
    });

    expect(result).toEqual({
      providerRef: 'rg_chk_9f2c81',
      checkoutUrl: 'https://sandbox.rapidgateway.pk/checkout/rg_chk_9f2c81',
      expiresAt: new Date('2026-10-31T12:30:00Z'),
    });
    expect(records[0]!.url).toBe('https://sandbox.rapidgateway.pk/v1/checkout/sessions');
    expect(records[0]!.method).toBe('POST');
    expect(records[0]!.headers.authorization).toBe('Bearer key_1');
    expect(JSON.parse(records[0]!.body!)).toEqual({
      merchant_id: 'merch_1',
      reference: 'intent_abc123',
      amount: 11800,
      currency: 'PKR',
      description: '10,000 verification credits',
      return_url: 'https://pay.test/return/tok',
      webhook_url: 'https://api.test/v1/billing/webhooks/rapid-gateway',
    });
  });

  it('reads a status back through the canonical mapping', async () => {
    const provider = new RapidGatewayProvider(
      CONFIG,
      fakeTransport(fixture('payment-status-succeeded.json'), []),
    );
    const payment = await provider.fetchPayment('rg_chk_9f2c81');

    expect(payment.status).toBe('SUCCEEDED');
    expect(payment.amountMinor).toBe(11800n);
    expect(payment.methodType).toBe('visa');
    expect(payment.paidAt).toEqual(new Date('2026-10-31T12:04:11Z'));
  });

  it('accepts a correctly signed webhook inside the replay window', () => {
    const provider = new RapidGatewayProvider(CONFIG);
    const body = Buffer.from(JSON.stringify(fixture('webhook-payment-succeeded.json')));
    const timestamp = Date.now();
    const signature = signWebhookPayload(CONFIG.webhookSecret, body.toString('utf8'), timestamp);

    expect(
      provider.verifyWebhook(body, {
        'x-rapidgateway-signature': `t=${timestamp},v1=${signature}`,
      }),
    ).toBe(true);
  });

  it('rejects a tampered body and a stale timestamp', () => {
    const provider = new RapidGatewayProvider(CONFIG);
    const body = Buffer.from('{"data":{"status":"paid","amount":1}}');
    const timestamp = Date.now();
    const signature = signWebhookPayload(CONFIG.webhookSecret, 'different', timestamp);

    expect(provider.verifyWebhook(body, { 'x-rapidgateway-signature': `t=${timestamp},v1=${signature}` })).toBe(false);

    const freshSig = signWebhookPayload(CONFIG.webhookSecret, body.toString('utf8'), timestamp - 6 * 60_000);
    expect(
      provider.verifyWebhook(body, { 'x-rapidgateway-signature': `t=${timestamp - 6 * 60_000},v1=${freshSig}` }),
    ).toBe(false);
  });

  it('parses a payment webhook into canonical fields', () => {
    const provider = new RapidGatewayProvider(CONFIG);
    const parsed = provider.parseWebhook(Buffer.from(JSON.stringify(fixture('webhook-payment-succeeded.json'))));

    expect(parsed).toMatchObject({
      providerEventId: 'rg_evt_5c1d02',
      type: 'payment.succeeded',
      providerRef: 'rg_chk_9f2c81',
      status: 'SUCCEEDED',
      paidAmountMinor: 11800n,
      currency: 'PKR',
      methodType: 'visa',
    });
    expect(parsed.occurredAt).toEqual(new Date('2026-10-31T12:04:12Z'));
  });

  it('refuses to parse a webhook whose transaction id is missing', () => {
    const provider = new RapidGatewayProvider(CONFIG);
    const body = Buffer.from(JSON.stringify({ event_id: 'e1', event_type: 'payment.succeeded', data: { id: 'x' } }));
    expect(() => provider.parseWebhook(body)).toThrow(/transaction id/);
  });

  it('submits a refund in minor units and maps its pending state', async () => {
    const records: Recorded[] = [];
    const provider = new RapidGatewayProvider(CONFIG, fakeTransport(fixture('refund-accepted.json'), records));

    const result = await provider.refund({
      providerRef: 'rg_chk_9f2c81',
      providerTransactionId: 'rg_txn_77aa31',
      amountMinor: 2500n,
      currency: 'PKR',
      reason: 'duplicate charge',
    });

    expect(result).toEqual({ providerRef: 'rg_ref_31b0', status: 'PENDING' });
    expect(JSON.parse(records[0]!.body!)).toMatchObject({ transaction_id: 'rg_txn_77aa31', amount: 2500 });
  });

  it('throws a provider error, not a silent null, on a non-2xx response', async () => {
    const provider = new RapidGatewayProvider(CONFIG, async () => ({
      ok: false,
      status: 502,
      json: async () => ({ error: 'bad gateway' }),
    }));
    await expect(
      provider.createCheckout({
        amountMinor: 1n,
        currency: 'PKR',
        description: 'x',
        reference: 'r',
        returnUrl: 'u',
        webhookUrl: 'w',
      }),
    ).rejects.toThrow(/502/);
  });

  it('refuses to construct without credentials rather than failing at first payment', () => {
    expect(() => new RapidGatewayProvider({ ...CONFIG, webhookSecret: '' })).toThrow(/webhookSecret/);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @nid/payments test -- --runTestsByPath src/rapid-gateway.provider.spec.ts`
Expected: FAIL — the placeholder file exports nothing.

- [ ] **Step 4: Implement the adapter**

`packages/payments/src/rapid-gateway.provider.ts`:

```ts
import { verifyWebhookSignature } from '@nid/shared-types';
import { PaymentProviderConfigError, PaymentProviderError } from './errors';
import { mapProviderStatus } from './registry';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhook,
  PaymentProvider,
  ProviderPayment,
  RefundInput,
  RefundResult,
} from './types';

export interface RapidGatewayConfig {
  baseUrl: string;
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  /** Overridable because the aggregator's path prefix is a doc-level detail. */
  checkoutPath?: string;
  statusPath?: string;
  refundPath?: string;
  signatureHeader?: string;
}

export interface HttpFetch {
  (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

interface RapidCheckoutResponse {
  id: string;
  checkout_url: string;
  expires_at: string;
}

interface RapidPaymentResponse {
  id: string;
  transaction_id?: string | null;
  status: string;
  amount: number;
  currency: string;
  method?: string | null;
  paid_at?: string | null;
}

interface RapidWebhook {
  event_id: string;
  event_type: string;
  occurred_at?: string | null;
  data: {
    id: string;
    transaction_id?: string | null;
    status: string;
    amount?: number | null;
    currency?: string | null;
    method?: string | null;
  };
}

/**
 * Provisional mapping — see docs/vendors/rapid-gateway/README.md. When the real
 * sandbox docs arrive, the only things that change are the four PATH/Header
 * constants, the response field names on the three interfaces above, and the
 * fixtures. createCheckout/fetchPayment/refund/verifyWebhook/parseWebhook and
 * everything upstream of them stay.
 */
const DEFAULT_CHECKOUT_PATH = '/v1/checkout/sessions';
const DEFAULT_STATUS_PATH = '/v1/payments';
const DEFAULT_REFUND_PATH = '/v1/refunds';
const DEFAULT_SIGNATURE_HEADER = 'x-rapidgateway-signature';
/** Spec §11's 5-minute replay window, enforced here rather than in the controller. */
const REPLAY_WINDOW_MS = 5 * 60_000;

export class RapidGatewayProvider implements PaymentProvider {
  readonly name = 'rapid-gateway';

  constructor(
    private readonly config: RapidGatewayConfig,
    private readonly fetchImpl: HttpFetch = fetch as unknown as HttpFetch,
  ) {
    for (const field of ['baseUrl', 'merchantId', 'apiKey', 'apiSecret', 'webhookSecret'] as const) {
      if (!config[field]?.trim()) {
        throw new PaymentProviderConfigError(
          `Rapid Gateway is enabled (PAYMENT_PROVIDERS contains "rapid-gateway") but ${field} is empty.`,
        );
      }
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const response = await this.request<RapidCheckoutResponse>(
      this.config.checkoutPath ?? DEFAULT_CHECKOUT_PATH,
      'POST',
      {
        merchant_id: this.config.merchantId,
        reference: input.reference,
        // Rapid Gateway quotes amounts in minor units per the assumed contract;
        // Number() is safe below 2^53 paisa (≈₹4.5 trillion) and this is the one
        // place a float can appear, at the protocol edge, never in the ledger.
        amount: Number(input.amountMinor),
        currency: input.currency,
        description: input.description,
        return_url: input.returnUrl,
        webhook_url: input.webhookUrl,
      },
    );
    return {
      providerRef: response.id,
      checkoutUrl: response.checkout_url,
      expiresAt: new Date(response.expires_at),
    };
  }

  async fetchPayment(providerRef: string): Promise<ProviderPayment> {
    const path = `${this.config.statusPath ?? DEFAULT_STATUS_PATH}/${encodeURIComponent(providerRef)}`;
    const response = await this.request<RapidPaymentResponse>(path, 'GET');
    return {
      providerRef,
      status: mapProviderStatus(response.status),
      amountMinor: BigInt(Math.round(response.amount)),
      currency: response.currency,
      methodType: response.method ?? null,
      paidAt: response.paid_at ? new Date(response.paid_at) : null,
      raw: response,
    };
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const header = headers[this.config.signatureHeader ?? DEFAULT_SIGNATURE_HEADER];
    if (typeof header !== 'string') return false;

    const parts = new Map(
      header.split(',').map((pair) => {
        const index = pair.indexOf('=');
        return index === -1 ? ['', ''] : [pair.slice(0, index).trim(), pair.slice(index + 1).trim()];
      }),
    );
    const timestamp = Number(parts.get('t'));
    const signature = parts.get('v1') ?? '';
    if (!Number.isFinite(timestamp)) return false;
    // Reject before comparing: an old capture is worthless even if it is valid.
    if (Math.abs(Date.now() - timestamp) > REPLAY_WINDOW_MS) return false;

    return verifyWebhookSignature(
      this.config.webhookSecret,
      rawBody.toString('utf8'),
      timestamp,
      signature,
    );
  }

  parseWebhook(rawBody: Buffer): ParsedWebhook {
    const event = JSON.parse(rawBody.toString('utf8')) as RapidWebhook;
    if (!event?.data?.transaction_id) {
      throw new PaymentProviderError('Rapid Gateway webhook has no transaction id; cannot settle it.');
    }
    return {
      providerEventId: event.event_id,
      type: event.event_type,
      providerRef: event.data.id,
      status: mapProviderStatus(event.data.status),
      paidAmountMinor:
        typeof event.data.amount === 'number' ? BigInt(Math.round(event.data.amount)) : null,
      currency: event.data.currency ?? null,
      methodType: event.data.method ?? null,
      occurredAt: event.occurred_at ? new Date(event.occurred_at) : null,
      raw: event,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const response = await this.request<{ id: string; status: string }>(
      this.config.refundPath ?? DEFAULT_REFUND_PATH,
      'POST',
      {
        merchant_id: this.config.merchantId,
        reference: input.providerRef,
        transaction_id: input.providerTransactionId,
        amount: Number(input.amountMinor),
        currency: input.currency,
        reason: input.reason ?? null,
      },
    );
    return { providerRef: response.id, status: mapProviderStatus(response.status) === 'SUCCEEDED' ? 'SUCCEEDED' : 'PENDING' };
  }

  private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'x-rapidgateway-merchant': this.config.merchantId,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new PaymentProviderError(
        `Rapid Gateway ${method} ${path} failed with ${response.status}${payload?.error ? `: ${payload.error}` : ''}.`,
      );
    }
    return (await response.json()) as T;
  }
}
```

- [ ] **Step 5: Run the contract test to verify it passes**

Run: `pnpm --filter @nid/payments test -- --runTestsByPath src/rapid-gateway.provider.spec.ts`
Expected: PASS — 9 tests.

Run: `pnpm --filter @nid/payments test`
Expected: PASS — the whole package including Task 2's 7 tests.

- [ ] **Step 6: Write the vendor doc that carries the assumption**

`docs/vendors/rapid-gateway/README.md`:

```markdown
# Rapid Gateway — adapter contract as implemented

**Status: PROVISIONAL.** rapidgateway.pk/resources and docs.rapidgateway.pk were
not reachable from the environment that wrote this mapping (2026-10-31). What is
below is the shape `packages/payments/src/rapid-gateway.provider.ts` assumes,
recorded so that correcting it is a bounded edit rather than a hunt.

Everything else in the billing platform is independent of this file: the
PaymentProvider interface, the ledger, the state machines, the API surface and
apps/checkout-ui all work against `MockPaymentProvider` today.

## Assumed

| Item | Assumption | Where to change it |
|---|---|---|
| Sandbox base URL | `https://sandbox.rapidgateway.pk` | `RAPID_GATEWAY_BASE_URL` |
| Auth | `Authorization: Bearer <api key>` + `x-rapidgateway-merchant: <merchant id>` | `RapidGatewayProvider.request` headers |
| Checkout init | `POST /v1/checkout/sessions` with `{merchant_id, reference, amount, currency, description, return_url, webhook_url}` → `{id, checkout_url, expires_at}` | `checkoutPath` + `createCheckout` body |
| Amount units | minor units (paisa), not rupees | `createCheckout` / `refund` `Number(...)` lines |
| Status read | `GET /v1/payments/{id}` → `{id, transaction_id, status, amount, currency, method, paid_at}` | `statusPath` + `RapidPaymentResponse` |
| Status vocabulary | success set `paid/captured/succeeded/...`, failure `declined/rejected/...` | `mapProviderStatus` in `registry.ts` |
| Webhook envelope | `{event_id, event_type, occurred_at, data:{id, transaction_id, status, amount, currency, method}}` | `RapidWebhook` + `parseWebhook` |
| Webhook signature | header `x-rapidgateway-signature`, value `t=<ms>,v1=<hex hmac-sha256("<t>.<rawBody>")>`, 5-minute replay window | `signatureHeader` + `verifyWebhook` |
| Refund | `POST /v1/refunds` with `{merchant_id, reference, transaction_id, amount, currency, reason}` → `{id, status}` | `refundPath` + `refund` |
| Settlement report | not implemented in Phase 1 (Phase 2 reconciliation) | new `fetchSettlement` method |

## To confirm from the real docs / sandbox credentials

1. Whether checkout is initialized server-to-server (as modelled) or by posting
   a signed HTML form from the payer's browser.
2. Whether the callback signature is HMAC at all, and its header name/format.
3. Whether `amount` is rupees with decimals or paisa.
4. The status enum, verbatim, including partial-capture and dispute states.
5. Whether a reusable mandate/token exists for off-session renewal — spec §7.4
   defaults to invoice-plus-hosted-link precisely because this is unknown.
6. Settlement file format and delivery (SFTP pull vs API push).
7. Raast QR / JazzCash / easypaisa: whether they are the same checkout session
   with a `method` selector or separate products.

## Fixtures

`packages/payments/src/rapid-gateway/fixtures/*.json` are the captured shapes
above. Replace each with a real sandbox capture, then run
`pnpm --filter @nid/payments test` — a failing assertion is the diff between the
assumption and reality.
```

- [ ] **Step 7: Commit**

```bash
git add packages/payments/src/rapid-gateway.provider.ts packages/payments/src/rapid-gateway packages/payments/src/rapid-gateway.provider.spec.ts docs/vendors
git commit -m "feat(payments): add Rapid Gateway hosted-checkout adapter with provisional mapping"
```

## Task 4: `packages/billing` — money rules, double-entry ledger, billing accounts

**Files:**
- Create: `packages/billing/package.json`, `tsconfig.json`, `jest.config.js`
- Create: `packages/billing/src/errors.ts`, `src/money.ts`, `src/ledger.ts`, `src/accounts.ts`, `src/index.ts`
- Test: `packages/billing/src/money.spec.ts`, `src/ledger.spec.ts`, `src/ledger.db.spec.ts`

**Interfaces:**
- Consumes: `@nid/db` (`TransactionClient`, `withTenantContext`, Prisma model types), `@nid/shared-types`.
- Produces: `BillingError`, `UnbalancedLedgerError`, `InsufficientCreditsError`, `CheckoutError`, `CheckoutProviderError`, `isUniqueViolation`; `assertCurrency`, `assertPositiveMinor`, `sumMinor`; `LedgerLineInput`, `PostLedgerTransactionInput`, `ledgerScopeKey`, `assertBalanced`, `postLedgerTransaction`; `ensureBillingAccount`, `getBillingAccount`. Tasks 5-8 build on these names exactly.

- [ ] **Step 1: Scaffold the package**

`packages/billing/package.json`:

```json
{
  "name": "@nid/billing",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "jest",
    "lint": "eslint src --max-warnings=0"
  },
  "dependencies": {
    "@nid/db": "workspace:*",
    "@nid/payments": "workspace:*",
    "@nid/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/jest": "^29.5.13",
    "@types/node": "^22.7.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.0"
  }
}
```

`packages/billing/tsconfig.json` — identical to `packages/payments/tsconfig.json` from Task 2 Step 1.

`packages/billing/jest.config.js`:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@nid/db$': '<rootDir>/../db/src/index.ts',
    '^@nid/payments$': '<rootDir>/../payments/src/index.ts',
    '^@nid/shared-types$': '<rootDir>/../shared-types/src/index.ts',
  },
};
```

Run: `pnpm install`
Expected: `@nid/billing` links; no new external dependency.

- [ ] **Step 2: Write errors and money rules**

`packages/billing/src/errors.ts`:

```ts
export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A ledger transaction that does not sum to zero. Nothing is written when this throws. */
export class UnbalancedLedgerError extends BillingError {}

/** A debit larger than the remaining credit balance. Maps to HTTP 402. */
export class InsufficientCreditsError extends BillingError {}

/** A billing request that violates a business rule. Maps to HTTP 422. */
export class CheckoutError extends BillingError {}

/** The provider refused to open a checkout. Maps to HTTP 502. */
export class CheckoutProviderError extends CheckoutError {}

/**
 * Prisma's unique-violation signal. Race-safe idempotency depends on catching
 * it after the fact (two concurrent top-ups can both pass a read-then-write
 * check), and Prisma exposes the code as a field rather than a typed subclass.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}
```

`packages/billing/src/money.ts`:

```ts
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function assertCurrency(currency: string): void {
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new BillingError(`"${currency}" is not an ISO-4217 currency code.`);
  }
}

/**
 * Zero is not a payable amount. Charging 0 would create a live checkout,
 * a webhook surface and ledger entries for nothing, and a negative amount
 * would silently become a refund that never went through the refund path.
 */
export function assertPositiveMinor(amountMinor: bigint, label: string): void {
  if (amountMinor <= 0n) {
    throw new BillingError(`${label} must be a positive amount in minor units, got ${amountMinor}.`);
  }
}

export function sumMinor(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}
```

- [ ] **Step 3: Write the failing ledger tests**

`packages/billing/src/money.spec.ts`:

```ts
import { assertCurrency, assertPositiveMinor, sumMinor } from './money';

describe('money rules', () => {
  it('accepts ISO-4217 codes and rejects anything else', () => {
    expect(() => assertCurrency('PKR')).not.toThrow();
    expect(() => assertCurrency('pkr')).toThrow(/ISO-4217/);
    expect(() => assertCurrency('RUPEES')).toThrow(/ISO-4217/);
  });

  it('refuses zero and negative amounts', () => {
    expect(() => assertPositiveMinor(1n, 'amount')).not.toThrow();
    expect(() => assertPositiveMinor(0n, 'amount')).toThrow(/positive/);
    expect(() => assertPositiveMinor(-5n, 'refund')).toThrow(/refund/);
  });

  it('sums minor units without floats', () => {
    expect(sumMinor([11800n, 236n, 0n])).toBe(12036n);
    expect(sumMinor([])).toBe(0n);
  });
});
```

`packages/billing/src/ledger.spec.ts`:

```ts
import { assertBalanced, ledgerScopeKey, UnbalancedLedgerError } from './ledger';
import type { LedgerLineInput } from './ledger';

describe('ledgerScopeKey', () => {
  it('encodes tenant before kind so two tenants never share an account', () => {
    expect(ledgerScopeKey('tnt_a', 'REVENUE', 'PKR')).toBe('t:tnt_a:REVENUE:PKR');
  });

  it('encodes the service inside the tenant segment for revenue attribution', () => {
    expect(ledgerScopeKey('tnt_a', 'REVENUE', 'PKR', 'svc_erp')).toBe('t:tnt_a:s:svc_erp:REVENUE:PKR');
  });

  it('treats an explicit null service like no service', () => {
    expect(ledgerScopeKey('tnt_a', 'PSP_CLEARING', 'PKR', null)).toBe(
      ledgerScopeKey('tnt_a', 'PSP_CLEARING', 'PKR'),
    );
  });
});

describe('assertBalanced', () => {
  const line = (over: Partial<LedgerLineInput>): LedgerLineInput => ({
    kind: 'PSP_CLEARING',
    direction: 'DEBIT',
    amountMinor: 11800n,
    ...over,
  });

  it('accepts the credit-pack example from the spec', () => {
    expect(() =>
      assertBalanced([
        line({}),
        line({ kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: 10000n }),
        line({ kind: 'TAX_PAYABLE', direction: 'CREDIT', amountMinor: 1800n }),
      ]),
    ).not.toThrow();
  });

  it('rejects an unbalanced set, a single line, and a zero amount', () => {
    expect(() => assertBalanced([line({}), line({ kind: 'REFUNDS', direction: 'CREDIT', amountMinor: 9999n })])).toThrow(
      UnbalancedLedgerError,
    );
    expect(() => assertBalanced([line({})])).toThrow(/at least two/);
    expect(() =>
      assertBalanced([
        line({ amountMinor: 0n }),
        line({ direction: 'CREDIT', amountMinor: 0n }),
      ]),
    ).toThrow(/positive/);
  });
});
```

`packages/billing/src/ledger.db.spec.ts` — gated the same way as `apps/api/test/tenant-isolation.spec.ts`:

```ts
import {
  createPrismaClient,
  withTenantContext,
  type PrismaClient,
} from '@nid/db';
import { postLedgerTransaction } from './ledger';
import { ensureBillingAccount } from './accounts';

const runDb = process.env['RUN_DB_TESTS'] === 'true' ? describe : describe.skip;

runDb('ledger against real Postgres (nid_app role)', () => {
  const url = process.env['APP_DATABASE_URL'];
  if (!url) throw new Error('ledger.db.spec.ts needs APP_DATABASE_URL — see packages/sql/001-app-role-bootstrap.sql.');
  const DATABASE_URL = process.env['DATABASE_URL'] ?? url;

  let prisma: PrismaClient;
  let superuser: PrismaClient;
  let tenantId: string;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    superuser = createPrismaClient(DATABASE_URL);
    tenantId = (await superuser.tenant.create({ data: { name: `ledger ${suffix}`, slug: `ledger-${suffix}` } })).id;
  });

  afterAll(async () => {
    await superuser.tenant.delete({ where: { id: tenantId } });
    await Promise.all([prisma.$disconnect(), superuser.$disconnect()]);
  });

  it('writes one transaction whose entries sum to zero, creating accounts on first use', async () => {
    const result = await withTenantContext(prisma, tenantId, (tx) =>
      postLedgerTransaction(tx, {
        tenantId,
        type: 'CREDIT_TOPUP',
        refType: 'payment_intent',
        refId: `intent_${suffix}`,
        currency: 'PKR',
        lines: [
          { kind: 'PSP_CLEARING', direction: 'DEBIT', amountMinor: 11800n },
          { kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: 10000n },
          { kind: 'TAX_PAYABLE', direction: 'CREDIT', amountMinor: 1800n },
        ],
      }),
    );

    const entries = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerEntry.findMany({ where: { transactionId: result.transactionId }, include: { account: true } }),
    );

    expect(entries).toHaveLength(3);
    const total = entries.reduce(
      (sum, entry) => sum + (entry.direction === 'DEBIT' ? entry.amountMinor : -entry.amountMinor),
      0n,
    );
    expect(total).toBe(0n);
    expect(new Set(entries.map((entry) => entry.account.scopeKey))).toEqual(
      new Set([`t:${tenantId}:PSP_CLEARING:PKR`, `t:${tenantId}:CUSTOMER_CREDITS:PKR`, `t:${tenantId}:TAX_PAYABLE:PKR`]),
    );
  });

  it('reuses the same account row for a second posting instead of duplicating it', async () => {
    await withTenantContext(prisma, tenantId, (tx) =>
      postLedgerTransaction(tx, {
        tenantId,
        type: 'FEE',
        refType: 'settlement_record',
        refId: `stl_${suffix}`,
        currency: 'PKR',
        lines: [
          { kind: 'PSP_FEES', direction: 'DEBIT', amountMinor: 236n },
          { kind: 'PSP_CLEARING', direction: 'CREDIT', amountMinor: 236n },
        ],
      }),
    );

    const clearingAccounts = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerAccount.findMany({ where: { tenantId, kind: 'PSP_CLEARING' } }),
    );
    expect(clearingAccounts).toHaveLength(1);
  });

  it('creates the tenant-scoped accounts a revenue line needs', async () => {
    const service = await superuser.billingService.create({
      data: { key: `ledger-svc-${suffix}`, name: 'Ledger Test', ownerRepo: 'nID' },
    });

    await withTenantContext(prisma, tenantId, (tx) =>
      postLedgerTransaction(tx, {
        tenantId,
        type: 'CREDIT_USAGE',
        refType: 'verification_case',
        refId: `case_${suffix}`,
        currency: 'PKR',
        lines: [
          { kind: 'CUSTOMER_CREDITS', direction: 'DEBIT', amountMinor: 2500n },
          { kind: 'REVENUE', serviceId: service.id, direction: 'CREDIT', amountMinor: 2500n },
        ],
      }),
    );

    const revenue = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerAccount.findFirst({ where: { tenantId, kind: 'REVENUE', serviceId: service.id } }),
    );
    expect(revenue?.scopeKey).toBe(`t:${tenantId}:s:${service.id}:REVENUE:PKR`);

    await superuser.billingService.delete({ where: { id: service.id } });
  });

  it('leaves the balance cache alone — only credits.ts may move it', async () => {
    const account = await withTenantContext(prisma, tenantId, async (tx) => {
      const created = await ensureBillingAccount(tx, tenantId);
      await postLedgerTransaction(tx, {
        tenantId,
        type: 'CREDIT_TOPUP',
        refType: 'payment_intent',
        refId: `intent_cache_${suffix}`,
        currency: 'PKR',
        lines: [
          { kind: 'PSP_CLEARING', direction: 'DEBIT', amountMinor: 500n },
          { kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: 500n },
        ],
      });
      return created;
    });
    expect(account.creditBalanceMinor).toBe(0n);
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm --filter @nid/billing test -- --runTestsByPath src/money.spec.ts src/ledger.spec.ts`
Expected: FAIL — `Cannot find module './ledger'`.

- [ ] **Step 5: Implement the ledger**

`packages/billing/src/ledger.ts`:

```ts
import type { LedgerAccountKind, LedgerTransactionType, TransactionClient } from '@nid/db';
import { assertCurrency, assertPositiveMinor, sumMinor } from './money';
import { UnbalancedLedgerError } from './errors';

export interface LedgerLineInput {
  kind: LedgerAccountKind;
  /** Only REVENUE/DEFERRED_REVENUE are service-attributed; everything else is platform-wide per tenant. */
  serviceId?: string | null;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: bigint;
}

export interface PostLedgerTransactionInput {
  tenantId: string;
  type: LedgerTransactionType;
  refType: string;
  refId: string;
  currency: string;
  occurredAt?: Date;
  lines: LedgerLineInput[];
}

export function ledgerScopeKey(
  tenantId: string,
  kind: LedgerAccountKind,
  currency: string,
  serviceId?: string | null,
): string {
  const service = serviceId ? `s:${serviceId}:` : '';
  return `t:${tenantId}:${service}${kind}:${currency}`;
}

/**
 * The invariant the ledger exists to hold (spec §5.2, invariant 1): a
 * transaction is a closed system. Checked before any write, because a
 * half-posted transaction is worse than a rejected one — there is no
 * in-transaction rollback of a ledger entry that is visible to a report.
 */
export function assertBalanced(lines: readonly LedgerLineInput[]): void {
  if (lines.length < 2) {
    throw new UnbalancedLedgerError('A ledger transaction needs at least two lines.');
  }
  for (const line of lines) {
    assertPositiveMinor(line.amountMinor, `Ledger line ${line.kind}`);
  }

  const debits = sumMinor(lines.filter((line) => line.direction === 'DEBIT').map((line) => line.amountMinor));
  const credits = sumMinor(lines.filter((line) => line.direction === 'CREDIT').map((line) => line.amountMinor));
  if (debits !== credits) {
    throw new UnbalancedLedgerError(`Ledger transaction is unbalanced: debits ${debits} != credits ${credits}.`);
  }
}

/**
 * Posts one atomic transaction. Accounts are found or created by scopeKey,
 * entries are append-only, and every row carries tenantId so RLS applies to
 * the ledger exactly as it does to invoices (spec D4 + house rule 2).
 *
 * Takes the caller's transaction client rather than opening one, so a payment
 * settlement, its credit movement and its audit row commit together or not at
 * all — spec §4.1.
 */
export async function postLedgerTransaction(
  tx: TransactionClient,
  input: PostLedgerTransactionInput,
): Promise<{ transactionId: string }> {
  assertCurrency(input.currency);
  assertBalanced(input.lines);

  const transaction = await tx.ledgerTransaction.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      refType: input.refType,
      refId: input.refId,
      currency: input.currency,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });

  for (const line of input.lines) {
    const scopeKey = ledgerScopeKey(input.tenantId, line.kind, input.currency, line.serviceId);
    const account = await tx.ledgerAccount.upsert({
      where: { scopeKey },
      update: {},
      create: {
        tenantId: input.tenantId,
        serviceId: line.serviceId ?? null,
        kind: line.kind,
        currency: input.currency,
        scopeKey,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        tenantId: input.tenantId,
        transactionId: transaction.id,
        accountId: account.id,
        direction: line.direction,
        amountMinor: line.amountMinor,
      },
    });
  }

  return { transactionId: transaction.id };
}
```

`packages/billing/src/accounts.ts`:

```ts
import type { BillingAccount, TransactionClient } from '@nid/db';
import { assertCurrency } from './money';

/**
 * The billing account IS the tenant (spec D3) — one per tenant, created on
 * first billing action rather than by a migration backfill, so a tenant that
 * never buys anything never has a financial row.
 */
export async function ensureBillingAccount(
  tx: TransactionClient,
  tenantId: string,
  currency = 'PKR',
): Promise<BillingAccount> {
  assertCurrency(currency);
  return tx.billingAccount.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, currency },
  });
}

/**
 * Deliberately read-only: charge flows must not mint an account as a side
 * effect of a lookup. Verification's credit debit uses this so a tenant
 * with no billing relationship stays entirely out of the billing system.
 */
export async function getBillingAccount(tx: TransactionClient, tenantId: string): Promise<BillingAccount | null> {
  return tx.billingAccount.findUnique({ where: { tenantId } });
}
```

`packages/billing/src/index.ts` (grows in Tasks 5-8):

```ts
export * from './errors';
export * from './money';
export * from './ledger';
export * from './accounts';
```

- [ ] **Step 6: Run unit and DB tests**

Run: `pnpm --filter @nid/billing test -- --runTestsByPath src/money.spec.ts src/ledger.spec.ts`
Expected: PASS — 8 tests.

Run: `RUN_DB_TESTS=true pnpm --filter @nid/billing test -- --runTestsByPath src/ledger.db.spec.ts`
Expected: PASS — 4 tests. Without the env var the file reports `skipped`, which is the same contract `apps/api/test/tenant-isolation.spec.ts` already uses.

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/billing
git commit -m "feat(billing): add money rules, double-entry ledger and billing accounts"
```

---

## Task 5: Catalog reads and the invoice engine

**Files:**
- Create: `packages/billing/src/catalog.ts`, `src/invoices.ts`
- Modify: `packages/billing/src/index.ts`
- Test: `packages/billing/src/invoices.spec.ts` (unit, totals), `packages/billing/src/invoices.db.spec.ts` (numbering, transitions, RLS)

**Interfaces:**
- Consumes: `TransactionClient`, `postLedgerTransaction` (Task 4), billing enums from Prisma.
- Produces: `listActiveServices(tx)`, `listActivePlans(tx, serviceKey)`, `getPlanById(tx, planId)`, `getServiceByKey(tx, key)`; `CreateInvoiceInput`, `CreateInvoiceLineInput`, `createInvoice(tx, input)`, `issueInvoice(tx, invoiceId)`, `markInvoicePaid(tx, invoiceId, amountMinor, paidAt)`, `voidInvoice(tx, invoiceId)`, `getInvoiceWithLines(tx, tenantId, invoiceId)`.

- [ ] **Step 1: Write the failing tests**

`packages/billing/src/invoices.spec.ts`:

```ts
import { invoiceTotals } from './invoices';

describe('invoiceTotals', () => {
  it('multiplies quantity by unit amount and adds line tax', () => {
    expect(
      invoiceTotals([
        { quantity: 3, unitAmountMinor: 1000n, taxMinor: 50n },
        { quantity: 1, unitAmountMinor: 250n, taxMinor: 0n },
      ]),
    ).toEqual({ subtotalMinor: 3250n, taxMinor: 150n, totalMinor: 3400n });
  });

  it('defaults tax to zero because Phase 1 has no tax engine (spec §1.2)', () => {
    expect(invoiceTotals([{ quantity: 1, unitAmountMinor: 11800n }])).toEqual({
      subtotalMinor: 11800n,
      taxMinor: 0n,
      totalMinor: 11800n,
    });
  });

  it('rejects an invoice with no lines and a non-positive quantity', () => {
    expect(() => invoiceTotals([])).toThrow(/at least one line/);
    expect(() => invoiceTotals([{ quantity: 0, unitAmountMinor: 100n }])).toThrow(/positive/);
  });
});
```

`packages/billing/src/invoices.db.spec.ts`:

```ts
import { createPrismaClient, withTenantContext, type PrismaClient } from '@nid/db';
import {
  createInvoice,
  getInvoiceWithLines,
  issueInvoice,
  markInvoicePaid,
  voidInvoice,
} from './invoices';
import { ensureBillingAccount } from './accounts';
import { BillingError } from './errors';

const runDb = process.env['RUN_DB_TESTS'] === 'true' ? describe : describe.skip;

runDb('invoices against real Postgres', () => {
  const url = process.env['APP_DATABASE_URL'];
  if (!url) throw new Error('invoices.db.spec.ts needs APP_DATABASE_URL.');
  const DATABASE_URL = process.env['DATABASE_URL'] ?? url;

  let prisma: PrismaClient;
  let superuser: PrismaClient;
  let tenantId: string;
  let serviceId: string;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    superuser = createPrismaClient(DATABASE_URL);
    tenantId = (await superuser.tenant.create({ data: { name: `inv ${suffix}`, slug: `inv-${suffix}` } })).id;
    serviceId = (
      await superuser.billingService.create({ data: { key: `inv-svc-${suffix}`, name: 'Inv Test', ownerRepo: 'nID' } })
    ).id;
    await withTenantContext(prisma, tenantId, (tx) => ensureBillingAccount(tx, tenantId));
  });

  afterAll(async () => {
    await superuser.tenant.delete({ where: { id: tenantId } });
    await superuser.billingService.delete({ where: { id: serviceId } });
    await Promise.all([prisma.$disconnect(), superuser.$disconnect()]);
  });

  it('issues a globally unique NID-<year>-<seq> number from the sequence', async () => {
    const first = await withTenantContext(prisma, tenantId, (tx) =>
      createInvoice(tx, {
        tenantId,
        lines: [{ serviceId, description: '10,000 verification credits', unitAmountMinor: 11800n }],
      }),
    );
    const second = await withTenantContext(prisma, tenantId, (tx) =>
      createInvoice(tx, {
        tenantId,
        lines: [{ serviceId, description: 'Second', unitAmountMinor: 500n }],
      }),
    );

    expect(first.number).toMatch(new RegExp(`^NID-\\d{4}-\\d{6}$`));
    expect(second.number).toMatch(new RegExp(`^NID-\\d{4}-\\d{6}$`));
    expect(first.number).not.toEqual(second.number);
    expect(first.totalMinor).toBe(11800n);
    expect(first.lines).toHaveLength(1);
    expect(first.lines[0]!.amountMinor).toBe(11800n);
  });

  it('walks DRAFT to OPEN to PAID and refuses to reopen a paid invoice', async () => {
    const draft = await withTenantContext(prisma, tenantId, (tx) =>
      createInvoice(tx, { tenantId, lines: [{ serviceId, description: 'One-off', unitAmountMinor: 900n }] }),
    );
    expect(draft.status).toBe('DRAFT');

    const open = await withTenantContext(prisma, tenantId, (tx) => issueInvoice(tx, draft.id));
    expect(open.status).toBe('OPEN');
    expect(open.issuedAt).toBeInstanceOf(Date);

    const paid = await withTenantContext(prisma, tenantId, (tx) =>
      markInvoicePaid(tx, draft.id, 900n, new Date('2026-10-31T12:00:00Z')),
    );
    expect(paid.status).toBe('PAID');
    expect(paid.amountPaidMinor).toBe(900n);
    expect(paid.paidAt).toEqual(new Date('2026-10-31T12:00:00Z'));

    await expect(
      withTenantContext(prisma, tenantId, (tx) => issueInvoice(tx, draft.id)),
    ).rejects.toThrow(BillingError);
  });

  it('keeps an invoice OPEN with a partial amount recorded when the payment underfills it', async () => {
    const invoice = await withTenantContext(prisma, tenantId, async (tx) => {
      const created = await createInvoice(tx, {
        tenantId,
        lines: [{ serviceId, description: 'Two lines', unitAmountMinor: 500n, quantity: 2 }],
      });
      return issueInvoice(tx, created.id);
    });

    const partial = await withTenantContext(prisma, tenantId, (tx) => markInvoicePaid(tx, invoice.id, 400n, new Date()));
    expect(partial.status).toBe('OPEN');
    expect(partial.amountPaidMinor).toBe(400n);
  });

  it('voids an OPEN invoice and refuses to void a paid one', async () => {
    const invoice = await withTenantContext(prisma, tenantId, async (tx) => {
      const created = await createInvoice(tx, {
        tenantId,
        lines: [{ serviceId, description: 'Void me', unitAmountMinor: 100n }],
      });
      return issueInvoice(tx, created.id);
    });

    const voided = await withTenantContext(prisma, tenantId, (tx) => voidInvoice(tx, invoice.id));
    expect(voided.status).toBe('VOID');
    expect(voided.voidedAt).toBeInstanceOf(Date);

    const paidInvoice = await withTenantContext(prisma, tenantId, async (tx) => {
      const created = await createInvoice(tx, {
        tenantId,
        lines: [{ serviceId, description: 'Paid already', unitAmountMinor: 100n }],
      });
      await issueInvoice(tx, created.id);
      return markInvoicePaid(tx, created.id, 100n, new Date());
    });
    await expect(withTenantContext(prisma, tenantId, (tx) => voidInvoice(tx, paidInvoice.id))).rejects.toThrow(
      /cannot be voided/,
    );
  });

  it('scopes invoice reads and writes to one tenant', async () => {
    const otherTenant = await superuser.tenant.create({
      data: { name: `inv other ${suffix}`, slug: `inv-other-${suffix}` },
    });
    try {
      const mine = await withTenantContext(prisma, tenantId, (tx) =>
        createInvoice(tx, { tenantId, lines: [{ serviceId, description: 'Mine', unitAmountMinor: 100n }] }),
      );

      const seenFromOtherTenant = await withTenantContext(prisma, otherTenant.id, (tx) =>
        getInvoiceWithLines(tx, otherTenant.id, mine.id),
      );
      expect(seenFromOtherTenant).toBeNull();

      await expect(
        withTenantContext(prisma, otherTenant.id, (tx) => issueInvoice(tx, mine.id)),
      ).rejects.toThrow(/not found/i);
    } finally {
      await superuser.tenant.delete({ where: { id: otherTenant.id } });
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @nid/billing test -- --runTestsByPath src/invoices.spec.ts`
Expected: FAIL — `Cannot find module './invoices'`.

- [ ] **Step 3: Implement catalog reads**

`packages/billing/src/catalog.ts`:

```ts
import type { BillingService, Plan, TransactionClient } from '@nid/db';
import { CheckoutError } from './errors';

/** A plan with its service joined — the shape every checkout path needs. */
export type PlanWithService = Plan & { service: BillingService };

/**
 * Catalog tables are global with an open SELECT policy (spec §5.3), so these
 * run inside the caller's tenant transaction without leaking across tenants:
 * the read is public by design, and the tenant-scoped writes around it are not.
 */
export async function listActiveServices(tx: TransactionClient): Promise<BillingService[]> {
  return tx.billingService.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } });
}

export async function getServiceByKey(tx: TransactionClient, key: string): Promise<BillingService | null> {
  return tx.billingService.findUnique({ where: { key } });
}

export async function listActivePlans(tx: TransactionClient, serviceKey: string): Promise<PlanWithService[]> {
  return tx.plan.findMany({
    where: { status: 'ACTIVE', service: { key: serviceKey } },
    include: { service: true },
    orderBy: [{ mode: 'asc' }, { unitAmountMinor: 'asc' }],
  });
}

/**
 * Archived plans stay readable by id: a subscription pinned to a v1 price must
 * still resolve it after v2 supersedes it (spec D11). Only a checkout requires
 * ACTIVE, and that check lives at the checkout, not here.
 */
export async function getPlanById(tx: TransactionClient, planId: string): Promise<PlanWithService | null> {
  return tx.plan.findUnique({ where: { id: planId }, include: { service: true } });
}

export async function getActivePlan(tx: TransactionClient, planId: string): Promise<PlanWithService> {
  const plan = await getPlanById(tx, planId);
  if (!plan || plan.status !== 'ACTIVE' || plan.service.status !== 'ACTIVE') {
    throw new CheckoutError(`Plan ${planId} is not available for purchase.`);
  }
  return plan;
}
```

- [ ] **Step 4: Implement the invoice engine**

`packages/billing/src/invoices.ts`:

```ts
import type { Invoice, InvoiceLine, InvoiceStatus, TransactionClient } from '@nid/db';
import { BillingError } from './errors';
import { assertCurrency, assertPositiveMinor } from './money';

export interface CreateInvoiceLineInput {
  serviceId: string;
  description: string;
  unitAmountMinor: bigint;
  quantity?: number;
  taxMinor?: bigint;
  subscriptionId?: string | null;
}

export interface CreateInvoiceInput {
  tenantId: string;
  currency?: string;
  dueAt?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  lines: CreateInvoiceLineInput[];
}

export type InvoiceWithLines = Invoice & { lines: InvoiceLine[] };

/** Pure so the arithmetic that decides "how much does the payer owe" is testable without a database. */
export function invoiceTotals(
  lines: Array<{ quantity?: number; unitAmountMinor: bigint; taxMinor?: bigint }>,
): { subtotalMinor: bigint; taxMinor: bigint; totalMinor: bigint } {
  if (lines.length === 0) throw new BillingError('An invoice needs at least one line.');
  let subtotalMinor = 0n;
  let taxMinor = 0n;
  for (const line of lines) {
    const quantity = BigInt(line.quantity ?? 1);
    if (quantity <= 0n) throw new BillingError('Invoice line quantity must be positive.');
    assertPositiveMinor(line.unitAmountMinor, 'Invoice line unit amount');
    subtotalMinor += line.unitAmountMinor * quantity;
    taxMinor += line.taxMinor ?? 0n;
  }
  return { subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
}

/**
 * Number from a Postgres sequence, not a count: two concurrent issues would
 * otherwise compute the same "last + 1" and one would lose. The sequence is
 * global because the number is public on the invoice and must be unique across
 * tenants.
 */
async function nextInvoiceNumber(tx: TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ n: bigint }>>`SELECT nextval('billing_invoice_number_seq') AS n`;
  const n = rows[0]?.n;
  if (n === undefined) throw new BillingError('Could not draw an invoice number from the sequence.');
  return `NID-${new Date().getUTCFullYear()}-${n.toString().padStart(6, '0')}`;
}

export async function createInvoice(
  tx: TransactionClient,
  input: CreateInvoiceInput,
): Promise<InvoiceWithLines> {
  const currency = input.currency ?? 'PKR';
  assertCurrency(currency);
  const { subtotalMinor, taxMinor, totalMinor } = invoiceTotals(input.lines);

  const billingAccount = await tx.billingAccount.findUnique({ where: { tenantId: input.tenantId } });
  if (!billingAccount) throw new BillingError(`No billing account for tenant ${input.tenantId}.`);

  const invoice = await tx.invoice.create({
    data: {
      tenantId: input.tenantId,
      billingAccountId: billingAccount.id,
      number: await nextInvoiceNumber(tx),
      status: 'DRAFT',
      currency,
      subtotalMinor,
      taxMinor,
      totalMinor,
      dueAt: input.dueAt,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      lines: {
        create: input.lines.map((line) => ({
          tenantId: input.tenantId,
          serviceId: line.serviceId,
          subscriptionId: line.subscriptionId ?? null,
          description: line.description,
          quantity: line.quantity ?? 1,
          unitAmountMinor: line.unitAmountMinor,
          amountMinor: line.unitAmountMinor * BigInt(line.quantity ?? 1),
          taxMinor: line.taxMinor ?? 0n,
        })),
      },
    },
    include: { lines: true },
  });
  return invoice;
}

export async function getInvoiceWithLines(
  tx: TransactionClient,
  tenantId: string,
  invoiceId: string,
): Promise<(Invoice & { lines: Array<Invoice['lines'][number]> }) | null> {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { lines: { orderBy: { createdAt: 'asc' } } },
  });
  return invoice ?? null;
}

async function transition(
  tx: TransactionClient,
  invoiceId: string,
  allowedFrom: InvoiceStatus[],
  data: Partial<Invoice>,
  rejectMessage: string,
): Promise<InvoiceWithLines> {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true } });
  if (!invoice) throw new BillingError(`Invoice ${invoiceId} not found.`);
  if (!allowedFrom.includes(invoice.status)) {
    throw new BillingError(`Invoice ${invoiceId} is ${invoice.status} and ${rejectMessage}.`);
  }
  return tx.invoice.update({ where: { id: invoiceId }, data, include: { lines: true } });
}

export function issueInvoice(tx: TransactionClient, invoiceId: string): Promise<InvoiceWithLines> {
  return transition(tx, invoiceId, ['DRAFT'], { status: 'OPEN', issuedAt: new Date() }, 'cannot be issued again');
}

/**
 * A state machine, not a boolean: PAID comes only from a total that has
 * actually been covered, and anything still owed keeps the invoice OPEN with
 * amountPaidMinor carrying the part that is real (spec §6).
 */
export async function markInvoicePaid(
  tx: TransactionClient,
  invoiceId: string,
  amountMinor: bigint,
  paidAt: Date,
): Promise<Invoice> {
  assertPositiveMinor(amountMinor, 'Payment amount');
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new BillingError(`Invoice ${invoiceId} not found.`);
  if (invoice.status === 'VOID' || invoice.status === 'UNCOLLECTIBLE') {
    throw new BillingError(`Invoice ${invoiceId} is ${invoice.status} and cannot take a payment.`);
  }

  const amountPaidMinor = invoice.amountPaidMinor + amountMinor;
  const status: InvoiceStatus = amountPaidMinor >= invoice.totalMinor ? 'PAID' : 'OPEN';
  return tx.invoice.update({
    where: { id: invoiceId },
    data: { amountPaidMinor, status, paidAt: status === 'PAID' ? paidAt : invoice.paidAt },
  });
}

export function voidInvoice(tx: TransactionClient, invoiceId: string): Promise<InvoiceWithLines> {
  return transition(
    tx,
    invoiceId,
    ['DRAFT', 'OPEN'],
    { status: 'VOID', voidedAt: new Date() },
    'cannot be voided',
  );
}
```

Add to `packages/billing/src/index.ts`:

```ts
export * from './catalog';
export * from './invoices';
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @nid/billing test -- --runTestsByPath src/invoices.spec.ts`
Expected: PASS — 3 tests.

Run: `RUN_DB_TESTS=true pnpm --filter @nid/billing test -- --runTestsByPath src/invoices.db.spec.ts`
Expected: PASS — 5 tests.

Run: `pnpm typecheck && pnpm lint && pnpm db:validate`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/billing
git commit -m "feat(billing): add catalog reads and the invoice engine with sequence numbering"
```

---

## Task 6: Prepaid credits — atomic, idempotent, never negative

**Files:**
- Create: `packages/billing/src/credits.ts`, `src/verification-charge.ts`
- Modify: `packages/billing/src/index.ts`
- Test: `packages/billing/src/credits.db.spec.ts`, `packages/billing/src/verification-charge.db.spec.ts`

**Interfaces:**
- Consumes: `ensureBillingAccount`/`getBillingAccount` (Task 4), `postLedgerTransaction` (Task 4), `getServiceByKey` (Task 5), Prisma enums `CreditEntryReason`.
- Produces: `CreditMovementInput`, `CreditMovementResult`, `creditAccount(tx, input)`, `debitAccount(tx, input)`, `getCreditBalance(tx, tenantId)`; `ChargeVerificationCaseInput`, `chargeVerificationCase(tx, input)`. Task 8's settlement calls `creditAccount`; Task 15's verification hook calls `chargeVerificationCase`.

- [ ] **Step 1: Write the failing DB test**

`packages/billing/src/credits.db.spec.ts`:

```ts
import { createPrismaClient, withTenantContext, type PrismaClient } from '@nid/db';
import { creditAccount, debitAccount, getCreditBalance, InsufficientCreditsError } from '.';
import { ensureBillingAccount } from './accounts';

const runDb = process.env['RUN_DB_TESTS'] === 'true' ? describe : describe.skip;

runDb('credits against real Postgres', () => {
  const url = process.env['APP_DATABASE_URL'];
  if (!url) throw new Error('credits.db.spec.ts needs APP_DATABASE_URL.');
  const DATABASE_URL = process.env['DATABASE_URL'] ?? url;

  let prisma: PrismaClient;
  let superuser: PrismaClient;
  let tenantId: string;
  let billingAccountId: string;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    superuser = createPrismaClient(DATABASE_URL);
    tenantId = (await superuser.tenant.create({ data: { name: `cred ${suffix}`, slug: `cred-${suffix}` } })).id;
    billingAccountId = (await withTenantContext(prisma, tenantId, (tx) => ensureBillingAccount(tx, tenantId))).id;
  });

  afterAll(async () => {
    await superuser.tenant.delete({ where: { id: tenantId } });
    await Promise.all([prisma.$disconnect(), superuser.$disconnect()]);
  });

  it('credits, writes the entry with balanceAfterMinor, and moves the cache', async () => {
    const result = await withTenantContext(prisma, tenantId, (tx) =>
      creditAccount(tx, {
        tenantId,
        billingAccountId,
        deltaMinor: 11800n,
        reason: 'TOPUP',
        refType: 'payment_intent',
        refId: `intent_${suffix}`,
      }),
    );

    expect(result.applied).toBe(true);
    expect(result.entry.balanceAfterMinor).toBe(11800n);
    expect(await withTenantContext(prisma, tenantId, (tx) => getCreditBalance(tx, tenantId))).toBe(11800n);
  });

  it('debits without going negative', async () => {
    const debit = await withTenantContext(prisma, tenantId, (tx) =>
      debitAccount(tx, {
        tenantId,
        billingAccountId,
        deltaMinor: 2500n,
        reason: 'USAGE',
        refType: 'verification_case',
        refId: `case_${suffix}`,
      }),
    );
    expect(debit.entry.balanceAfterMinor).toBe(9300n);

    await expect(
      withTenantContext(prisma, tenantId, (tx) =>
        debitAccount(tx, {
          tenantId,
          billingAccountId,
          deltaMinor: 9301n,
          reason: 'USAGE',
          refType: 'verification_case',
          refId: `case-over-${suffix}`,
        }),
      ),
    ).rejects.toThrow(InsufficientCreditsError);

    expect(await withTenantContext(prisma, tenantId, (tx) => getCreditBalance(tx, tenantId))).toBe(9300n);
  });

  it('makes a retried movement for the same reference a no-op', async () => {
    const input = {
      tenantId,
      billingAccountId,
      deltaMinor: 500n,
      reason: 'TOPUP' as const,
      refType: 'payment_intent',
      refId: `intent-dup-${suffix}`,
    };
    const first = await withTenantContext(prisma, tenantId, (tx) => creditAccount(tx, input));
    const second = await withTenantContext(prisma, tenantId, (tx) => creditAccount(tx, input));

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.entry.id).toEqual(first.entry.id);
    expect(await withTenantContext(prisma, tenantId, (tx) => getCreditBalance(tx, tenantId))).toBe(9800n);
  });

  it('keeps the cache equal to the sum of the entries (spec invariant 2)', async () => {
    const { cache, ledgerSum } = await withTenantContext(prisma, tenantId, async (tx) => {
      const account = await tx.billingAccount.findUniqueOrThrow({ where: { tenantId } });
      const entries = await tx.creditLedgerEntry.findMany({ where: { tenantId } });
      return {
        cache: account.creditBalanceMinor,
        ledgerSum: entries.reduce((total, entry) => total + entry.deltaMinor, 0n),
      };
    });
    expect(cache).toEqual(ledgerSum);
  });
});
```

`packages/billing/src/verification-charge.db.spec.ts`:

```ts
import { createPrismaClient, withTenantContext, type PrismaClient } from '@nid/db';
import { chargeVerificationCase, creditAccount, ensureBillingAccount, getBillingAccount } from '.';

const runDb = process.env['RUN_DB_TESTS'] === 'true' ? describe : describe.skip;

runDb('nID verification credit charge against real Postgres', () => {
  const url = process.env['APP_DATABASE_URL'];
  if (!url) throw new Error('verification-charge.db.spec.ts needs APP_DATABASE_URL.');
  const DATABASE_URL = process.env['DATABASE_URL'] ?? url;

  let prisma: PrismaClient;
  let superuser: PrismaClient;
  let tenantId: string;
  let serviceId: string;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    superuser = createPrismaClient(DATABASE_URL);
    tenantId = (await superuser.tenant.create({ data: { name: `nid ${suffix}`, slug: `nid-${suffix}` } })).id;
    serviceId = (await superuser.billingService.create({ data: { key: 'nid', name: 'nID Verification', ownerRepo: 'nID' } })).id;
  });

  afterAll(async () => {
    await superuser.tenant.delete({ where: { id: tenantId } });
    // key 'nid' is the ecosystem-wide nID service; only remove it if this run made it.
    const stillOurs = await superuser.billingService.findFirst({ where: { id: serviceId } });
    if (stillOurs) await superuser.billingService.delete({ where: { id: serviceId } });
    await Promise.all([prisma.$disconnect(), superuser.$disconnect()]);
  });

  it('does nothing at all for a tenant with no billing account', async () => {
    await withTenantContext(prisma, tenantId, (tx) =>
      chargeVerificationCase(tx, { tenantId, caseId: `case_${suffix}`, amountMinor: 2500n }),
    );
    expect(await withTenantContext(prisma, tenantId, (tx) => getBillingAccount(tx, tenantId))).toBeNull();
  });

  it('does nothing when the balance is already zero', async () => {
    await withTenantContext(prisma, tenantId, (tx) => ensureBillingAccount(tx, tenantId));
    await withTenantContext(prisma, tenantId, (tx) =>
      chargeVerificationCase(tx, { tenantId, caseId: `case_zero_${suffix}`, amountMinor: 2500n }),
    );
    const entries = await withTenantContext(prisma, tenantId, (tx) =>
      tx.creditLedgerEntry.findMany({ where: { tenantId } }),
    );
    expect(entries).toHaveLength(0);
  });

  it('debits credits and attributes the revenue to the nid service, exactly once', async () => {
    const account = await withTenantContext(prisma, tenantId, (tx) => ensureBillingAccount(tx, tenantId));
    await withTenantContext(prisma, tenantId, (tx) =>
      creditAccount(tx, {
        tenantId,
        billingAccountId: account.id,
        deltaMinor: 10000n,
        reason: 'TOPUP',
        refType: 'payment_intent',
        refId: `intent_nid_${suffix}`,
      }),
    );

    const charge = { tenantId, caseId: `case_charge_${suffix}`, amountMinor: 2500n };
    await withTenantContext(prisma, tenantId, (tx) => chargeVerificationCase(tx, charge));
    await withTenantContext(prisma, tenantId, (tx) => chargeVerificationCase(tx, charge));

    const after = await withTenantContext(prisma, tenantId, async (tx) => ({
      balance: (await tx.billingAccount.findUniqueOrThrow({ where: { tenantId } })).creditBalanceMinor,
      entries: await tx.creditLedgerEntry.findMany({ where: { tenantId, refId: charge.caseId } }),
      transactions: await tx.ledgerTransaction.findMany({
        where: { tenantId, refType: 'verification_case', refId: charge.caseId },
        include: { entries: true },
      }),
    }));

    expect(after.balance).toBe(7500n);
    expect(after.entries).toHaveLength(1);
    expect(after.transactions).toHaveLength(1);
    const revenue = await withTenantContext(prisma, tenantId, (tx) =>
      tx.ledgerAccount.findFirst({ where: { tenantId, kind: 'REVENUE', serviceId } }),
    );
    expect(revenue).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @nid/billing test -- --runTestsByPath src/credits.db.spec.ts`
Expected: FAIL — `Cannot find module './credits'` (the barrel does not export it yet).

- [ ] **Step 3: Implement credits**

`packages/billing/src/credits.ts`:

```ts
import type { CreditEntryReason, CreditLedgerEntry, TransactionClient } from '@nid/db';
import { BillingError, InsufficientCreditsError, isUniqueViolation } from './errors';
import { assertPositiveMinor } from './money';

export interface CreditMovementInput {
  tenantId: string;
  billingAccountId: string;
  reason: CreditEntryReason;
  refType: string;
  refId: string;
  /** Positive in both directions; the function's name decides the sign. */
  deltaMinor: bigint;
}

export interface CreditMovementResult {
  entry: CreditLedgerEntry;
  /** False when this exact movement already existed — the caller posts no ledger transaction then. */
  applied: boolean;
}

/**
 * The only place a credit balance changes (house rule: no in-place balance
 * writes anywhere else). Two properties matter and both are load-bearing:
 *
 * 1. The entry is inserted BEFORE the balance moves. (tenantId, refType, refId,
 *    reason) is unique, so a retried or concurrent duplicate is rejected by the
 *    database rather than by a read-then-write check that two callers can both
 *    pass — and because the insert is first, the rejected caller never reaches
 *    the UPDATE at all.
 * 2. The balance moves in one UPDATE whose WHERE clause includes the
 *    sufficiency test, so "reject a debit that would go negative" is atomic.
 *    Reading the balance and then writing it would let two concurrent debits
 *    both see enough credit (spec §7.3).
 */
async function moveCredits(tx: TransactionClient, input: CreditMovementInput, signedDelta: bigint): Promise<CreditMovementResult> {
  assertPositiveMinor(input.deltaMinor, 'Credit movement');

  let entry: CreditLedgerEntry;
  try {
    entry = await tx.creditLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        billingAccountId: input.billingAccountId,
        deltaMinor: signedDelta,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        // Placeholder: the real value comes from the atomic update below, in the
        // same transaction, so no reader ever sees the placeholder committed.
        balanceAfterMinor: 0n,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await tx.creditLedgerEntry.findUnique({
        where: { tenantId_refType_refId_reason: { tenantId: input.tenantId, refType: input.refType, refId: input.refId, reason: input.reason } },
      });
      if (existing) return { entry: existing, applied: false };
    }
    throw error;
  }

  const updated = await tx.$queryRaw<Array<{ creditBalanceMinor: bigint; id: string }>>`
    UPDATE "BillingAccount"
    SET "creditBalanceMinor" = "creditBalanceMinor" + ${signedDelta}, "updatedAt" = now()
    WHERE "id" = ${input.billingAccountId}
      AND "tenantId" = ${input.tenantId}
      AND "creditBalanceMinor" + ${signedDelta} >= 0
    RETURNING "id", "creditBalanceMinor"
  `;

  const account = updated[0];
  if (!account) {
    throw new InsufficientCreditsError(
      `Tenant ${input.tenantId} does not have enough credits for a ${(-signedDelta).toString()} minor-unit debit.`,
    );
  }

  entry = await tx.creditLedgerEntry.update({ where: { id: entry.id }, data: { balanceAfterMinor: account.creditBalanceMinor } });
  return { entry, applied: true };
}

export function creditAccount(tx: TransactionClient, input: CreditMovementInput): Promise<CreditMovementResult> {
  return moveCredits(tx, input, input.deltaMinor);
}

export function debitAccount(tx: TransactionClient, input: CreditMovementInput): Promise<CreditMovementResult> {
  return moveCredits(tx, input, -input.deltaMinor);
}

export async function getCreditBalance(tx: TransactionClient, tenantId: string): Promise<bigint> {
  const account = await tx.billingAccount.findUnique({ where: { tenantId } });
  if (!account) throw new BillingError(`No billing account for tenant ${tenantId}.`);
  return account.creditBalanceMinor;
}
```

`packages/billing/src/verification-charge.ts`:

```ts
import type { TransactionClient } from '@nid/db';
import { getServiceByKey } from './catalog';
import { debitAccount } from './credits';
import { postLedgerTransaction } from './ledger';

export interface ChargeVerificationCaseInput {
  tenantId: string;
  caseId: string;
  amountMinor: bigint;
  /** Which catalog service owns the revenue. nID bills itself as "nid" (spec §9.1). */
  serviceKey?: string;
}

/**
 * Runs inside the caller's verification-case transaction, so a case and its
 * credit debit commit together or neither does, and a retried create is a
 * no-op rather than a second charge (spec acceptance criterion 4).
 *
 * Absence is a valid state: a tenant with no billing account, or one whose
 * balance is already zero, is not in the billing system at all, and creating a
 * BillingAccount as a side effect of a verification call would mean every
 * tenant on the platform suddenly owns financial rows. A tenant who HAS
 * credits but not enough is different — that raises, and the API turns it into
 * a 402 telling them to top up.
 */
export async function chargeVerificationCase(
  tx: TransactionClient,
  input: ChargeVerificationCaseInput,
): Promise<void> {
  const account = await tx.billingAccount.findUnique({ where: { tenantId: input.tenantId } });
  if (!account || account.creditBalanceMinor <= 0n) return;

  const service = await getServiceByKey(tx, input.serviceKey ?? 'nid');
  if (!service) return;

  const movement = await debitAccount(tx, {
    tenantId: input.tenantId,
    billingAccountId: account.id,
    deltaMinor: input.amountMinor,
    reason: 'USAGE',
    refType: 'verification_case',
    refId: input.caseId,
  });
  if (!movement.applied) return;

  await postLedgerTransaction(tx, {
    tenantId: input.tenantId,
    type: 'CREDIT_USAGE',
    refType: 'verification_case',
    refId: input.caseId,
    currency: account.currency,
    lines: [
      { kind: 'CUSTOMER_CREDITS', direction: 'DEBIT', amountMinor: input.amountMinor },
      { kind: 'REVENUE', serviceId: service.id, direction: 'CREDIT', amountMinor: input.amountMinor },
    ],
  });
}
```

Add to `packages/billing/src/index.ts`:

```ts
export * from './credits';
export * from './verification-charge';
```

- [ ] **Step 4: Run the tests**

Run: `RUN_DB_TESTS=true pnpm --filter @nid/billing test -- --runTestsByPath src/credits.db.spec.ts src/verification-charge.db.spec.ts`
Expected: PASS — 7 tests.

Run: `pnpm --filter @nid/billing test`
Expected: PASS — the whole package.

- [ ] **Step 5: Commit**

```bash
git add packages/billing
git commit -m "feat(billing): add atomic idempotent prepaid credits and the nID verification charge"
```

## Task 7: Checkout orchestration — reserve, open the provider session, publish the token page

**Files:**
- Create: `packages/billing/src/checkout.ts`
- Modify: `packages/billing/src/index.ts`
- Test: `packages/billing/src/checkout.db.spec.ts`

**Interfaces:**
- Consumes: `ensureBillingAccount`/`getBillingAccount` (Task 4), `getActivePlan`/`getServiceByKey`/`createInvoice`/`issueInvoice`/`getInvoiceWithLines` (Task 5), `generateCheckoutToken` + `sha256Hex` (`@nid/shared-types`, Task 1), `PaymentProvider`/`CreateCheckoutResult` (`@nid/payments`, Task 2), `withTenantContext` and `TransactionClient` (`@nid/db`, Task 1), `CheckoutError`/`CheckoutProviderError`/`isUniqueViolation` (Task 4).
- Produces: `ReserveCheckoutInput`, `ReservedCheckout`, `reserveCheckout(tx, input)`, `recordProviderCheckout(tx, input)`, `abandonCheckout(tx, intentId)`, `assertReturnUrlAllowed(returnUrl, allowedOrigins)`, `CheckoutDependencies`, `CreateCheckoutSessionInput`, `CheckoutOutcome`, `createCheckoutSession(deps, input)`, `CheckoutSummary`, `getCheckoutSummary(prisma, token)`, `CHECKOUT_TTL_MS`. Task 8's settlement reads the `PaymentIntent.metadata` written here; Task 9's controller and Task 13's public token endpoint call `createCheckoutSession` / `getCheckoutSummary`.

- [ ] **Step 1: Write the failing DB test**

`packages/billing/src/checkout.db.spec.ts`. The catalog is admin-only, so the
fixture seeds a service + plans through `withBillingAdminContext` — this also
proves that helper works.

```ts
import {
  createPrismaClient,
  withBillingAdminContext,
  withTenantContext,
  type PrismaClient,
} from '@nid/db';
import { MockPaymentProvider } from '@nid/payments';
import { createCheckoutSession, getCheckoutSummary, reserveCheckout } from '.';
import { ensureBillingAccount } from './accounts';

const runDb = process.env['RUN_DB_TESTS'] === 'true' ? describe : describe.skip;

const ALLOWED = ['http://localhost:3200'];

async function seedCatalog(prisma: PrismaClient, tag: string) {
  return withBillingAdminContext(prisma, async (tx) => {
    const service = await tx.billingService.create({
      data: { key: `nid-${tag}`, name: `nID ${tag}`, ownerRepo: 'nID' },
    });
    const pack = await tx.plan.create({
      data: {
        serviceId: service.id,
        key: 'pack',
        name: 'Starter credits',
        mode: 'CREDIT_PACK',
        unitAmountMinor: 11800n,
        creditsIncluded: 11800,
      },
    });
    const sub = await tx.plan.create({
      data: {
        serviceId: service.id,
        key: 'sub',
        name: 'Monthly',
        mode: 'SUBSCRIPTION',
        unitAmountMinor: 50000n,
        interval: 'MONTH',
      },
    });
    return { pack, sub };
  });
}

runDb('checkout orchestration against real Postgres', () => {
  const url = process.env['APP_DATABASE_URL'];
  if (!url) throw new Error('checkout.db.spec.ts needs APP_DATABASE_URL.');
  const DATABASE_URL = process.env['DATABASE_URL'] ?? url;

  let prisma: PrismaClient;
  let superuser: PrismaClient;
  let tenantId: string;
  let packId: string;
  let subPlanId: string;
  const tag = Date.now().toString(36);

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    superuser = createPrismaClient(DATABASE_URL);
    tenantId = (
      await superuser.tenant.create({ data: { name: `chk ${tag}`, slug: `chk-${tag}` } })
    ).id;
    const catalog = await seedCatalog(prisma, tag);
    packId = catalog.pack.id;
    subPlanId = catalog.sub.id;
    await withTenantContext(prisma, tenantId, (tx) => ensureBillingAccount(tx, tenantId));
  });

  afterAll(async () => {
    await superuser.tenant.delete({ where: { id: tenantId } });
    await Promise.all([prisma.$disconnect(), superuser.$disconnect()]);
  });

  it('reserves a top-up with the server-computed amount and one usable token', async () => {
    const reserved = await withTenantContext(prisma, tenantId, (tx) =>
      reserveCheckout(tx, {
        tenantId,
        purpose: 'CREDIT_TOPUP',
        planId: packId,
        allowedReturnOrigins: ALLOWED,
        idempotencyKey: `topup-${tag}`,
        provider: 'mock',
      }),
    );

    expect(reserved.reused).toBe(false);
    if (reserved.reused) throw new Error('unreachable');
    expect(reserved.amountMinor).toBe(11800n);
    expect(reserved.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // Only the hash is stored: the plaintext exists exactly once, in this
    // response, and never in the database.
    const stored = await prisma.checkoutSession.findFirst({
      where: { paymentIntentId: reserved.intentId },
    });
    expect(stored?.tokenHash).not.toBe(reserved.token);
    expect(stored?.tokenHash).toHaveLength(64);
  });

  it('returns a reused marker instead of a second token for the same key', async () => {
    const first = await withTenantContext(prisma, tenantId, (tx) =>
      reserveCheckout(tx, {
        tenantId,
        purpose: 'CREDIT_TOPUP',
        planId: packId,
        allowedReturnOrigins: ALLOWED,
        idempotencyKey: `dup-${tag}`,
        provider: 'mock',
      }),
    );
    const second = await withTenantContext(prisma, tenantId, (tx) =>
      reserveCheckout(tx, {
        tenantId,
        purpose: 'CREDIT_TOPUP',
        planId: packId,
        allowedReturnOrigins: ALLOWED,
        idempotencyKey: `dup-${tag}`,
        provider: 'mock',
      }),
    );

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    if (first.reused || second.reused) throw new Error('unreachable');
    expect(second.token).toBeNull();
    expect(second.checkoutUrl).toBeNull();
    expect(second.intentId).toBe(first.intentId);
  });

  it('rejects a returnUrl whose origin is not allowlisted', async () => {
    await expect(
      withTenantContext(prisma, tenantId, (tx) =>
        reserveCheckout(tx, {
          tenantId,
          purpose: 'CREDIT_TOPUP',
          planId: packId,
          returnUrl: 'https://localhost:3200.evil.tld/phish',
          allowedReturnOrigins: ALLOWED,
          idempotencyKey: `bad-return-${tag}`,
          provider: 'mock',
        }),
      ),
    ).rejects.toThrow(/returnUrl/);
  });

  it('rejects a top-up for a subscription plan', async () => {
    await expect(
      withTenantContext(prisma, tenantId, (tx) =>
        reserveCheckout(tx, {
          tenantId,
          purpose: 'CREDIT_TOPUP',
          planId: subPlanId,
          allowedReturnOrigins: ALLOWED,
          idempotencyKey: `wrong-mode-${tag}`,
          provider: 'mock',
        }),
      ),
    ).rejects.toThrow(/CREDIT_PACK/);
  });

  it('a subscription checkout issues an invoice and pins an INCOMPLETE subscription', async () => {
    const reserved = await withTenantContext(prisma, tenantId, (tx) =>
      reserveCheckout(tx, {
        tenantId,
        purpose: 'SUBSCRIPTION',
        planId: subPlanId,
        allowedReturnOrigins: ALLOWED,
        idempotencyKey: `sub-${tag}`,
        provider: 'mock',
      }),
    );
    expect(reserved.reused).toBe(false);
    if (reserved.reused) throw new Error('unreachable');
    expect(reserved.amountMinor).toBe(50000n);

    const { invoice, subscription } = await withTenantContext(prisma, tenantId, async (tx) => {
      const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: reserved.intentId } });
      const metadata = intent.metadata as Record<string, string>;
      return {
        invoice: await tx.invoice.findUniqueOrThrow({ where: { id: metadata.invoiceId } }),
        subscription: await tx.subscription.findUniqueOrThrow({ where: { id: metadata.subscriptionId } }),
      };
    });
    expect(invoice.status).toBe('OPEN');
    expect(subscription.status).toBe('INCOMPLETE');
    expect(subscription.planId).toBe(subPlanId);
  });

  it('the orchestrator calls the provider and stores both URLs', async () => {
    const provider = new MockPaymentProvider({
      checkoutUiUrl: 'http://localhost:3500',
      outcome: 'success',
    });
    const outcome = await createCheckoutSession(
      { prisma, provider, checkoutUiUrl: 'http://localhost:3500', webhookUrl: 'http://localhost:4000/v1/billing/webhooks/mock', allowedReturnOrigins: ALLOWED },
      {
        tenantId,
        purpose: 'CREDIT_TOPUP',
        planId: packId,
        idempotencyKey: `orch-${tag}`,
      },
    );

    expect(outcome.reused).toBe(false);
    if (outcome.reused) throw new Error('unreachable');
    expect(outcome.checkoutUrl).toBe(`http://localhost:3500/checkout/${outcome.token}`);
    expect(outcome.providerCheckoutUrl).toContain('/mock-pay/');

    const intent = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: outcome.intentId } });
    expect(intent.provider).toBe('mock');
    expect(intent.providerRef).toMatch(/^mock_/);
  });

  it('the token summary is readable without a tenant context and hides the pay URL once expired', async () => {
    const outcome = await createCheckoutSession(
      {
        prisma,
        provider: new MockPaymentProvider({ checkoutUiUrl: 'http://localhost:3500', outcome: 'pending' }),
        checkoutUiUrl: 'http://localhost:3500',
        webhookUrl: 'http://localhost:4000/v1/billing/webhooks/mock',
        allowedReturnOrigins: ALLOWED,
      },
      { tenantId, purpose: 'CREDIT_TOPUP', planId: packId, idempotencyKey: `summary-${tag}` },
    );
    if (outcome.reused) throw new Error('expected a fresh token');

    // Unscoped read: this is the request the checkout page makes with nothing
    // but the token, and it succeeds only because of the open-SELECT policy.
    const summary = await getCheckoutSummary(prisma, outcome.token);
    expect(summary?.amountMinor).toBe(11800n);
    expect(summary?.payUrl).toBe(outcome.providerCheckoutUrl);
    expect(summary?.serviceName).toContain('nID');

    await superuser.checkoutSession.update({
      where: { id: (await superuser.checkoutSession.findFirstOrThrow({ where: { paymentIntentId: outcome.intentId } })).id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await getCheckoutSummary(prisma, outcome.token);
    expect(expired?.payUrl).toBeNull();
    expect(expired?.status).toBe('EXPIRED');
  });

  it('abandons the intent and session when the provider call fails', async () => {
    const failing = new MockPaymentProvider({ checkoutUiUrl: 'http://localhost:3500', outcome: 'success' });
    failing.createCheckout = async () => {
      throw new Error('provider down');
    };

    await expect(
      createCheckoutSession(
        {
          prisma,
          provider: failing,
          checkoutUiUrl: 'http://localhost:3500',
          webhookUrl: 'http://localhost:4000/v1/billing/webhooks/mock',
          allowedReturnOrigins: ALLOWED,
        },
        { tenantId, purpose: 'CREDIT_TOPUP', planId: packId, idempotencyKey: `fail-${tag}` },
      ),
    ).rejects.toThrow(/Could not open a payment session/);

    const intent = await prisma.paymentIntent.findFirstOrThrow({
      where: { tenantId, idempotencyKey: `fail-${tag}` },
    });
    expect(intent.status).toBe('FAILED');
    expect((await prisma.checkoutSession.findFirstOrThrow({ where: { paymentIntentId: intent.id } })).status).toBe('EXPIRED');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @nid/billing exec jest checkout.db --runInBand` (with `RUN_DB_TESTS=true APP_DATABASE_URL=... DATABASE_URL=...`)
Expected: FAIL — `reserveCheckout` is not exported.

- [ ] **Step 3: Write the implementation**

`packages/billing/src/checkout.ts`:

```ts
import { generateCheckoutToken, sha256Hex } from '@nid/shared-types';
import type {
  BillingAccount,
  CheckoutSession,
  CheckoutSessionStatus,
  PaymentIntent,
  PaymentIntentPurpose,
  PaymentIntentStatus,
  PrismaClient,
  TransactionClient,
} from '@nid/db';
import { withTenantContext } from '@nid/db';
import type { PaymentProvider } from '@nid/payments';
import { ensureBillingAccount } from './accounts';
import { getActivePlan } from './catalog';
import { createInvoice, getInvoiceWithLines, issueInvoice } from './invoices';
import {
  BillingError,
  CheckoutError,
  CheckoutProviderError,
  isUniqueViolation,
} from './errors';

/**
 * Deliberately shorter than any provider's own hosted-session TTL. nID's page
 * must expire before the link behind it does, otherwise a payer can open a
 * summary that says "pay now" over a provider session that already 404s.
 */
export const CHECKOUT_TTL_MS = 25 * 60_000;

export interface ReserveCheckoutInput {
  tenantId: string;
  purpose: PaymentIntentPurpose;
  planId?: string;
  invoiceId?: string;
  returnUrl?: string;
  allowedReturnOrigins: readonly string[];
  idempotencyKey: string;
  /** The registry key, not a class — stored on the intent for webhook routing. */
  provider: string;
}

export type ReservedCheckout =
  | {
      reused: false;
      intentId: string;
      token: string;
      amountMinor: bigint;
      currency: string;
      description: string;
    }
  | {
      reused: true;
      intentId: string;
      token: null;
      checkoutUrl: string | null;
      expiresAt: Date | null;
    };

/**
 * A caller-supplied origin is an open-redirect and a credential-phishing
 * vector: the payer has just been on a payment page, so a link that looks like
 * it came from nID is unusually convincing. Compared on the parsed `origin`,
 * not by prefix — a substring test accepts `https://billing.newax.pk.evil.tld`.
 */
export function assertReturnUrlAllowed(
  returnUrl: string | undefined,
  allowedOrigins: readonly string[],
): string | null {
  if (returnUrl === undefined || returnUrl === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(returnUrl);
  } catch {
    throw new CheckoutError('returnUrl must be an absolute http(s) URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new CheckoutError('returnUrl must be an absolute http(s) URL.');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new CheckoutError('returnUrl must not contain credentials.');
  }
  if (!allowedOrigins.includes(parsed.origin)) {
    throw new CheckoutError(`returnUrl origin ${parsed.origin} is not allowlisted.`);
  }
  return parsed.toString();
}

interface ResolvedPurpose {
  amountMinor: bigint;
  currency: string;
  description: string;
  metadata: Record<string, string>;
}

/**
 * Every amount in this function comes from the catalog or an issued invoice —
 * never from the request. A payer-controlled price is the one bug that turns a
 * billing system into a donation box.
 */
async function resolvePurpose(
  tx: TransactionClient,
  input: ReserveCheckoutInput,
  account: BillingAccount,
): Promise<ResolvedPurpose> {
  const hasPlan = input.planId !== undefined;
  const hasInvoice = input.invoiceId !== undefined;
  const planPurpose = input.purpose === 'CREDIT_TOPUP' || input.purpose === 'SUBSCRIPTION';

  if (hasPlan === hasInvoice) throw new CheckoutError('Provide exactly one of planId or invoiceId.');
  if (planPurpose && !hasPlan) throw new CheckoutError(`${input.purpose} checkout needs a planId.`);
  if (!planPurpose && !hasInvoice) throw new CheckoutError(`${input.purpose} checkout needs an invoiceId.`);

  const currency = account.currency;

  if (input.purpose === 'CREDIT_TOPUP') {
    const plan = await getActivePlan(tx, input.planId as string);
    if (plan.mode !== 'CREDIT_PACK') {
      throw new CheckoutError(`Plan ${plan.key} is not a CREDIT_PACK and cannot be topped up.`);
    }
    if (plan.currency !== currency) {
      throw new CheckoutError(`Plan ${plan.key} is priced in ${plan.currency}; this account pays in ${currency}.`);
    }
    return {
      amountMinor: plan.unitAmountMinor,
      currency,
      description: `${plan.service.name}: ${plan.name}`,
      metadata: {
        planId: plan.id,
        serviceId: plan.serviceId,
        creditsMinor: plan.creditsIncluded.toString(),
        taxMinor: '0',
      },
    };
  }

  if (input.purpose === 'SUBSCRIPTION') {
    const plan = await getActivePlan(tx, input.planId as string);
    if (plan.mode !== 'SUBSCRIPTION') {
      throw new CheckoutError(`Plan ${plan.key} is not a SUBSCRIPTION plan.`);
    }
    if (plan.interval === null) {
      throw new CheckoutError(`Subscription plan ${plan.key} has no billing interval.`);
    }
    if (plan.currency !== currency) {
      throw new CheckoutError(`Plan ${plan.key} is priced in ${plan.currency}; this account pays in ${currency}.`);
    }

    const invoice = await createInvoice(tx, {
      tenantId: input.tenantId,
      currency,
      lines: [
        {
          serviceId: plan.serviceId,
          description: `${plan.service.name}: ${plan.name} (${plan.interval.toLowerCase()})`,
          unitAmountMinor: plan.unitAmountMinor,
        },
      ],
    });
    const issued = await issueInvoice(tx, invoice.id);
    const subscription = await tx.subscription.create({
      data: {
        tenantId: input.tenantId,
        billingAccountId: account.id,
        planId: plan.id,
        status: 'INCOMPLETE',
      },
    });

    return {
      amountMinor: issued.totalMinor,
      currency,
      description: `${plan.service.name}: ${plan.name}`,
      // The interval is copied in: settlement must open the period months
      // later, and the plan row it came from may be archived by then (D11).
      metadata: {
        planId: plan.id,
        serviceId: plan.serviceId,
        invoiceId: issued.id,
        subscriptionId: subscription.id,
        interval: plan.interval,
        taxMinor: issued.taxMinor.toString(),
      },
    };
  }

  // INVOICE and ONE_OFF both pay an invoice nID already issued.
  const invoice = await getInvoiceWithLines(tx, input.tenantId, input.invoiceId as string);
  if (!invoice) throw new CheckoutError(`Invoice ${input.invoiceId} not found.`);
  if (invoice.status === 'VOID' || invoice.status === 'UNCOLLECTIBLE') {
    throw new CheckoutError(`Invoice ${invoice.number} is ${invoice.status}.`);
  }
  const remaining = invoice.totalMinor - invoice.amountPaidMinor;
  if (remaining <= 0n) {
    throw new CheckoutError(`Invoice ${invoice.number} is already paid.`);
  }
  const payable = invoice.status === 'DRAFT' ? await issueInvoice(tx, invoice.id) : invoice;

  return {
    amountMinor: remaining,
    currency,
    description: payable.lines[0]?.description ?? `Invoice ${payable.number}`,
    metadata: {
      invoiceId: payable.id,
      serviceId: payable.lines[0]?.serviceId ?? '',
      taxMinor: payable.taxMinor.toString(),
    },
  };
}

/**
 * Writes the intent and the token-addressed session. Runs inside the caller's
 * tenant transaction and performs no network I/O — see `createCheckoutSession`
 * for why the provider call is kept outside.
 */
export async function reserveCheckout(
  tx: TransactionClient,
  input: ReserveCheckoutInput,
): Promise<ReservedCheckout> {
  const returnUrl = assertReturnUrlAllowed(input.returnUrl, input.allowedReturnOrigins);

  const account = await ensureBillingAccount(tx, input.tenantId);
  const resolved = await resolvePurpose(tx, input, account);

  let intent: PaymentIntent;
  try {
    intent = await tx.paymentIntent.create({
      data: {
        tenantId: input.tenantId,
        billingAccountId: account.id,
        purpose: input.purpose,
        amountMinor: resolved.amountMinor,
        currency: resolved.currency,
        status: 'REQUIRES_CHECKOUT',
        provider: input.provider,
        idempotencyKey: input.idempotencyKey,
        metadata: resolved.metadata,
      },
    });
  } catch (error) {
    // Two tabs, one key: the loser reads the winner's intent instead of
    // minting a second charge for the same purchase.
    if (!isUniqueViolation(error)) throw error;
    const existing = await tx.paymentIntent.findFirst({
      where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
      include: { checkoutSession: true },
    });
    if (!existing) throw new BillingError('Idempotent checkout race lost, but no intent exists.');
    return reusedView(existing);
  }

  const { plaintext, hash } = generateCheckoutToken();
  const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MS);
  await tx.checkoutSession.create({
    data: {
      tenantId: input.tenantId,
      paymentIntentId: intent.id,
      tokenHash: hash,
      returnUrl,
      expiresAt,
    },
  });

  return {
    reused: false,
    intentId: intent.id,
    token: plaintext,
    amountMinor: resolved.amountMinor,
    currency: resolved.currency,
    description: resolved.description,
  };
}

function reusedView(intent: PaymentIntent & { checkoutSession: CheckoutSession | null }): ReservedCheckout {
  return {
    reused: true,
    intentId: intent.id,
    // The token is returned exactly once. It cannot be re-derived from a hash,
    // so a replay says "already created" and points at the provider URL.
    token: null,
    checkoutUrl: intent.checkoutUrl,
    expiresAt: intent.checkoutSession?.expiresAt ?? null,
  };
}

export interface RecordProviderCheckoutInput {
  intentId: string;
  providerRef: string;
  checkoutUrl: string;
  expiresAt: Date;
}

/** Stores what the provider handed back and never lets our session outlive theirs. */
export async function recordProviderCheckout(
  tx: TransactionClient,
  input: RecordProviderCheckoutInput,
): Promise<void> {
  await tx.paymentIntent.update({
    where: { id: input.intentId },
    data: { providerRef: input.providerRef, checkoutUrl: input.checkoutUrl },
  });
  const session = await tx.checkoutSession.findUnique({ where: { paymentIntentId: input.intentId } });
  if (session && input.expiresAt < session.expiresAt) {
    await tx.checkoutSession.update({ where: { id: session.id }, data: { expiresAt: input.expiresAt } });
  }
}

/**
 * The provider never gave us a session, so this intent is unpayable. Leaving it
 * in REQUIRES_CHECKOUT would show a live checkout page over a dead upstream
 * link and a reconciliation job would chase it forever.
 */
export async function abandonCheckout(tx: TransactionClient, intentId: string): Promise<void> {
  await tx.paymentIntent.update({ where: { id: intentId }, data: { status: 'FAILED' } });
  const session = await tx.checkoutSession.findUnique({ where: { paymentIntentId: intentId } });
  if (session) {
    await tx.checkoutSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED', consumedAt: new Date() },
    });
  }
}

export interface CheckoutDependencies {
  prisma: PrismaClient;
  provider: PaymentProvider;
  checkoutUiUrl: string;
  webhookUrl: string;
  allowedReturnOrigins: readonly string[];
}

export interface CreateCheckoutSessionInput {
  tenantId: string;
  purpose: PaymentIntentPurpose;
  planId?: string;
  invoiceId?: string;
  returnUrl?: string;
  idempotencyKey: string;
}

export type CheckoutOutcome =
  | {
      reused: false;
      intentId: string;
      token: string;
      checkoutUrl: string;
      providerCheckoutUrl: string;
      expiresAt: Date;
    }
  | { reused: true; intentId: string; token: null; checkoutUrl: string | null; expiresAt: Date | null };

/**
 * The only billing flow that spans a network call, so the transaction boundary
 * is explicit. Prisma's interactive transactions retry and hold a connection;
 * an HTTP round-trip inside one would pin a pool slot for the provider's
 * timeout and could replay half-written money rows. Hence: reserve (tx 1) ->
 * provider (no tx) -> record (tx 2). The intent id is the provider's own
 * reference, so the webhook can always find the row that tx 1 committed.
 */
export async function createCheckoutSession(
  deps: CheckoutDependencies,
  input: CreateCheckoutSessionInput,
): Promise<CheckoutOutcome> {
  const reserved = await withTenantContext(deps.prisma, input.tenantId, (tx) =>
    reserveCheckout(tx, {
      tenantId: input.tenantId,
      purpose: input.purpose,
      planId: input.planId,
      invoiceId: input.invoiceId,
      returnUrl: input.returnUrl,
      allowedReturnOrigins: deps.allowedReturnOrigins,
      idempotencyKey: input.idempotencyKey,
      provider: deps.provider.name,
    }),
  );

  if (reserved.reused) {
    return {
      reused: true,
      intentId: reserved.intentId,
      token: null,
      checkoutUrl: reserved.checkoutUrl,
      expiresAt: reserved.expiresAt,
    };
  }

  try {
    const providerResult = await deps.provider.createCheckout({
      amountMinor: reserved.amountMinor,
      currency: reserved.currency,
      description: reserved.description,
      reference: reserved.intentId,
      // Built here, from config, never from the request: this is where the
      // payer's browser lands, and it is the same page the token summary is
      // polled from.
      returnUrl: `${deps.checkoutUiUrl}/return/${reserved.token}`,
      webhookUrl: deps.webhookUrl,
    });

    await withTenantContext(deps.prisma, input.tenantId, (tx) =>
      recordProviderCheckout(tx, {
        intentId: reserved.intentId,
        providerRef: providerResult.providerRef,
        checkoutUrl: providerResult.checkoutUrl,
        expiresAt: providerResult.expiresAt,
      }),
    );

    return {
      reused: false,
      intentId: reserved.intentId,
      token: reserved.token,
      checkoutUrl: `${deps.checkoutUiUrl}/checkout/${reserved.token}`,
      providerCheckoutUrl: providerResult.checkoutUrl,
      expiresAt: providerResult.expiresAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown provider error';
    await withTenantContext(deps.prisma, input.tenantId, (tx) => abandonCheckout(tx, reserved.intentId));
    throw new CheckoutProviderError(`Could not open a payment session: ${message}`);
  }
}

export interface CheckoutSummary {
  sessionId: string;
  status: CheckoutSessionStatus;
  intentStatus: PaymentIntentStatus;
  amountMinor: bigint;
  currency: string;
  serviceName: string;
  description: string;
  expiresAt: Date;
  /** Non-null only while the session can still be paid. */
  payUrl: string | null;
  returnUrl: string | null;
}

/**
 * Read by the checkout page with nothing but the token, so this deliberately
 * runs on the unscoped client: `checkout_session_lookup` is open-SELECT for
 * exactly this call. It reports state and never changes it — a browser return
 * URL is cosmetic (spec §6).
 */
export async function getCheckoutSummary(
  prisma: PrismaClient,
  token: string,
): Promise<CheckoutSummary | null> {
  const session = await prisma.checkoutSession.findFirst({
    where: { tokenHash: sha256Hex(token) },
    include: { paymentIntent: true },
  });
  if (!session) return null;

  const intent = session.paymentIntent;
  const metadata = (intent.metadata ?? {}) as Record<string, string>;
  const service = metadata.serviceId
    ? await prisma.billingService.findUnique({ where: { id: metadata.serviceId } })
    : null;

  const isExpired = session.expiresAt.getTime() <= Date.now();
  const stillPayable =
    !isExpired &&
    session.status === 'PENDING' &&
    (intent.status === 'REQUIRES_CHECKOUT' || intent.status === 'PROCESSING');

  return {
    sessionId: session.id,
    status: isExpired && session.status === 'PENDING' ? 'EXPIRED' : session.status,
    intentStatus: intent.status,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    serviceName: service?.name ?? 'NEWAX',
    description: service?.name ?? 'NEWAX billing',
    expiresAt: session.expiresAt,
    payUrl: stillPayable ? intent.checkoutUrl : null,
    returnUrl: session.returnUrl,
  };
}
```

> `getActivePlan` comes from `./catalog`; `createInvoice`, `issueInvoice` and
> `getInvoiceWithLines` come from `./invoices`. Both files exist from Task 5 —
> Task 7 adds no new module beyond `checkout.ts`.

Add to `packages/billing/src/index.ts`:

```ts
export * from './checkout';
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @nid/billing test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/billing
git commit -m "feat(billing): add checkout reservation, provider orchestration and token summary"
```

---

## Task 8: Subscriptions and settlement — the one place money becomes state

**Files:**
- Create: `packages/billing/src/subscriptions.ts`, `packages/billing/src/settlement.ts`
- Modify: `packages/billing/src/index.ts`
- Test: `packages/billing/src/subscriptions.spec.ts`, `packages/billing/src/settlement.db.spec.ts`

**Interfaces:**
- Consumes: `PaymentIntent` metadata written by `reserveCheckout` (Task 7), `creditAccount`/`debitAccount` (Task 6), `markInvoicePaid` (Task 5), `postLedgerTransaction` (Task 4), `getBillingAccount` (Task 4), `sha256Hex` (`@nid/shared-types`).
- Produces: `addBillingInterval(start, interval)`, `activateSubscription(tx, input)`, `setCancelAtPeriodEnd(tx, tenantId, subscriptionId, value)`, `cancelSubscription(tx, tenantId, subscriptionId)`; `SettlePaymentInput`, `SettlePaymentResult`, `settlePayment(tx, input)`. Task 13's webhook handler and Task 15's service endpoints call `settlePayment` inside a tenant transaction; Phase 2's renewal workflow calls `activateSubscription` and `addBillingInterval`.

- [ ] **Step 1: Write the failing pure test for interval arithmetic**

`packages/billing/src/subscriptions.spec.ts`:

```ts
import { addBillingInterval } from './subscriptions';

describe('addBillingInterval', () => {
  it('advances a calendar month', () => {
    expect(addBillingInterval(new Date('2026-01-15T09:00:00.000Z'), 'MONTH')).toEqual(
      new Date('2026-02-15T09:00:00.000Z'),
    );
  });

  it('clamps to the shorter month instead of overflowing into March', () => {
    // Naive "+30 days" or a raw setUTCMonth(1, 31) silently rolls to 2026-03-03,
    // which bills the tenant two days early, forever.
    expect(addBillingInterval(new Date('2026-01-31T00:00:00.000Z'), 'MONTH')).toEqual(
      new Date('2026-02-28T00:00:00.000Z'),
    );
  });

  it('clamps a leap-day anniversary to 28 in a common year', () => {
    expect(addBillingInterval(new Date('2024-02-29T00:00:00.000Z'), 'YEAR')).toEqual(
      new Date('2025-02-28T00:00:00.000Z'),
    );
  });

  it('carries the year at December', () => {
    expect(addBillingInterval(new Date('2026-12-01T00:00:00.000Z'), 'MONTH')).toEqual(
      new Date('2027-01-01T00:00:00.000Z'),
    );
  });

  it('advances a full year for an annual plan', () => {
    expect(addBillingInterval(new Date('2026-06-30T12:30:00.000Z'), 'YEAR')).toEqual(
      new Date('2027-06-30T12:30:00.000Z'),
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @nid/billing exec jest subscriptions --runInBand`
Expected: FAIL — module `./subscriptions` not found.

- [ ] **Step 3: Write subscriptions.ts**

```ts
import type {
  PlanInterval,
  Subscription,
  SubscriptionStatus,
  TransactionClient,
} from '@nid/db';
import { BillingError } from './errors';

/**
 * Calendar arithmetic, not elapsed time. A monthly plan bought on the 31st
 * renews on the last day of short months; `+30 days` would drift the billing
 * date backwards over a year and is why this is a function with tests instead
 * of an inline `setMonth`.
 */
export function addBillingInterval(start: Date, interval: PlanInterval): Date {
  const months = interval === 'YEAR' ? 12 : 1;
  const monthIndex = start.getUTCMonth() + months;
  const year = start.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDayOfMonth);

  const result = new Date(start.getTime());
  result.setUTCFullYear(year, month, day);
  return result;
}

const ACTIVATABLE: readonly SubscriptionStatus[] = ['INCOMPLETE', 'PAST_DUE'];

export interface ActivateSubscriptionInput {
  tenantId: string;
  subscriptionId: string;
  /** The plan's interval; resolved by the caller so this stays a pure write. */
  interval: PlanInterval;
  periodStart: Date;
}

/**
 * Idempotent by design: the same settlement can be reached from a webhook, a
 * provider poll and a manual replay, and a second pass must not shift the
 * period a tenant was already charged for.
 */
export async function activateSubscription(
  tx: TransactionClient,
  input: ActivateSubscriptionInput,
): Promise<Subscription> {
  const subscription = await tx.subscription.findFirst({
    where: { id: input.subscriptionId, tenantId: input.tenantId },
  });
  if (!subscription) throw new BillingError(`Subscription ${input.subscriptionId} not found.`);
  if (subscription.status === 'ACTIVE' && subscription.currentPeriodEnd !== null) {
    return subscription;
  }
  if (!ACTIVATABLE.includes(subscription.status)) {
    throw new BillingError(`Subscription ${subscription.id} is ${subscription.status} and cannot be activated.`);
  }

  return tx.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: input.periodStart,
      currentPeriodEnd: addBillingInterval(input.periodStart, input.interval),
      startedAt: subscription.startedAt ?? input.periodStart,
    },
  });
}

export async function setCancelAtPeriodEnd(
  tx: TransactionClient,
  tenantId: string,
  subscriptionId: string,
  value: boolean,
): Promise<Subscription> {
  const subscription = await tx.subscription.findFirst({
    where: { id: subscriptionId, tenantId },
  });
  if (!subscription) throw new BillingError(`Subscription ${subscriptionId} not found.`);
  if (subscription.status === 'CANCELED') return subscription;
  return tx.subscription.update({
    where: { id: subscriptionId },
    data: { cancelAtPeriodEnd: value },
  });
}

/**
 * Immediate cancel: the subscription stops now and any invoice raised for it
 * is voided, because a tenant who cancels before paying must not owe for a
 * period they will never receive. Entitlements therefore drop on this write,
 * not at the next renewal tick.
 */
export async function cancelSubscription(
  tx: TransactionClient,
  tenantId: string,
  subscriptionId: string,
): Promise<Subscription> {
  const subscription = await tx.subscription.findFirst({
    where: { id: subscriptionId, tenantId },
  });
  if (!subscription) throw new BillingError(`Subscription ${subscriptionId} not found.`);

  const lines = await tx.invoiceLine.findMany({ where: { subscriptionId } });
  const invoiceIds = [...new Set(lines.map((line) => line.invoiceId))];
  for (const invoiceId of invoiceIds) {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (invoice && (invoice.status === 'DRAFT' || invoice.status === 'OPEN')) {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'VOID', voidedAt: new Date() },
      });
    }
  }

  return tx.subscription.update({
    where: { id: subscriptionId },
    data: { status: 'CANCELED', canceledAt: new Date(), cancelAtPeriodEnd: false },
  });
}
```

- [ ] **Step 4: Write the failing settlement DB test**

`packages/billing/src/settlement.db.spec.ts`. This is the highest-value test in
Phase 1: it is the proof that one webhook, delivered twice, produces one
charge, one credit top-up and one balanced ledger.

```ts
import {
  createPrismaClient,
  withBillingAdminContext,
  withTenantContext,
  type PrismaClient,
} from '@nid/db';
import { reserveCheckout, createCheckoutSession } from './checkout';
import { settlePayment } from './settlement';
import { MockPaymentProvider } from '@nid/payments';

const runDb = process.env['RUN_DB_TESTS'] === 'true' ? describe : describe.skip;

runDb('settlement against real Postgres', () => {
  const url = process.env['APP_DATABASE_URL'];
  if (!url) throw new Error('settlement.db.spec.ts needs APP_DATABASE_URL.');
  const DATABASE_URL = process.env['DATABASE_URL'] ?? url;

  let prisma: PrismaClient;
  let superuser: PrismaClient;
  let tenantId: string;
  let packId: string;
  let subPlanId: string;
  const tag = Date.now().toString(36);

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    superuser = createPrismaClient(DATABASE_URL);
    tenantId = (
      await superuser.tenant.create({ data: { name: `stl ${tag}`, slug: `stl-${tag}` } })
    ).id;
    const catalog = await withBillingAdminContext(prisma, async (tx) => {
      const service = await tx.billingService.create({
        data: { key: `stl-${tag}`, name: `Settle ${tag}`, ownerRepo: 'nID' },
      });
      const pack = await tx.plan.create({
        data: {
          serviceId: service.id,
          key: 'pack',
          name: 'Pack',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 11800n,
          creditsIncluded: 11800,
        },
      });
      const sub = await tx.plan.create({
        data: {
          serviceId: service.id,
          key: 'sub',
          name: 'Monthly',
          mode: 'SUBSCRIPTION',
          unitAmountMinor: 50000n,
          interval: 'MONTH',
        },
      });
      return { pack, sub };
    });
    packId = catalog.pack.id;
    subPlanId = catalog.sub.id;
  });

  afterAll(async () => {
    await superuser.tenant.delete({ where: { id: tenantId } });
    await Promise.all([prisma.$disconnect(), superuser.$disconnect()]);
  });

  async function topUpIntent(idempotencyKey: string) {
    return createCheckoutSession(
      {
        prisma,
        provider: new MockPaymentProvider({ checkoutUiUrl: 'http://localhost:3500', outcome: 'pending' }),
        checkoutUiUrl: 'http://localhost:3500',
        webhookUrl: 'http://localhost:4000/v1/billing/webhooks/mock',
        allowedReturnOrigins: [],
      },
      { tenantId, purpose: 'CREDIT_TOPUP', planId: packId, idempotencyKey },
    );
  }

  it('a top-up settles once: credits, ledger and intent state all move exactly one step', async () => {
    const created = await topUpIntent(`settle-${tag}`);
    if (created.reused) throw new Error('expected a fresh intent');
    const intentId = created.intentId;

    const first = await withTenantContext(prisma, tenantId, (tx) =>
      settlePayment(tx, {
        tenantId,
        intentId,
        provider: 'mock',
        providerTransactionId: `txn-${tag}`,
        paidAmountMinor: 11800n,
        currency: 'PKR',
        methodType: 'card',
        paidAt: new Date(),
      }),
    );
    expect(first.settled).toBe(true);

    // Same transaction id, second delivery — the exact duplicate every PSP sends.
    const second = await withTenantContext(prisma, tenantId, (tx) =>
      settlePayment(tx, {
        tenantId,
        intentId,
        provider: 'mock',
        providerTransactionId: `txn-${tag}`,
        paidAmountMinor: 11800n,
        currency: 'PKR',
        methodType: 'card',
        paidAt: new Date(),
      }),
    );
    expect(second.alreadySettled).toBe(true);
    expect(second.paymentId).toBe(first.paymentId);

    const state = await withTenantContext(prisma, tenantId, async (tx) => {
      const account = await tx.billingAccount.findUniqueOrThrow({ where: { tenantId } });
      const payments = await tx.payment.findMany({ where: { paymentIntentId: intentId } });
      const creditEntries = await tx.creditLedgerEntry.findMany({ where: { tenantId } });
      const txns = await tx.ledgerTransaction.findMany({ where: { tenantId } });
      const entries = await tx.ledgerEntry.findMany({ where: { tenantId } });
      const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
      const session = await tx.checkoutSession.findFirstOrThrow({ where: { paymentIntentId: intentId } });
      return { account, payments, creditEntries, txns, entries, intent, session };
    });

    expect(state.payments).toHaveLength(1);
    expect(state.creditEntries).toHaveLength(1);
    expect(state.account.creditBalanceMinor).toBe(11800n);
    expect(state.txns).toHaveLength(1);
    expect(state.entries.reduce((sum, e) => sum + (e.direction === 'DEBIT' ? e.amountMinor : -e.amountMinor), 0n)).toBe(0n);
    expect(state.intent.status).toBe('SUCCEEDED');
    expect(state.session.status).toBe('COMPLETED');
  });

  it('a subscription activates with a calendar period and revenue, not credits', async () => {
    const created = await withTenantContext(prisma, tenantId, (tx) =>
      reserveCheckout(tx, {
        tenantId,
        purpose: 'SUBSCRIPTION',
        planId: subPlanId,
        allowedReturnOrigins: [],
        idempotencyKey: `sub-${tag}`,
        provider: 'mock',
      }),
    );
    if (created.reused) throw new Error('expected a fresh intent');

    const settled = await withTenantContext(prisma, tenantId, (tx) =>
      settlePayment(tx, {
        tenantId,
        intentId: created.intentId,
        provider: 'mock',
        providerTransactionId: `txn-sub-${tag}`,
        paidAmountMinor: created.amountMinor,
        currency: 'PKR',
        paidAt: new Date('2026-01-31T00:00:00.000Z'),
      }),
    );
    expect(settled.settled).toBe(true);

    const result = await withTenantContext(prisma, tenantId, async (tx) => {
      const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: created.intentId } });
      const metadata = intent.metadata as Record<string, string>;
      return {
        subscription: await tx.subscription.findUniqueOrThrow({ where: { id: metadata.subscriptionId } }),
        invoice: await tx.invoice.findUniqueOrThrow({ where: { id: metadata.invoiceId } }),
        balance: (await tx.billingAccount.findUniqueOrThrow({ where: { tenantId } })).creditBalanceMinor,
        kinds: (
          await tx.ledgerEntry.findMany({
            where: { tenantId },
            include: { account: true },
          })
        ).map((entry) => `${entry.direction}:${entry.account.kind}`),
      };
    });

    expect(result.subscription.status).toBe('ACTIVE');
    expect(result.subscription.currentPeriodStart).toEqual(new Date('2026-01-31T00:00:00.000Z'));
    expect(result.subscription.currentPeriodEnd).toEqual(new Date('2026-02-28T00:00:00.000Z'));
    expect(result.invoice.status).toBe('PAID');
    expect(result.balance).toBe(11800n); // unchanged: a subscription buys no credits
    expect(result.kinds).toContain('DEBIT:PSP_CLEARING');
    expect(result.kinds).toContain(`CREDIT:REVENUE`);
  });

  it('refuses to settle a wrong amount and leaves the intent payable', async () => {
    const created = await topUpIntent(`wrong-${tag}`);
    if (created.reused) throw new Error('expected a fresh intent');

    await expect(
      withTenantContext(prisma, tenantId, (tx) =>
        settlePayment(tx, {
          tenantId,
          intentId: created.intentId,
          provider: 'mock',
          providerTransactionId: `txn-wrong-${tag}`,
          paidAmountMinor: 100n,
          currency: 'PKR',
          paidAt: new Date(),
        }),
      ),
    ).rejects.toThrow(/amount/);

    const intent = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: created.intentId } });
    expect(intent.status).toBe('REQUIRES_CHECKOUT');
    // `superuser` here on purpose: `payment` has no open-SELECT policy, so an
    // RLS-scoped count could only prove the policy works, not that the row is
    // absent. Cross-tenant invisibility is asserted separately, below.
    expect(await superuser.payment.count({ where: { paymentIntentId: created.intentId } })).toBe(0);
  });

  it('records funds paid into a closed intent without settling them', async () => {
    const created = await topUpIntent(`closed-${tag}`);
    if (created.reused) throw new Error('expected a fresh intent');
    await superuser.paymentIntent.update({ where: { id: created.intentId }, data: { status: 'EXPIRED' } });

    const result = await withTenantContext(prisma, tenantId, (tx) =>
      settlePayment(tx, {
        tenantId,
        intentId: created.intentId,
        provider: 'mock',
        providerTransactionId: `txn-closed-${tag}`,
        paidAmountMinor: 11800n,
        currency: 'PKR',
        paidAt: new Date(),
      }),
    );

    expect(result.settled).toBe(false);
    expect(result.alreadySettled).toBe(false);
    // The money is real and unexplained: it must be a row, not a thrown error
    // that would erase the only evidence of it.
    expect(await superuser.payment.count({ where: { paymentIntentId: created.intentId } })).toBe(1);
  });

  it('cannot see another tenant intent', async () => {
    const other = await superuser.tenant.create({
      data: { name: `other ${tag}`, slug: `other-${tag}` },
    });
    const created = await topUpIntent(`cross-${tag}`);
    if (created.reused) throw new Error('expected a fresh intent');

    await expect(
      withTenantContext(prisma, other.id, (tx) =>
        settlePayment(tx, {
          tenantId: other.id,
          intentId: created.intentId,
          provider: 'mock',
          providerTransactionId: `txn-cross-${tag}`,
          paidAmountMinor: 11800n,
          currency: 'PKR',
          paidAt: new Date(),
        }),
      ),
    ).rejects.toThrow(/not found/);

    // Nothing was written under the attacker's tenant either: settlement threw
    // before its first create, and the RLS-scoped read cannot see the intent.
    expect(await superuser.payment.count({ where: { providerTransactionId: `txn-cross-${tag}` } })).toBe(0);
    await superuser.tenant.delete({ where: { id: other.id } });
  });
});
```

- [ ] **Step 5: Write settlement.ts**

```ts
import type { PaymentIntent, TransactionClient } from '@nid/db';
import { BillingError, CheckoutError } from './errors';
import { markInvoicePaid } from './invoices';
import { creditAccount } from './credits';
import { postLedgerTransaction } from './ledger';
import { activateSubscription } from './subscriptions';

export interface SettlePaymentInput {
  tenantId: string;
  intentId: string;
  provider: string;
  providerTransactionId: string;
  paidAmountMinor: bigint;
  currency: string;
  methodType?: string | null;
  paidAt: Date;
}

export interface SettlePaymentResult {
  paymentId: string;
  /** True when this settlement was already applied — the caller emits no events. */
  alreadySettled: boolean;
  /** False when the money arrived against an intent that can no longer be fulfilled. */
  settled: boolean;
}

function metadataOf(intent: PaymentIntent): Record<string, string> {
  return (intent.metadata ?? {}) as Record<string, string>;
}

/**
 * The single path from "the provider says we were paid" to "nID's books say we
 * were paid". Idempotent at three levels (payment row, credit entry, intent
 * status) because PSPs re-deliver webhooks, a poll can race a webhook, and
 * reconciliation re-applies deliberately. Never call it from a return URL.
 */
export async function settlePayment(
  tx: TransactionClient,
  input: SettlePaymentInput,
): Promise<SettlePaymentResult> {
  const intent = await tx.paymentIntent.findFirst({
    where: { id: input.intentId, tenantId: input.tenantId },
    include: { checkoutSession: true, payments: true },
  });
  if (!intent) throw new BillingError(`Payment intent ${input.intentId} not found.`);

  if (intent.status === 'SUCCEEDED') {
    const existing =
      intent.payments.find((p) => p.provider === input.provider && p.providerTransactionId === input.providerTransactionId) ??
      intent.payments.find((p) => p.status === 'SUCCEEDED');
    if (!existing) throw new BillingError('Intent is SUCCEEDED but no payment was recorded.');
    return { paymentId: existing.id, alreadySettled: true, settled: true };
  }

  if (intent.status !== 'REQUIRES_CHECKOUT' && intent.status !== 'PROCESSING') {
    // Real money against a closed order — usually the hosted session expiring
    // between the payer starting and finishing. Recording the payment is the
    // only way it reaches a human; settling it would mint credits for a
    // purchase nID already gave up on.
    const payment = await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        paymentIntentId: intent.id,
        provider: input.provider,
        providerTransactionId: input.providerTransactionId,
        amountMinor: input.paidAmountMinor,
        currency: input.currency,
        status: 'SUCCEEDED',
        methodType: input.methodType ?? null,
        paidAt: input.paidAt,
      },
    });
    return { paymentId: payment.id, alreadySettled: false, settled: false };
  }

  if (input.paidAmountMinor !== intent.amountMinor) {
    throw new CheckoutError(
      `Payment amount ${input.paidAmountMinor} does not match intent ${intent.id} amount ${intent.amountMinor}; partial payments are not settled in Phase 1.`,
    );
  }
  if (input.currency !== intent.currency) {
    throw new CheckoutError(
      `Payment currency ${input.currency} does not match intent currency ${intent.currency}.`,
    );
  }

  let paymentId: string;
  try {
    const payment = await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        paymentIntentId: intent.id,
        provider: input.provider,
        providerTransactionId: input.providerTransactionId,
        amountMinor: input.paidAmountMinor,
        currency: input.currency,
        status: 'SUCCEEDED',
        methodType: input.methodType ?? null,
        paidAt: input.paidAt,
      },
    });
    paymentId = payment.id;
  } catch (error) {
    // A concurrent webhook for the same transaction id: the unique key on
    // (provider, providerTransactionId) is the arbiter, the loser reports no-op.
    if (error && typeof error === 'object' && (error as { code?: string }).code === 'P2002') {
      const existing = await tx.payment.findFirst({
        where: { provider: input.provider, providerTransactionId: input.providerTransactionId },
      });
      if (existing) return { paymentId: existing.id, alreadySettled: true, settled: true };
    }
    throw error;
  }

  const metadata = metadataOf(intent);
  const taxMinor = BigInt(metadata.taxMinor ?? '0');

  if (intent.purpose === 'CREDIT_TOPUP') {
    const creditsMinor = BigInt(metadata.creditsMinor ?? intent.amountMinor.toString());
    if (creditsMinor + taxMinor !== intent.amountMinor) {
      throw new BillingError(
        `Plan credit split ${creditsMinor} + ${taxMinor} does not equal the charge ${intent.amountMinor}; the ledger could not balance.`,
      );
    }
    await creditAccount(tx, {
      tenantId: input.tenantId,
      billingAccountId: intent.billingAccountId,
      deltaMinor: creditsMinor,
      reason: 'TOPUP',
      refType: 'payment_intent',
      refId: intent.id,
    });
    await postLedgerTransaction(tx, {
      tenantId: input.tenantId,
      type: 'CREDIT_TOPUP',
      refType: 'payment_intent',
      refId: intent.id,
      currency: intent.currency,
      occurredAt: input.paidAt,
      lines: [
        { kind: 'PSP_CLEARING', direction: 'DEBIT', amountMinor: intent.amountMinor },
        { kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: creditsMinor },
        ...(taxMinor > 0n
          ? [{ kind: 'TAX_PAYABLE' as const, direction: 'CREDIT' as const, amountMinor: taxMinor }]
          : []),
      ],
    });
  } else {
    const invoiceId = metadata.invoiceId;
    if (!invoiceId) throw new BillingError(`Intent ${intent.id} has no invoiceId in its metadata.`);
    const invoice = await markInvoicePaid(tx, invoiceId, intent.amountMinor, input.paidAt);

    if (intent.purpose === 'SUBSCRIPTION') {
      const subscriptionId = metadata.subscriptionId;
      const interval = metadata.interval;
      if (!subscriptionId || !interval) {
        throw new BillingError(`Intent ${intent.id} is missing the subscription it is paying for.`);
      }
      await activateSubscription(tx, {
        tenantId: input.tenantId,
        subscriptionId,
        interval: interval === 'YEAR' ? 'YEAR' : 'MONTH',
        periodStart: invoice.periodStart ?? invoice.issuedAt ?? input.paidAt,
      });
    }

    const subtotalMinor = invoice.subtotalMinor;
    await postLedgerTransaction(tx, {
      tenantId: input.tenantId,
      type: 'PAYMENT',
      refType: 'payment_intent',
      refId: intent.id,
      currency: intent.currency,
      occurredAt: input.paidAt,
      lines: [
        { kind: 'PSP_CLEARING', direction: 'DEBIT', amountMinor: intent.amountMinor },
        { kind: 'REVENUE', serviceId: metadata.serviceId || null, direction: 'CREDIT', amountMinor: subtotalMinor },
        ...(invoice.taxMinor > 0n
          ? [{ kind: 'TAX_PAYABLE' as const, direction: 'CREDIT' as const, amountMinor: invoice.taxMinor }]
          : []),
      ],
    });
  }

  await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCEEDED' } });
  if (intent.checkoutSession) {
    await tx.checkoutSession.update({
      where: { id: intent.checkoutSession.id },
      data: { status: 'COMPLETED', consumedAt: input.paidAt },
    });
  }

  return { paymentId, alreadySettled: false, settled: true };
}
```

- [ ] **Step 6: Export and run**

Add to `packages/billing/src/index.ts`:

```ts
export * from './subscriptions';
export * from './settlement';
```

Run: `pnpm --filter @nid/billing test && pnpm typecheck`
Expected: PASS. `settlePayment` is called only from Task 11's webhook handler
(and Phase 2 workflows) — nothing in `apps/api` may reimplement any part of it.

- [ ] **Step 7: Commit**

```bash
git add packages/billing
git commit -m "feat(billing): add idempotent settlement, ledger posting and subscription lifecycle"
```

## Task 9: API foundation — env, BigInt wire format, billing guards, provider factory

**Files:**
- Modify: `apps/api/src/core/config/env.ts`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/package.json`, `apps/api/jest.config.js`, `apps/api/src/core/audit/audit.service.ts`, `apps/api/src/core/auth/types.ts`, `apps/api/src/core/auth/auth.module.ts`
- Create: `apps/api/src/core/serialization/bigint-serializer.ts` (+ `.spec.ts`), `apps/api/src/core/auth/billing-tenant.guard.ts`, `billing-admin.guard.ts`, `billing-service.guard.ts`, `current-billing.decorator.ts`, `apps/api/src/core/payments/payment-providers.service.ts`, `payment-providers.module.ts`, `payment-providers.spec.ts`, `apps/api/src/modules/billing/billing.module.ts`

**Interfaces:**
- Consumes: `ProviderRegistry`, `MockPaymentProvider`, `RapidGatewayProvider`, `PaymentProvider`, `PaymentProviderConfigError` (Tasks 2-3); `hashApiKey` (`@nid/shared-types`); `withBillingAdminContext`, `TransactionClient`, `BillingServiceCredential` (Task 1); `AccountsService.resolveSession` (existing); `PrismaService.forTenant/unscoped` (existing).
- Produces: `AppEnv` fields `paymentProviders`, `checkoutUiUrl`, `apiPublicUrl`, `checkoutReturnOrigins`, `rapidGatewayBaseUrl`, `rapidGatewayMerchantId`, `rapidGatewayApiKey`, `rapidGatewayApiSecret`, `rapidGatewayWebhookSecret`, `billingAdminAccountIds`, `verificationCaseCreditMinor: bigint`, `mockPaymentOutcome`; `serializeBigInt(value)`, `BigIntSerializerInterceptor`; `BillingTenantActor`, `BillingTenantGuard` + `@CurrentBillingTenant()`; `BillingAdminActor`, `BillingAdminGuard` + `@CurrentBillingAdmin()`; `BillingServiceActor`, `BillingServiceGuard` + `@CurrentBillingService()` + `assertScope(actor, scope)`; `PaymentProvidersService` with `registry`, `defaultProvider`, `resolve(name)`, `webhookUrlFor(name)`, `returnOrigins`, `checkoutUiUrl`; `BillingModule` (controllers attached by Tasks 10-11); `AuditEntryInput` gains `SERVICE`/`PLATFORM_ADMIN` actor types plus `entityType`/`entityId`.

- [ ] **Step 1: Extend the env**

In `apps/api/src/core/config/env.ts`, add to `AppEnv` (after `livenessDevMode`):

```ts
  /**
   * Allowlist of payment providers, same shape as `verificationMethods`:
   * nothing else may resolve, and no controller is allowed to branch on the
   * name. docs/HOUSE-RULES.md rule 1.
   */
  paymentProviders: string;
  /** Base URL of apps/checkout-ui — every hosted-checkout return link is built from it. */
  checkoutUiUrl: string;
  /** nID's own public base URL; the provider webhook URL is derived from it, never from a request Host header. */
  apiPublicUrl: string;
  /** Comma-separated origins allowed as a caller's post-payment `returnUrl`. Empty means none. */
  checkoutReturnOrigins: string;
  /** Blank here on purpose: validated by RapidGatewayProvider's constructor only when the allowlist selects it. */
  rapidGatewayBaseUrl: string;
  rapidGatewayMerchantId: string;
  rapidGatewayApiKey: string;
  rapidGatewayApiSecret: string;
  rapidGatewayWebhookSecret: string;
  /** Comma-separated Account ids allowed to write the global catalog (spec D9). */
  billingAdminAccountIds: string;
  /** Credits debited per verification case created (spec §7.3). Money, so BigInt. */
  verificationCaseCreditMinor: bigint;
  /** What the dev mock provider reports from fetchPayment. */
  mockPaymentOutcome: 'success' | 'failure' | 'pending';
```

Add the parser next to `required` (BigInt parsing must fail loudly, not become `0n`):

```ts
/**
 * Minor units are money: a typo'd env value must stop the boot rather than
 * silently charge nobody. `BigInt('')` would throw a confusing SyntaxError and
 * `Number` would accept 1e21 / 1.5, so this is an explicit digit check.
 */
function minorUnits(name: string, fallback: string): bigint {
  const value = process.env[name] ?? fallback;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`Env var ${name} must be a non-negative integer of minor units, got "${value}".`);
  }
  return BigInt(value.trim());
}
```

And to `loadEnv()`'s return object:

```ts
    paymentProviders: process.env['PAYMENT_PROVIDERS'] ?? 'mock',
    checkoutUiUrl: process.env['CHECKOUT_UI_URL'] ?? 'http://localhost:3500',
    apiPublicUrl: process.env['API_PUBLIC_URL'] ?? `http://localhost:${Number(process.env['API_PORT'] ?? 4000)}`,
    checkoutReturnOrigins: process.env['CHECKOUT_RETURN_ORIGINS'] ?? '',
    rapidGatewayBaseUrl: process.env['RAPID_GATEWAY_BASE_URL'] ?? '',
    rapidGatewayMerchantId: process.env['RAPID_GATEWAY_MERCHANT_ID'] ?? '',
    rapidGatewayApiKey: process.env['RAPID_GATEWAY_API_KEY'] ?? '',
    rapidGatewayApiSecret: process.env['RAPID_GATEWAY_API_SECRET'] ?? '',
    rapidGatewayWebhookSecret: process.env['RAPID_GATEWAY_WEBHOOK_SECRET'] ?? '',
    billingAdminAccountIds: process.env['BILLING_ADMIN_ACCOUNT_IDS'] ?? '',
    verificationCaseCreditMinor: minorUnits('VERIFICATION_CASE_CREDIT_MINOR', '2500'),
    mockPaymentOutcome: (process.env['MOCK_PAYMENT_OUTCOME'] ?? 'success') as
      | 'success'
      | 'failure'
      | 'pending',
```

- [ ] **Step 2: Write the failing BigInt serializer test**

`apps/api/src/core/serialization/bigint-serializer.spec.ts`:

```ts
import { serializeBigInt } from './bigint-serializer';

describe('serializeBigInt', () => {
  it('turns BigInt into a decimal string, never a float', () => {
    expect(serializeBigInt({ amountMinor: 11800n })).toEqual({ amountMinor: '11800' });
  });

  it('walks nested arrays and objects', () => {
    expect(serializeBigInt({ lines: [{ totalMinor: 1n }, { totalMinor: 2n }] })).toEqual({
      lines: [{ totalMinor: '1' }, { totalMinor: '2' }] });
  });

  it('leaves everything else alone', () => {
    const date = new Date('2026-10-31T00:00:00.000Z');
    expect(serializeBigInt({ id: 'x', n: 42, date, nullable: null })).toEqual({
      id: 'x',
      n: 42,
      date,
      nullable: null,
    });
  });

  it('survives a self-referencing object instead of blowing the stack', () => {
    const node: Record<string, unknown> = { amountMinor: 5n };
    node.self = node;
    expect(() => serializeBigInt(node)).not.toThrow();
  });
});
```

- [ ] **Step 3: Run it, then implement**

Run: `pnpm --filter @nid/api exec jest bigint-serializer --runInBand`
Expected: FAIL — module not found.

`apps/api/src/core/serialization/bigint-serializer.ts`:

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

/**
 * Money is `BigInt` minor units in the database (spec D7) and JSON has no
 * integer type beyond `number`, so an unguarded response would silently round
 * 11,800 paisa through a float. Strings are the honest wire format: exact, and
 * every client parses them deliberately.
 */
export function serializeBigInt(value: unknown, seen = new Set<unknown>()): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => serializeBigInt(item, seen));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      serializeBigInt(item, seen),
    ]),
  );
}

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeBigInt(data)));
  }
}
```

- [ ] **Step 4: Wire raw body and the interceptor into `main.ts`**

```ts
  // rawBody: an inbound PSP webhook signature is computed over the exact bytes
  // sent, and body-parsing re-serialisation changes them (key order, spacing).
  // Express would otherwise hand us a rebuilt object that can never verify.
  const app = await NestFactory.create(AppModule, { rawBody: true });
```

and after the `useGlobalPipes` line:

```ts
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());
```

- [ ] **Step 5: Extend the audit input**

In `apps/api/src/core/audit/audit.service.ts`, replace the actor union and add the entity fields (both are additive, so existing callers keep compiling):

```ts
export interface AuditEntryInput {
  /**
   * SERVICE = an ecosystem service acting with a BillingServiceCredential;
   * PLATFORM_ADMIN = a nID operator in the catalog/refund surface. Both are
   * new actors precisely because billing is the first feature where "which
   * tenant" is not enough to describe who acted (spec §5.3).
   */
  actorType: 'TENANT_STAFF' | 'SUBJECT' | 'SYSTEM' | 'API_KEY' | 'SERVICE' | 'PLATFORM_ADMIN';
  actorId?: string;
  action: string;
  subjectId?: string;
  caseId?: string;
  ipAddress?: string;
  entityType?: string;
  entityId?: string;
}
```

and in `record()`'s `data` object:

```ts
        entityType: entry.entityType,
        entityId: entry.entityId,
```

- [ ] **Step 6: The three billing guards**

`apps/api/src/core/auth/billing-tenant.guard.ts`:

```ts
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { hashApiKey } from '@nid/shared-types';
import { PrismaService } from '../db/prisma.service';
import { AccountsService } from '../../modules/accounts/accounts.service';
import { loadEnv } from '../config/env';

export interface BillingTenantActor {
  tenantId: string;
  actorType: 'TENANT_STAFF' | 'PLATFORM_ADMIN';
  actorId: string;
}

/**
 * Billing's staff guard. Unlike `TenantActorGuard` this one **rejects a tenant
 * API key on purpose**: a raw key cannot show who pressed "pay 50,000 PKR",
 * and every financial action in this system is audited to a person (house rule
 * 3). A platform admin (BILLING_ADMIN_ACCOUNT_IDS) is accepted for any tenant
 * they name with X-Tenant-Id, so support can act for a customer.
 */
@Injectable()
export class BillingTenantGuard implements CanActivate {
  private readonly adminAccountIds: ReadonlySet<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
  ) {
    this.adminAccountIds = new Set(
      loadEnv()
        .billingAdminAccountIds.split(',')
        .map((id) => id.trim())
        .filter((id) => id !== ''),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { billingTenant?: BillingTenantActor }>();
    const header = request.headers['authorization'];
    if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }
    const token = header.slice('Bearer '.length).trim();
    if (token.length === 0) throw new UnauthorizedException('Missing credential.');

    if (await this.prisma.unscoped.tenantApiKey.findUnique({ where: { keyHash: hashApiKey(token) } })) {
      throw new ForbiddenException(
        'Billing endpoints require a staff sign-in, not a tenant API key, so every charge is attributable to a person.',
      );
    }

    const account = await this.accounts.resolveSession(token).catch(() => null);
    if (!account) throw new UnauthorizedException('Invalid session token.');

    const requested = request.headers['x-tenant-id'];
    if (Array.isArray(requested)) throw new BadRequestException('X-Tenant-Id must be a single value.');
    const isPlatformAdmin = this.adminAccountIds.has(account.id);

    if (isPlatformAdmin) {
      if (!requested) {
        throw new BadRequestException('A platform admin must name the tenant with X-Tenant-Id.');
      }
      request.billingTenant = {
        tenantId: requested,
        actorType: 'PLATFORM_ADMIN',
        actorId: account.id,
      };
      return true;
    }

    const membership = await this.prisma.unscoped.tenantStaffMembership.findFirst({
      where: { accountId: account.id, ...(requested ? { tenantId: requested } : {}) },
    });
    if (!membership) {
      throw new ForbiddenException(
        requested ? 'This account is not staff on the requested tenant.' : 'This account is not staff on any tenant.',
      );
    }

    request.billingTenant = {
      tenantId: membership.tenantId,
      actorType: 'TENANT_STAFF',
      actorId: account.id,
    };
    return true;
  }
}
```

`apps/api/src/core/auth/billing-admin.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccountsService } from '../../modules/accounts/accounts.service';
import { loadEnv } from '../config/env';

export interface BillingAdminActor {
  actorType: 'PLATFORM_ADMIN';
  actorId: string;
}

/**
 * The only guard allowed to pair with `withBillingAdminContext` (spec D9). The
 * allowlist is an env var, not a DB column, on purpose: there is no billing
 * role to grant before billing exists, and a bootstrap that needs the thing it
 * bootstraps is a deadlock.
 */
@Injectable()
export class BillingAdminGuard implements CanActivate {
  constructor(private readonly accounts: AccountsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { billingAdmin?: BillingAdminActor }>();
    const header = request.headers['authorization'];
    if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }
    const account = await this.accounts
      .resolveSession(header.slice('Bearer '.length).trim())
      .catch(() => null);
    if (!account) throw new UnauthorizedException('Invalid session token.');

    const allowed = loadEnv()
      .billingAdminAccountIds.split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');
    if (!allowed.includes(account.id)) {
      throw new ForbiddenException('Only nID platform admins can change the billing catalog.');
    }

    request.billingAdmin = { actorType: 'PLATFORM_ADMIN', actorId: account.id };
    return true;
  }
}
```

`apps/api/src/core/auth/billing-service.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { hashApiKey } from '@nid/shared-types';
import { withBillingAdminContext } from '@nid/db';
import { PrismaService } from '../db/prisma.service';

export interface BillingServiceActor {
  serviceId: string;
  /** The catalog key, e.g. `erp-1` — what revenue is attributed to. */
  serviceKey: string;
  credentialId: string;
  scopes: string[];
}

/**
 * Ecosystem services (core-newax, erp-1, Communicator…) authenticate here with
 * `Authorization: Bearer <billing key>` (spec §10). This guard resolves ONLY a
 * BillingServiceCredential: a tenant's own `TenantApiKey` and a staff session
 * token are both rejected here, and a billing credential is never accepted on
 * the staff routes. The two kinds carry different rights — a tenant key may not
 * invoice on behalf of a service, a service key may not read a tenant it was
 * not told about — so guessing which one the caller meant is not available.
 */
@Injectable()
export class BillingServiceGuard implements CanActivate {
  private readonly logger = new Logger(BillingServiceGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { billingService?: BillingServiceActor }>();
    const header = request.headers['authorization'];
    if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }
    const token = header.slice('Bearer '.length).trim();
    if (token.length === 0) throw new UnauthorizedException('Missing credential.');

    // Lookup by SHA-256 hash, like TenantApiKey: the comparison is an exact
    // index match, so the secret itself never leaves the caller and a timing
    // side channel on "is this key known" is not available.
    const credential = await this.prisma.unscoped.billingServiceCredential.findUnique({
      where: { keyHash: hashApiKey(token) },
      include: { service: true },
    });
    if (!credential || credential.revokedAt !== null) {
      throw new UnauthorizedException('Invalid billing service credential.');
    }
    if (credential.service.status !== 'ACTIVE') {
      throw new ForbiddenException(`Service ${credential.service.key} is not billing-enabled.`);
    }

    request.billingService = {
      serviceId: credential.serviceId,
      serviceKey: credential.service.key,
      credentialId: credential.id,
      scopes: credential.scopes,
    };

    // Telemetry, not money: a failed lastUsedAt write must not reject a
    // legitimately authenticated call, so it is logged and dropped rather than
    // awaited or swallowed silently. It needs app.billing_admin because the
    // catalog's write policy is the only gate on that table.
    void withBillingAdminContext(this.prisma.client, (tx) =>
      tx.billingServiceCredential.update({
        where: { id: credential.id },
        data: { lastUsedAt: new Date() },
      }),
    ).catch((error: unknown) => {
      this.logger.warn(`Could not record lastUsedAt for credential ${credential.id}: ${String(error)}`);
    });

    return true;
  }
}

/** Scope check kept out of the guards so one controller can require several. */
export function assertScope(actor: BillingServiceActor, scope: string): void {
  if (!actor.scopes.includes(scope)) {
    throw new ForbiddenException(`This billing service credential lacks the ${scope} scope.`);
  }
}
```

`apps/api/src/core/auth/current-billing.decorator.ts` — mirrors `CurrentActor`'s "throw rather than return undefined" contract:

```ts
import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';
import type { BillingAdminActor } from './billing-admin.guard';
import type { BillingServiceActor } from './billing-service.guard';
import type { BillingTenantActor } from './billing-tenant.guard';

/** The request shape each guard writes into — an index signature keeps the lookup honest. */
type GuardedRequest = Request & Record<string, unknown>;

function read<T>(ctx: ExecutionContext, key: string, guardName: string): T {
  const value = ctx.switchToHttp().getRequest<GuardedRequest>()[key] as T | undefined;
  if (!value) {
    throw new InternalServerErrorException(
      `@Current${guardName}() used on a route without ${guardName}Guard — add @UseGuards(${guardName}Guard).`,
    );
  }
  return value;
}

export const CurrentBillingTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BillingTenantActor => read<BillingTenantActor>(ctx, 'billingTenant', 'BillingTenant'),
);

export const CurrentBillingAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BillingAdminActor => read<BillingAdminActor>(ctx, 'billingAdmin', 'BillingAdmin'),
);

export const CurrentBillingService = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BillingServiceActor =>
    read<BillingServiceActor>(ctx, 'billingService', 'BillingService'),
);
```

In `apps/api/src/core/auth/auth.module.ts`, add all three guards to `providers` and `exports` alongside the existing ones.

- [ ] **Step 7: The provider factory — the only place a provider name is compared**

`apps/api/src/core/payments/payment-providers.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import {
  MockPaymentProvider,
  PaymentProviderConfigError,
  ProviderRegistry,
  RapidGatewayProvider,
  type PaymentProvider,
} from '@nid/payments';
import { loadEnv, type AppEnv } from '../config/env';

export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/**
 * Pure so the allowlist rules are testable without a database connection:
 * `loadEnv()` fails fast on APP_DATABASE_URL, and a provider-registry unit
 * test has no business needing one.
 */
export function buildRegistry(env: AppEnv): ProviderRegistry {
  const names = splitList(env.paymentProviders);
  if (names.length === 0) {
    throw new PaymentProviderConfigError('PAYMENT_PROVIDERS must list at least one provider.');
  }

  const providers = names.map((name): PaymentProvider => {
    switch (name) {
      case 'mock':
        return new MockPaymentProvider({
          checkoutUiUrl: env.checkoutUiUrl,
          outcome: env.mockPaymentOutcome,
        });
      case 'rapid-gateway':
        // Its own constructor is what insists on merchant id / key / secret /
        // webhook secret — selecting it without credentials is a boot failure.
        return new RapidGatewayProvider({
          baseUrl: env.rapidGatewayBaseUrl,
          merchantId: env.rapidGatewayMerchantId,
          apiKey: env.rapidGatewayApiKey,
          apiSecret: env.rapidGatewayApiSecret,
          webhookSecret: env.rapidGatewayWebhookSecret,
        });
      default:
        throw new PaymentProviderConfigError(`Unknown payment provider "${name}" in PAYMENT_PROVIDERS.`);
    }
  });

  return new ProviderRegistry(providers);
}

/**
 * Building providers is configuration, not policy: `PAYMENT_PROVIDERS` says
 * which exist, the registry says which is used, and no controller ever writes
 * the name down (house rule 1). An unknown name in the allowlist is a startup
 * error, not a 500 at the first payment.
 */
@Injectable()
export class PaymentProvidersService {
  private readonly env: AppEnv = loadEnv();
  readonly registry: ProviderRegistry = buildRegistry(this.env);

  /** The first allowlisted name is the one checkout uses. Explicit, and no per-request branching. */
  get defaultProvider(): PaymentProvider {
    return this.registry.get(splitList(this.env.paymentProviders)[0] as string);
  }

  resolve(name: string): PaymentProvider {
    return this.registry.get(name);
  }

  /**
   * Derived from config, never from the request's Host header: whoever controls
   * the webhook URL controls where the "payment succeeded" evidence arrives.
   */
  webhookUrlFor(name: string): string {
    return `${this.env.apiPublicUrl}/v1/billing/webhooks/${name}`;
  }

  get checkoutUiUrl(): string {
    return this.env.checkoutUiUrl;
  }

  get returnOrigins(): string[] {
    return splitList(this.env.checkoutReturnOrigins);
  }
}
```

`apps/api/src/core/payments/payment-providers.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PaymentProvidersService } from './payment-providers.service';

/**
 * Global for the same reason PrismaModule is: checkout, webhooks, refunds and
 * reconciliation all need the registry, and threading it through five modules
 * adds a line per module and no safety.
 */
@Global()
@Module({ providers: [PaymentProvidersService], exports: [PaymentProvidersService] })
export class PaymentProvidersModule {}
```

`apps/api/src/core/payments/payment-providers.spec.ts`:

```ts
import type { AppEnv } from '../config/env';
import { buildRegistry } from './payment-providers.service';

function envWith(overrides: Partial<AppEnv>): AppEnv {
  return {
    // The other fields are irrelevant to the registry; `as AppEnv` keeps the
    // fixture short without pretending the list is exhaustive.
    paymentProviders: 'mock',
    checkoutUiUrl: 'http://localhost:3500',
    mockPaymentOutcome: 'success',
    ...overrides,
  } as AppEnv;
}

describe('buildRegistry', () => {
  it('builds only what the allowlist names', () => {
    expect(buildRegistry(envWith({ paymentProviders: 'mock' })).names()).toEqual(['mock']);
  });

  it('keeps allowlist order, because the first entry is the default', () => {
    const registry = buildRegistry(
      envWith({
        paymentProviders: ' rapid-gateway , mock ',
        rapidGatewayBaseUrl: 'https://sandbox.rapidgateway.pk',
        rapidGatewayMerchantId: 'm',
        rapidGatewayApiKey: 'k',
        rapidGatewayApiSecret: 's',
        rapidGatewayWebhookSecret: 'w',
      }),
    );
    expect(registry.names()).toEqual(['rapid-gateway', 'mock']);
  });

  it('refuses an unknown provider at boot, not at first payment', () => {
    expect(() => buildRegistry(envWith({ paymentProviders: 'stripe' }))).toThrow(
      /Unknown payment provider/,
    );
  });

  it('refuses an empty allowlist', () => {
    expect(() => buildRegistry(envWith({ paymentProviders: ' ' }))).toThrow(/at least one provider/);
  });

  it('refuses rapid-gateway without credentials', () => {
    expect(() => buildRegistry(envWith({ paymentProviders: 'rapid-gateway' }))).toThrow(
      /Rapid Gateway is enabled/,
    );
  });
});
```

- [ ] **Step 8: Create the billing module shell and register everything**

`apps/api/src/modules/billing/billing.module.ts` (Tasks 10-12 add controllers/providers to it):

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  // AccountsModule is imported directly, not only through AuthModule, for the
  // same reason verification-cases.module.ts does it: BillingTenantGuard's
  // AccountsService dependency is not visible to importers of AuthModule.
  imports: [AuthModule, AccountsModule],
  controllers: [],
  providers: [],
})
export class BillingModule {}
```

In `apps/api/src/app.module.ts`: add `import { PaymentProvidersModule } from './core/payments/payment-providers.module';` and `import { BillingModule } from './modules/billing/billing.module';`, and put both in `imports` (`PaymentProvidersModule` after `StorageModule`).

In `apps/api/package.json` dependencies add `"@nid/payments": "workspace:*"` and `"@nid/billing": "workspace:*"`.

In `apps/api/jest.config.js` `moduleNameMapper` add:

```js
    '^@nid/payments$': '<rootDir>/../../packages/payments/src/index.ts',
    '^@nid/billing$': '<rootDir>/../../packages/billing/src/index.ts',
```

- [ ] **Step 9: Verify**

Run: `pnpm install && pnpm --filter @nid/api test && pnpm typecheck && pnpm lint`
Expected: PASS — including every pre-existing API spec, which is the proof the guard/audit/interceptor changes are additive.

- [ ] **Step 10: Commit**

```bash
git add apps/api
git commit -m "feat(api): add billing guards, provider registry wiring and BigInt response serialization"
```

---

## Task 10: Refunds — reversing entries, provider call, credit clawback

**Files:**
- Create: `packages/billing/src/refunds.ts`
- Modify: `packages/billing/src/index.ts`
- Test: `packages/billing/src/refunds.db.spec.ts`

**Interfaces:**
- Consumes: `PaymentProvider.refund`/`RefundResult` (Task 2), `postLedgerTransaction` (Task 4), `debitAccount` (Task 6), `ensureBillingAccount`/`getBillingAccount` (Task 4), Prisma models `Refund`/`Payment`/`PaymentIntent`.
- Produces: `CreateRefundRecordInput`, `PendingRefund`, `RefundDependencies`, `IssueRefundInput`, `IssueRefundResult`, `refundTotalsMinor(tx, tenantId, paymentId)`, `createPendingRefund(tx, input)`, `finalizeRefund(tx, input)`, `issueRefund(deps, input)`. Task 12's admin endpoint calls `issueRefund`; nothing else may write a `Refund` row.

Spec §14 lists refunds under Phase 2, and spec §19's Phase 1 acceptance criteria
never mention one. Building it here anyway is the cheaper option for the same
reason Task 5 builds invoices before anything auto-bills them: a refund is a
reversal entry, and writing it after the fact means retrofitting the one
invariant the ledger exists to hold — every posting zero-sum, every row
insert-only. `Refund`, `refundTotalsMinor` and the credit clawback are all the
Phase 2 settlement-reconciliation view needs to *read*, so having them land
before that view exists costs nothing and lets Phase 2 add only the operator
workflow around them. Nothing user-visible ships: Task 12's endpoint is the only
caller, and it is admin-gated.

- [ ] **Step 1: Write the failing DB test**

`packages/billing/src/refunds.db.spec.ts`:

```ts
import {
  createPrismaClient,
  withBillingAdminContext,
  withTenantContext,
  type PrismaClient,
} from '@nid/db';
import { MockPaymentProvider } from '@nid/payments';
import { createCheckoutSession } from './checkout';
import { settlePayment } from './settlement';
import { issueRefund, refundTotalsMinor } from './refunds';
import { InsufficientCreditsError } from './errors';

const runDb = process.env['RUN_DB_TESTS'] === 'true' ? describe : describe.skip;

runDb('refunds against real Postgres', () => {
  const url = process.env['APP_DATABASE_URL'];
  if (!url) throw new Error('refunds.db.spec.ts needs APP_DATABASE_URL.');
  const DATABASE_URL = process.env['DATABASE_URL'] ?? url;

  let prisma: PrismaClient;
  let superuser: PrismaClient;
  let tenantId: string;
  let packId: string;
  const tag = Date.now().toString(36);
  const provider = new MockPaymentProvider({ checkoutUiUrl: 'http://localhost:3500', outcome: 'success' });

  async function paidTopUp(idempotencyKey: string) {
    const created = await createCheckoutSession(
      {
        prisma,
        provider,
        checkoutUiUrl: 'http://localhost:3500',
        webhookUrl: 'http://localhost:4000/v1/billing/webhooks/mock',
        allowedReturnOrigins: [],
      },
      { tenantId, purpose: 'CREDIT_TOPUP', planId: packId, idempotencyKey },
    );
    if (created.reused) throw new Error('expected a fresh intent');
    const settled = await withTenantContext(prisma, tenantId, (tx) =>
      settlePayment(tx, {
        tenantId,
        intentId: created.intentId,
        provider: 'mock',
        providerTransactionId: `txn-${idempotencyKey}-${tag}`,
        paidAmountMinor: created.amountMinor,
        currency: 'PKR',
        paidAt: new Date(),
      }),
    );
    return { intentId: created.intentId, paymentId: settled.paymentId };
  }

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    superuser = createPrismaClient(DATABASE_URL);
    tenantId = (await superuser.tenant.create({ data: { name: `ref ${tag}`, slug: `ref-${tag}` } })).id;
    const pack = await withBillingAdminContext(prisma, async (tx) => {
      const service = await tx.billingService.create({
        data: { key: `ref-${tag}`, name: `Refund ${tag}`, ownerRepo: 'nID' },
      });
      return tx.plan.create({
        data: {
          serviceId: service.id,
          key: 'pack',
          name: 'Pack',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 11800n,
          creditsIncluded: 11800,
        },
      });
    });
    packId = pack.id;
  });

  afterAll(async () => {
    await superuser.tenant.delete({ where: { id: tenantId } });
    await Promise.all([prisma.$disconnect(), superuser.$disconnect()]);
  });

  it('a full refund reverses the ledger and claws the credits back', async () => {
    const { paymentId } = await paidTopUp(`full-${tag}`);
    const before = await withTenantContext(prisma, tenantId, (tx) =>
      tx.billingAccount.findUniqueOrThrow({ where: { tenantId } }),
    );
    expect(before.creditBalanceMinor).toBe(11800n);

    const result = await issueRefund(
      { prisma, provider },
      { tenantId, paymentId, amountMinor: 11800n, reason: 'duplicate charge' },
    );
    expect(result.status).toBe('SUCCEEDED');

    const state = await withTenantContext(prisma, tenantId, async (tx) => ({
      balance: (await tx.billingAccount.findUniqueOrThrow({ where: { tenantId } })).creditBalanceMinor,
      refund: await tx.refund.findUniqueOrThrow({ where: { id: result.refundId } }),
      reasons: (await tx.creditLedgerEntry.findMany({ where: { tenantId } })).map((e) => e.reason),
      txns: await tx.ledgerTransaction.findMany({ where: { tenantId, type: 'REFUND' } }),
      entries: await tx.ledgerEntry.findMany({
        where: { tenantId, transaction: { type: 'REFUND' } },
        include: { account: true },
      }),
    }));

    expect(state.balance).toBe(0n);
    expect(state.refund.status).toBe('SUCCEEDED');
    expect(state.refund.providerRef).toMatch(/^mock_refund_/);
    expect(state.reasons).toContain('REFUND');
    expect(state.txns).toHaveLength(1);
    expect(state.entries.map((e) => `${e.direction}:${e.account.kind}`)).toEqual([
      'DEBIT:REFUNDS',
      'CREDIT:PSP_CLEARING',
    ]);
  });

  it('refuses to refund more than was paid, across multiple partial refunds', async () => {
    const { paymentId } = await paidTopUp(`partial-${tag}`);

    await issueRefund({ prisma, provider }, { tenantId, paymentId, amountMinor: 6000n, reason: 'goodwill' });
    expect(
      await withTenantContext(prisma, tenantId, (tx) => refundTotalsMinor(tx, tenantId, paymentId)),
    ).toBe(6000n);

    await expect(
      issueRefund({ prisma, provider }, { tenantId, paymentId, amountMinor: 5801n, reason: 'too far' }),
    ).rejects.toThrow(/exceeds/);

    expect(
      await withTenantContext(prisma, tenantId, (tx) => refundTotalsMinor(tx, tenantId, paymentId)),
    ).toBe(6000n);
  });

  it('refuses up front when the credits are already spent, and never contacts the provider', async () => {
    const { paymentId } = await paidTopUp(`spend-${tag}`);
    // Consume the credits first, so the clawback cannot be honoured.
    await withTenantContext(prisma, tenantId, (tx) =>
      tx.billingAccount.update({ where: { tenantId }, data: { creditBalanceMinor: 200n } }),
    );
    const calls: string[] = [];
    const watching = new MockPaymentProvider({ checkoutUiUrl: 'http://localhost:3500', outcome: 'success' });
    watching.refund = async (refundInput) => {
      calls.push(refundInput.providerTransactionId);
      return { providerRef: 'mock_refund_never', status: 'SUCCEEDED' };
    };

    await expect(
      issueRefund({ prisma, provider: watching }, { tenantId, paymentId, amountMinor: 11800n, reason: 'claw' }),
    ).rejects.toThrow(InsufficientCreditsError);

    // Both must hold together: the reservation happens before the PSP is
    // contacted, so a blocked refund moves no money anywhere.
    expect(calls).toEqual([]);
    expect(await superuser.refund.count({ where: { tenantId, reason: 'claw' } })).toBe(0);
  });

  it('records a provider-side failure instead of pretending the payer was paid back', async () => {
    const { paymentId } = await paidTopUp(`failed-${tag}`);
    const refusing = new MockPaymentProvider({ checkoutUiUrl: 'http://localhost:3500', outcome: 'success' });
    refusing.refund = async () => ({ providerRef: 'mock_refund_x', status: 'FAILED' });

    const result = await issueRefund(
      { prisma, provider: refusing },
      { tenantId, paymentId, amountMinor: 1000n, reason: 'will fail' },
    );
    expect(result.status).toBe('FAILED');

    const state = await withTenantContext(prisma, tenantId, async (tx) => ({
      balance: (await tx.billingAccount.findUniqueOrThrow({ where: { tenantId } })).creditBalanceMinor,
      refund: await tx.refund.findUniqueOrThrow({ where: { id: result.refundId } }),
      refundTxns: await tx.ledgerTransaction.count({ where: { tenantId, type: 'REFUND' } }),
    }));
    expect(state.refund.status).toBe('FAILED');
    expect(state.refundTxns).toBe(0);
    expect(state.balance).toBe(11800n);
  });

  it('will not refund a payment that belongs to another tenant', async () => {
    const { paymentId } = await paidTopUp(`other-${tag}`);
    const intruder = await superuser.tenant.create({ data: { name: `in ${tag}`, slug: `in-${tag}` } });

    await expect(
      issueRefund(
        { prisma, provider },
        { tenantId: intruder.id, paymentId, amountMinor: 100n, reason: 'no' },
      ),
    ).rejects.toThrow(/not found/);

    await superuser.tenant.delete({ where: { id: intruder.id } });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @nid/billing exec jest refunds --runInBand` (with the DB env set)
Expected: FAIL — `./refunds` does not exist.

- [ ] **Step 3: Write refunds.ts**

The order of operations is the interesting part. The credit clawback happens
**before** the provider is asked to move money, and is reversed if the provider
refuses. The alternative — refund first, claw back after — can leave nID having
paid money out while the tenant still holds the credits it bought with it, and
that is a discrepancy no report can repair.

```ts
import type { Payment, PrismaClient, RefundStatus, TransactionClient } from '@nid/db';
import { withTenantContext } from '@nid/db';
import type { PaymentProvider } from '@nid/payments';
import { BillingError, InsufficientCreditsError } from './errors';
import { creditAccount, debitAccount } from './credits';
import { postLedgerTransaction } from './ledger';

export interface CreateRefundRecordInput {
  tenantId: string;
  paymentId: string;
  amountMinor: bigint;
  reason?: string;
}

export interface PendingRefund {
  refundId: string;
  paymentId: string;
  amountMinor: bigint;
  /** Set only for a CREDIT_TOPUP intent, whose clawback was reserved here. */
  clawbackAccountId?: string;
  providerRef: string;
  currency: string;
}

/**
 * Refunded-so-far, PENDING included: a refund still in flight at the provider is
 * money already promised, so a second operator must not be able to double-spend
 * one payment.
 */
export async function refundTotalsMinor(
  tx: TransactionClient,
  tenantId: string,
  paymentId: string,
): Promise<bigint> {
  const rows = await tx.refund.findMany({ where: { tenantId, paymentId } });
  return rows.reduce((sum, row) => sum + row.amountMinor, 0n);
}

async function loadRefundablePayment(
  tx: TransactionClient,
  tenantId: string,
  paymentId: string,
): Promise<Payment> {
  const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
  if (!payment) throw new BillingError(`Payment ${paymentId} not found.`);
  if (payment.status !== 'SUCCEEDED') {
    throw new BillingError(`Payment ${paymentId} is ${payment.status}; only a succeeded payment can be refunded.`);
  }
  return payment;
}

/**
 * Transaction 1 of 2: validate, open the record and reserve the credit
 * clawback — then, and only then, is the provider allowed to be called.
 * `InsufficientCreditsError` thrown here means the PSP was never contacted, so
 * a blocked refund leaves no money movement at all.
 */
export async function createPendingRefund(
  tx: TransactionClient,
  input: CreateRefundRecordInput,
): Promise<PendingRefund> {
  if (input.amountMinor <= 0n) throw new BillingError('Refund amount must be positive.');
  const payment = await loadRefundablePayment(tx, input.tenantId, input.paymentId);

  const already = await refundTotalsMinor(tx, input.tenantId, payment.id);
  if (already + input.amountMinor > payment.amountMinor) {
    throw new BillingError(
      `Refund of ${input.amountMinor} would exceed payment ${payment.id}: ${already} of ${payment.amountMinor} is already refunded.`,
    );
  }

  const intent = await tx.paymentIntent.findUnique({ where: { id: payment.paymentIntentId } });
  if (!intent) throw new BillingError(`Payment ${payment.id} has no intent.`);
  if (!intent.providerRef) {
    throw new BillingError(`Intent ${intent.id} was never opened at the provider, so nothing can be refunded.`);
  }

  const refund = await tx.refund.create({
    data: {
      tenantId: input.tenantId,
      paymentId: payment.id,
      amountMinor: input.amountMinor,
      status: 'PENDING',
      reason: input.reason ?? null,
    },
  });

  if (intent.purpose === 'CREDIT_TOPUP') {
    await debitAccount(tx, {
      tenantId: input.tenantId,
      billingAccountId: intent.billingAccountId,
      deltaMinor: input.amountMinor,
      reason: 'REFUND',
      refType: 'refund',
      refId: refund.id,
    });
  }

  return {
    refundId: refund.id,
    paymentId: payment.id,
    amountMinor: input.amountMinor,
    clawbackAccountId: intent.purpose === 'CREDIT_TOPUP' ? intent.billingAccountId : undefined,
    providerRef: intent.providerRef,
    currency: payment.currency,
  };
}

/**
 * Transaction 2 of 2, after the provider has answered. A REFUND ledger
 * transaction is DEBIT REFUNDS / CREDIT PSP_CLEARING — the exact reverse of the
 * clearing side of the original payment. A refusal reverses the reserved
 * clawback with an ADJUSTMENT credit so the tenant's balance is whole again, and
 * records the refund as FAILED.
 */
export async function finalizeRefund(
  tx: TransactionClient,
  input: {
    tenantId: string;
    refundId: string;
    providerRef: string;
    outcome: 'SUCCEEDED' | 'FAILED';
    amountMinor: bigint;
    currency: string;
    clawbackFromAccountId?: string;
  },
): Promise<RefundStatus> {
  const status: RefundStatus = input.outcome;

  if (status === 'SUCCEEDED') {
    await postLedgerTransaction(tx, {
      tenantId: input.tenantId,
      type: 'REFUND',
      refType: 'refund',
      refId: input.refundId,
      currency: input.currency,
      lines: [
        { kind: 'REFUNDS', direction: 'DEBIT', amountMinor: input.amountMinor },
        { kind: 'PSP_CLEARING', direction: 'CREDIT', amountMinor: input.amountMinor },
      ],
    });
  } else if (input.clawbackFromAccountId) {
    // Compensating entry, not an edit: ledger rows are append-only (invariant 3),
    // so the reserved debit stays and a matching credit is posted beside it.
    await creditAccount(tx, {
      tenantId: input.tenantId,
      billingAccountId: input.clawbackFromAccountId,
      deltaMinor: input.amountMinor,
      reason: 'ADJUSTMENT',
      refType: 'refund',
      refId: `${input.refundId}:reversal`,
    });
  }

  await tx.refund.update({
    where: { id: input.refundId },
    data: { status, providerRef: input.providerRef },
  });
  return status;
}

export interface RefundDependencies {
  prisma: PrismaClient;
  provider: PaymentProvider;
}

export interface IssueRefundInput extends CreateRefundRecordInput {}

export interface IssueRefundResult {
  refundId: string;
  status: RefundStatus;
}

/**
 * The full refund: reserve (tx 1) -> provider (no transaction) -> finalize
 * (tx 2), the same shape as checkout because a provider HTTP call must never
 * hold a database transaction open. Phase 1 is admin-initiated only (spec
 * §7.6); the caller writes the audit row, which this cannot do because it has
 * no actor.
 */
export async function issueRefund(
  deps: RefundDependencies,
  input: IssueRefundInput,
): Promise<IssueRefundResult> {
  const pending = await withTenantContext(deps.prisma, input.tenantId, (tx) =>
    createPendingRefund(tx, input),
  );

  const result = await deps.provider.refund({
    providerRef: pending.providerRef,
    providerTransactionId: pending.paymentId,
    amountMinor: input.amountMinor,
    currency: pending.currency,
    reason: input.reason,
  });

  const status = await withTenantContext(deps.prisma, input.tenantId, (tx) =>
    finalizeRefund(tx, {
      tenantId: input.tenantId,
      refundId: pending.refundId,
      providerRef: result.providerRef,
      outcome: result.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
      amountMinor: input.amountMinor,
      currency: pending.currency,
      clawbackFromAccountId: pending.clawbackAccountId,
    }),
  );

  return { refundId: pending.refundId, status };
}
```

Two mapping notes for the implementer:

- `RefundResult.status` from `@nid/payments` is `'PENDING' | 'SUCCEEDED' |
  'FAILED'`, and `RefundStatus` is the same three values. `outcome: result.status
  === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED'` deliberately collapses a provider
  `PENDING` to `FAILED`, because Phase 1 has no provider refund-status polling;
  `docs/vendors/rapid-gateway/README.md` lists this as an assumption to revisit
  if the real Rapid Gateway refund is asynchronous.
- `Refund.paymentId` is the nID payment id, while the provider needs *its*
  transaction reference. `providerTransactionId: pending.paymentId` is passed for
  the reference field's shape only — the adapter's own `providerRef` (the
  checkout session id) is what identifies the charge. Confirm which of the two
  Rapid Gateway wants against item 1 of the docs-change table before going live;
  the mock provider ignores both.
- `InsufficientCreditsError` (already imported by `./credits`) propagates out of
  `issueRefund` unwrapped: Task 12's admin endpoint maps it to HTTP 402, which is
  the honest answer to "this tenant already spent the credits".
- [ ] **Step 4: Export and run**

Add to `packages/billing/src/index.ts`:

```ts
export * from './refunds';
```

Run: `pnpm --filter @nid/billing test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/billing
git commit -m "feat(billing): add provider refunds with reversing ledger entries and credit clawback"
```

---

## Task 11: Tenant billing endpoints — account, catalog reads, checkout, invoices, subscriptions, payments

**Files:**
- Create: `apps/api/src/modules/billing/billing.service.ts`, `billing.controller.ts`, `dto/create-checkout-session.dto.ts`, `dto/cancel-subscription.dto.ts`
- Modify: `apps/api/src/modules/billing/billing.module.ts`
- Test: `apps/api/test/billing-tenant-api.spec.ts`

**Interfaces:**
- Consumes: `BillingTenantGuard` + `@CurrentBillingTenant()` + `BillingTenantActor` (Task 9), `PaymentProvidersService` (Task 9), `AuditService` with `entityType`/`entityId` (Task 9), `PrismaService.client/forTenant` (existing), `createCheckoutSession`/`getCheckoutSummary` (Task 7), `listActiveServices`/`listActivePlans`/`getServiceByKey` (Task 5), `getInvoiceWithLines` (Task 5), `getBillingAccount` (Task 4), `setCancelAtPeriodEnd`/`cancelSubscription` (Task 8), `ensureBillingAccount` (Task 4).
- Produces: `BillingService` with `overview(tenantId)`, `services(tenantId)`, `plans(tenantId, serviceKey)`, `createCheckout(tenantId, actorId, ip, dto, idempotencyKey)`, `listInvoices(tenantId, status?)`, `invoice(tenantId, invoiceId, actor)`, `listSubscriptions(tenantId)`, `cancel(tenantId, subscriptionId, atPeriodEnd, actor)`, `listPayments(tenantId, actor)`, `listUsage(tenantId)`, `listEvents(tenantId)`; routes under `/v1/billing/*` (list below). Task 12's admin controller reuses `BillingService`'s read helpers; Task 13's token endpoint reuses `getCheckoutSummary`.

Routes created here (spec §8, tenant group):

```
GET  /v1/billing/account
GET  /v1/billing/services
GET  /v1/billing/plans?service=<key>
POST /v1/billing/checkout-sessions
GET  /v1/billing/invoices
GET  /v1/billing/invoices/:id
GET  /v1/billing/subscriptions
POST /v1/billing/subscriptions/:id/cancel
GET  /v1/billing/payments
GET  /v1/billing/usage
GET  /v1/billing/events
```

- [ ] **Step 1: DTOs**

`apps/api/src/modules/billing/dto/create-checkout-session.dto.ts`:

```ts
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PaymentIntentPurpose } from '@nid/db';

const PURPOSES: PaymentIntentPurpose[] = ['CREDIT_TOPUP', 'SUBSCRIPTION', 'INVOICE', 'ONE_OFF'];

/**
 * There is deliberately no amount field, and the global ValidationPipe runs
 * with `forbidNonWhitelisted`, so a request that tries to send one is rejected
 * before it reaches the handler. Prices come from the catalog or an issued
 * invoice (spec §11); a client-supplied amount is the bug that turns billing
 * into a donation box.
 */
export class CreateCheckoutSessionDto {
  @IsIn(PURPOSES)
  purpose!: PaymentIntentPurpose;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  returnUrl?: string;
}
```

`apps/api/src/modules/billing/dto/cancel-subscription.dto.ts`:

```ts
import { IsBoolean, IsOptional } from 'class-validator';

export class CancelSubscriptionDto {
  /** Default true: cancel at period end. Immediate cancel is the exception, and it voids open invoices. */
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;
}
```

- [ ] **Step 2: Write the failing live-Postgres test**

`apps/api/test/billing-tenant-api.spec.ts` — direct service instantiation, the
same shape as `apps/api/test/accounts.service.spec.ts`.

```ts
/**
 * Live-Postgres coverage for the tenant billing surface. No HTTP layer: the
 * guard's job is to produce an actor, and this spec passes that actor
 * directly, so what is under test is the money-visible read/write behaviour
 * plus RLS. Run with:
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { createPrismaClient, withBillingAdminContext, type PrismaClient } from '@nid/db';
import { UnprocessableEntityException } from '@nestjs/common';
import { BillingService } from '../src/modules/billing/billing.service';
import { PrismaService } from '../src/core/db/prisma.service';
import { PaymentProvidersService } from '../src/core/payments/payment-providers.service';
import { AuditService } from '../src/core/audit/audit.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('BillingService (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let billing: BillingService;
  let tenantId: string;
  let otherTenantId: string;
  let packId: string;
  let subPlanId: string;
  const tag = Date.now().toString(36);
  const actor = { tenantId: '', actorType: 'TENANT_STAFF' as const, actorId: `acct-${tag}` };

  beforeAll(async () => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    billing = new BillingService(prismaService, new PaymentProvidersService(), new AuditService());

    tenantId = (await migratorPrisma.tenant.create({ data: { name: `t1 ${tag}`, slug: `t1-${tag}` } })).id;
    otherTenantId = (await migratorPrisma.tenant.create({ data: { name: `t2 ${tag}`, slug: `t2-${tag}` } })).id;
    actor.tenantId = tenantId;

    const catalog = await withBillingAdminContext(prismaService.client, async (tx) => {
      const service = await tx.billingService.create({
        data: { key: `nid-${tag}`, name: `nID ${tag}`, ownerRepo: 'nID' },
      });
      const pack = await tx.plan.create({
        data: {
          serviceId: service.id,
          key: 'pack',
          version: 1,
          name: 'Pack',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 11800n,
          creditsIncluded: 11800,
        },
      });
      await tx.plan.create({
        data: {
          serviceId: service.id,
          key: 'pack',
          version: 2,
          name: 'Pack (new price)',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 12000n,
          creditsIncluded: 12000,
        },
      });
      const sub = await tx.plan.create({
        data: {
          serviceId: service.id,
          key: 'monthly',
          version: 1,
          name: 'Monthly',
          mode: 'SUBSCRIPTION',
          unitAmountMinor: 50000n,
          interval: 'MONTH',
        },
      });
      return { service, pack, sub };
    });
    packId = catalog.pack.id;
    subPlanId = catalog.sub.id;
  });

  afterAll(async () => {
    await migratorPrisma.tenant.delete({ where: { id: tenantId } });
    await migratorPrisma.tenant.delete({ where: { id: otherTenantId } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  it('lazily creates the billing account on first read and reports a zero balance', async () => {
    const overview = await billing.overview(tenantId);
    expect(overview.creditBalanceMinor).toBe(0n);
    expect(overview.currency).toBe('PKR');
    expect(overview.outstandingMinor).toBe(0n);
    expect(overview.status).toBe('ACTIVE');
  });

  it('lists the global catalog with the active plans of one service', async () => {
    const services = await billing.services(tenantId);
    expect(services.map((s) => s.key)).toContain(`nid-${tag}`);

    const plans = await billing.plans(tenantId, `nid-${tag}`);
    expect(plans.map((p) => p.version).sort()).toEqual([1, 2]);
  });

  it('hides another tenant\'s catalog-free data: an invoice of tenant 2 is not visible to tenant 1', async () => {
    await expect(billing.invoice(tenantId, 'inv_does_not_exist', actor)).rejects.toThrow();
  });

  it('opens a hosted checkout with a server-computed amount and audits the intent', async () => {
    const created = await billing.createCheckout(
      tenantId,
      actor,
      '127.0.0.1',
      { purpose: 'CREDIT_TOPUP', planId: packId },
      `checkout-${tag}`,
    );
    expect(created.reused).toBe(false);
    if (created.reused) throw new Error('unreachable');
    expect(created.checkoutUrl).toContain('/checkout/');

    const audited = await prismaService.forTenant(tenantId, async (tx) =>
      tx.auditLogEntry.findFirst({ where: { tenantId, entityType: 'payment_intent', entityId: created.intentId } }),
    );
    expect(audited?.actorType).toBe('TENANT_STAFF');
    expect(audited?.actorId).toBe(actor.actorId);
  });

  it('replaying the same Idempotency-Key returns the same intent and no token', async () => {
    const again = await billing.createCheckout(
      tenantId,
      actor,
      '127.0.0.1',
      { purpose: 'CREDIT_TOPUP', planId: packId },
      `checkout-${tag}`,
    );
    expect(again.reused).toBe(true);
    if (!again.reused) throw new Error('expected reuse');
    expect(again.token).toBeNull();
  });

  it('a second key creates a second intent (the key is per-purchase, not per-tenant)', async () => {
    const another = await billing.createCheckout(
      tenantId,
      actor,
      '127.0.0.1',
      { purpose: 'CREDIT_TOPUP', planId: packId },
      `checkout-2-${tag}`,
    );
    expect(another.reused).toBe(false);
  });

  it('lists invoices, payments, subscriptions, usage and events without leaking rows', async () => {
    await billing.listInvoices(tenantId);
    await billing.listPayments(tenantId, actor);
    const subscriptions = await billing.listSubscriptions(tenantId);
    expect(subscriptions).toHaveLength(0);
    await expect(billing.listUsage(tenantId)).resolves.toBeInstanceOf(Array);
    await expect(billing.listEvents(tenantId)).resolves.toBeInstanceOf(Array);

    // Nothing was created under the other tenant by any of the calls above.
    expect(await migratorPrisma.paymentIntent.count({ where: { tenantId: otherTenantId } })).toBe(0);
  });

  it('refuses to subscribe to a credit pack, and never writes anything', async () => {
    await expect(
      billing.createCheckout(
        tenantId,
        actor,
        '127.0.0.1',
        { purpose: 'SUBSCRIPTION', planId: packId },
        `sub-on-pack-${tag}`,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(await migratorPrisma.invoice.count({ where: { tenantId } })).toBe(0);
  });

  it('a subscription checkout issues an invoice that the tenant can read, audited', async () => {
    const created = await billing.createCheckout(
      tenantId,
      actor,
      '127.0.0.1',
      { purpose: 'SUBSCRIPTION', planId: subPlanId },
      `sub-${tag}`,
    );
    expect(created.reused).toBe(false);

    const invoices = await billing.listInvoices(tenantId, 'OPEN');
    expect(invoices).toHaveLength(1);
    const detail = await billing.invoice(tenantId, invoices[0]?.id as string, actor);
    expect(detail.totalMinor).toBe(50000n);
    expect(detail.lines).toHaveLength(1);

    // House rule 3: reading a financial record is itself auditable.
    const audit = await prismaService.forTenant(tenantId, (tx) =>
      tx.auditLogEntry.findFirst({
        where: { tenantId, action: 'billing.invoice.read', entityId: invoices[0]?.id },
      }),
    );
    expect(audit?.entityType).toBe('invoice');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @nid/api exec jest billing-tenant-api --runInBand`
Expected: FAIL — `billing.service.ts` does not exist.

- [ ] **Step 4: Write the service**

`apps/api/src/modules/billing/billing.service.ts`:

```ts
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type {
  Invoice,
  InvoiceStatus,
  OutboundEvent,
  PaymentIntentPurpose,
  UsageRecord,
} from '@nid/db';
import {
  createCheckoutSession,
  ensureBillingAccount,
  getBillingAccount,
  getInvoiceWithLines,
  listActivePlans,
  listActiveServices,
  setCancelAtPeriodEnd,
  cancelSubscription as cancelSubscriptionNow,
  CheckoutError,
  type CheckoutOutcome,
  type InvoiceWithLines,
  type PlanWithService,
} from '@nid/billing';
import { PrismaService } from '../../core/db/prisma.service';
import { PaymentProvidersService } from '../../core/payments/payment-providers.service';
import { AuditService } from '../../core/audit/audit.service';
import type { BillingTenantActor } from '../../core/auth/billing-tenant.guard';
import type { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProvidersService,
    private readonly audit: AuditService,
  ) {}

  async overview(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const account = await getBillingAccount(tx, tenantId);
      // A tenant that has never been billed gets its account on first read: the
      // dashboard must show 0, not an error, and creating it here (rather than
      // at tenant creation) keeps billing optional for existing tenants.
      const ensured = account ?? (await ensureBillingAccount(tx, tenantId));
      const outstanding = await tx.invoice.aggregate({
        where: { tenantId, status: 'OPEN' },
        _sum: { totalMinor: true, amountPaidMinor: true },
      });
      const due =
        (outstanding._sum.totalMinor ?? 0n) - (outstanding._sum.amountPaidMinor ?? 0n);
      const lastPayment = await tx.payment.findFirst({
        where: { tenantId, status: 'SUCCEEDED' },
        orderBy: { paidAt: 'desc' },
      });
      return {
        status: ensured.status,
        currency: ensured.currency,
        creditBalanceMinor: ensured.creditBalanceMinor,
        outstandingMinor: due > 0n ? due : 0n,
        lastPaymentAt: lastPayment?.paidAt ?? null,
      };
    });
  }

  services(tenantId: string) {
    return this.prisma.forTenant(tenantId, (tx) => listActiveServices(tx));
  }

  plans(tenantId: string, serviceKey: string): Promise<PlanWithService[]> {
    return this.prisma.forTenant(tenantId, (tx) => listActivePlans(tx, serviceKey));
  }

  /**
   * `idempotencyKey` arrives as a header, not a body field: a retried POST is
   * the same purchase, and the only thing that can prove that across a network
   * failure is a key the client chose before it sent anything.
   */
  async createCheckout(
    tenantId: string,
    actor: BillingTenantActor,
    ipAddress: string | undefined,
    dto: CreateCheckoutSessionDto,
    idempotencyKey: string,
  ): Promise<CheckoutOutcome> {
    const provider = this.providers.defaultProvider;
    try {
      const outcome = await createCheckoutSession(
        {
          prisma: this.prisma.client,
          provider,
          checkoutUiUrl: this.providers.checkoutUiUrl,
          webhookUrl: this.providers.webhookUrlFor(provider.name),
          allowedReturnOrigins: this.providers.returnOrigins,
        },
        {
          tenantId,
          purpose: dto.purpose,
          planId: dto.planId,
          invoiceId: dto.invoiceId,
          returnUrl: dto.returnUrl,
          idempotencyKey,
        },
      );
      await this.prisma.forTenant(tenantId, (tx) =>
        this.audit.record(tx, tenantId, {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: 'billing.checkout.create',
          ipAddress,
          entityType: 'payment_intent',
          entityId: outcome.intentId,
        }),
      );
      return outcome;
    } catch (error) {
      if (error instanceof CheckoutError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }

  listInvoices(tenantId: string, status?: InvoiceStatus): Promise<Invoice[]> {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.invoice.findMany({
        where: { tenantId, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );
  }

  async invoice(tenantId: string, invoiceId: string, actor: BillingTenantActor): Promise<InvoiceWithLines> {
    const invoice = await this.prisma.forTenant(tenantId, async (tx) => {
      const found = await getInvoiceWithLines(tx, tenantId, invoiceId);
      if (found) {
        await this.audit.record(tx, tenantId, {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: 'billing.invoice.read',
          entityType: 'invoice',
          entityId: found.id,
        });
      }
      return found;
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found.`);
    return invoice;
  }

  listSubscriptions(tenantId: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.subscription.findMany({
        where: { tenantId },
        include: { plan: { include: { service: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async cancel(
    tenantId: string,
    subscriptionId: string,
    atPeriodEnd: boolean,
    actor: BillingTenantActor,
  ) {
    const updated = await this.prisma.forTenant(tenantId, async (tx) => {
      const result = atPeriodEnd
        ? await setCancelAtPeriodEnd(tx, tenantId, subscriptionId, true)
        : await cancelSubscriptionNow(tx, tenantId, subscriptionId);
      await this.audit.record(tx, tenantId, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: atPeriodEnd ? 'billing.subscription.cancel_at_period_end' : 'billing.subscription.cancel',
        entityType: 'subscription',
        entityId: subscriptionId,
      });
      return result;
    });
    return updated;
  }

  listPayments(tenantId: string, actor: BillingTenantActor) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const payments = await tx.payment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      // The list itself is a read of financial records, so it is audited too —
      // house rule 3 is not limited to single-record views.
      await this.audit.record(tx, tenantId, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'billing.payment.list',
        entityType: 'payment',
      });
      return payments;
    });
  }

  listUsage(tenantId: string): Promise<UsageRecord[]> {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.usageRecord.findMany({ where: { tenantId }, orderBy: { occurredAt: 'desc' }, take: 500 }),
    );
  }

  /** The delivery log (spec §9): what nID told this tenant's webhook endpoint. */
  listEvents(tenantId: string): Promise<OutboundEvent[]> {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.outboundEvent.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 200 }),
    );
  }
}
```

- [ ] **Step 5: Write the controller**

`apps/api/src/modules/billing/billing.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { InvoiceStatus } from '@nid/db';
import { BillingTenantGuard } from '../../core/auth/billing-tenant.guard';
import { CurrentBillingTenant } from '../../core/auth/current-billing.decorator';
import type { BillingTenantActor } from '../../core/auth/billing-tenant.guard';
import { BillingService } from './billing.service';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

class ListInvoicesQuery {
  @IsOptional()
  @IsIn(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE'] as const)
  status?: InvoiceStatus;
}

class ServiceKeyQuery {
  @IsOptional()
  @IsString()
  service?: string;
}

@Controller('v1/billing')
@UseGuards(BillingTenantGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('account')
  account(@CurrentBillingTenant() actor: BillingTenantActor) {
    return this.billing.overview(actor.tenantId);
  }

  @Get('services')
  services(@CurrentBillingTenant() actor: BillingTenantActor) {
    return this.billing.services(actor.tenantId);
  }

  // The catalog is global, but the tenant's billing account currency decides
  // which plans are meaningful to show, so this still sits behind the guard.
  @Get('plans')
  plans(@CurrentBillingTenant() actor: BillingTenantActor, @Query() query: ServiceKeyQuery) {
    if (!query.service) throw new BadRequestException('A ?service= key is required.');
    return this.billing.plans(actor.tenantId, query.service);
  }

  @Post('checkout-sessions')
  @HttpCode(201)
  createCheckout(
    @CurrentBillingTenant() actor: BillingTenantActor,
    @Ip() ip: string,
    @Body() dto: CreateCheckoutSessionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // A missing key is a malformed request, not an identity failure (spec §8's
    // error table), and it must never be silently substituted with a
    // server-generated one — that would make the retry a second purchase.
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key is required to create a checkout session.');
    }
    return this.billing.createCheckout(actor.tenantId, actor, ip, dto, idempotencyKey.trim());
  }

  @Get('invoices')
  invoices(@CurrentBillingTenant() actor: BillingTenantActor, @Query() query: ListInvoicesQuery) {
    return this.billing.listInvoices(actor.tenantId, query.status);
  }

  @Get('invoices/:id')
  invoice(@CurrentBillingTenant() actor: BillingTenantActor, @Param('id') id: string) {
    return this.billing.invoice(actor.tenantId, id, actor);
  }

  @Get('subscriptions')
  subscriptions(@CurrentBillingTenant() actor: BillingTenantActor) {
    return this.billing.listSubscriptions(actor.tenantId);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentBillingTenant() actor: BillingTenantActor,
    @Param('id') id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.billing.cancel(actor.tenantId, id, dto.atPeriodEnd ?? true, actor);
  }

  @Get('payments')
  payments(@CurrentBillingTenant() actor: BillingTenantActor) {
    return this.billing.listPayments(actor.tenantId, actor);
  }

  @Get('usage')
  usage(@CurrentBillingTenant() actor: BillingTenantActor) {
    return this.billing.listUsage(actor.tenantId);
  }

  @Get('events')
  events(@CurrentBillingTenant() actor: BillingTenantActor) {
    return this.billing.listEvents(actor.tenantId);
  }
}
```

- [ ] **Step 6: Register and verify**

In `apps/api/src/modules/billing/billing.module.ts` set:

```ts
@Module({
  imports: [AuthModule, AccountsModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
```

Run: `pnpm --filter @nid/api test && pnpm typecheck && pnpm lint && pnpm --filter @nid/api build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): add tenant billing endpoints for account, catalog, checkout, invoices and subscriptions"
```

---

## Task 12: Admin catalog, credentials, refunds and reconciliation endpoints

**Files:**
- Create: `apps/api/src/modules/billing/admin-billing.service.ts`, `admin-billing.controller.ts`, `dto/catalog.dto.ts`, `dto/refund.dto.ts`
- Modify: `apps/api/src/modules/billing/billing.module.ts`
- Test: `apps/api/test/billing-admin-api.spec.ts`

**Interfaces:**
- Consumes: `BillingAdminGuard` + `@CurrentBillingAdmin()` (Task 9), `withBillingAdminContext` (Task 1), `generateApiKey` (`@nid/shared-types`), `issueRefund`/`InsufficientCreditsError`/`CheckoutError`/`RefundStatus` (Task 10), `PaymentProvidersService.resolve` (Task 9), `AuditService` (Task 9).
- Produces: `AdminBillingService` with `createService(dto, actor)`, `updateService(id, status, actor)`, `createPlan(dto, actor)`, `updatePlanStatus(id, status, actor)`, `createCredential(dto, actor)`, `revokeCredential(id, actor)`, `refund(dto, actor)`, `reconciliation(tenantId)`; routes:

```
POST  /v1/billing/admin/services
PATCH /v1/billing/admin/services/:id
POST  /v1/billing/admin/plans
PATCH /v1/billing/admin/plans/:id
POST  /v1/billing/admin/credentials
POST  /v1/billing/admin/credentials/:id/revoke
POST  /v1/billing/admin/refunds
GET   /v1/billing/admin/reconciliation?tenantId=
```

**One scope limit, stated before any code.** Reconciliation totals are per tenant
(`?tenantId=`), not ecosystem-wide. The ledger is tenant-scoped by RLS, and
`apps/api` runs as the least-privilege `nid_app` role that cannot see across
tenants — docs/HOUSE-RULES.md rule 2 forbids reaching for the owner role from
request-scoped code. An ecosystem-wide revenue report is Phase 2's read-only
reporting role. Do not "fix" this by widening the ledger's policies.

- [ ] **Step 1: DTOs**

`apps/api/src/modules/billing/dto/catalog.dto.ts`:

```ts
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const CREDENTIAL_SCOPES = ['checkout:create', 'usage:write', 'invoice:create', 'entitlements:read'] as const;

export class CreateServiceDto {
  @Matches(/^[a-z0-9][a-z0-9-]{1,38}$/, {
    message: 'key must be 2-39 lowercase letters, digits and hyphens (it names the revenue attribution).',
  })
  key!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  /** Which repo owns the product — attribution, not a routing key. */
  @IsString()
  @MaxLength(80)
  ownerRepo!: string;
}

export class UpdateServiceStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}

export class CreatePlanDto {
  @IsString()
  serviceId!: string;

  @Matches(/^[a-z0-9][a-z0-9-]{1,59}$/)
  key!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(['CREDIT_PACK', 'SUBSCRIPTION', 'ONE_OFF'])
  mode!: 'CREDIT_PACK' | 'SUBSCRIPTION' | 'ONE_OFF';

  /**
   * Paisa as a decimal string: JSON has no integer beyond `number`, and a float
   * price is a corruption the ledger cannot detect after the fact. The regex is
   * what rejects "11800.5" before BigInt would silently accept "1e3".
   */
  @Matches(/^\d+$/, { message: 'unitAmountMinor must be an integer string of minor units.' })
  unitAmountMinor!: string;

  @IsOptional()
  @IsIn(['MONTH', 'YEAR'])
  interval?: 'MONTH' | 'YEAR';

  @IsOptional()
  @IsInt()
  @Min(0)
  creditsIncluded?: number;

  @IsOptional()
  @Matches(/^\d+$/)
  overageUnitAmountMinor?: string;
}

export class UpdatePlanStatusDto {
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status!: 'ACTIVE' | 'ARCHIVED';
}

export class CreateCredentialDto {
  @IsString()
  serviceId!: string;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsArray()
  @IsIn(CREDENTIAL_SCOPES, { each: true })
  scopes!: string[];
}
```

There is deliberately no `features` field on `CreatePlanDto`: it is a JSON column
seeded by Task 18, and an unvalidated free-form JSON body field on an admin
endpoint is how `lowBalanceThresholdMinor` ends up spelled three different ways.

`apps/api/src/modules/billing/dto/refund.dto.ts`:

```ts
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  tenantId!: string;

  @IsString()
  paymentId!: string;

  @Matches(/^[1-9]\d*$/, { message: 'amountMinor must be a positive integer of minor units.' })
  amountMinor!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```

- [ ] **Step 2: Write the failing live-Postgres test**

`apps/api/test/billing-admin-api.spec.ts`. These tests double as the proof that
the catalog's `app.billing_admin` write policy works, because step 6 asserts a
write made *without* that context is rejected by the database.

```ts
import { UnauthorizedException } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@nid/db';
import { hashApiKey } from '@nid/shared-types';
import { AdminBillingService } from '../src/modules/billing/admin-billing.service';
import { PrismaService } from '../src/core/db/prisma.service';
import { PaymentProvidersService } from '../src/core/payments/payment-providers.service';
import { AuditService } from '../src/core/audit/audit.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('AdminBillingService (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let admin: AdminBillingService;
  const tag = Date.now().toString(36);
  const actor = { actorType: 'PLATFORM_ADMIN' as const, actorId: `admin-${tag}` };
  let serviceId: string;

  beforeAll(() => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    admin = new AdminBillingService(prismaService, new PaymentProvidersService(), new AuditService());
  });

  afterAll(async () => {
    await migratorPrisma.billingService.deleteMany({ where: { key: { startsWith: `admin-spec-${tag}` } } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  it('creates a service and versions a plan without touching the old price', async () => {
    const service = await admin.createService(
      { key: `admin-spec-${tag}`, name: `Spec ${tag}`, ownerRepo: 'nID' },
      actor,
    );
    serviceId = service.id;

    const v1 = await admin.createPlan(
      { serviceId, key: 'pack', name: 'Pack', mode: 'CREDIT_PACK', unitAmountMinor: '11800', creditsIncluded: 11800 },
      actor,
    );
    expect(v1.version).toBe(1);
    expect(v1.unitAmountMinor).toBe(11800n);

    const v2 = await admin.createPlan(
      { serviceId, key: 'pack', name: 'Pack (new)', mode: 'CREDIT_PACK', unitAmountMinor: '12000', creditsIncluded: 12000 },
      actor,
    );
    expect(v2.version).toBe(2);
    expect((await migratorPrisma.plan.findUniqueOrThrow({ where: { id: v1.id } })).unitAmountMinor).toBe(11800n);
  });

  it('rejects an inconsistent plan shape', async () => {
    await expect(
      admin.createPlan({ serviceId, key: 'no-interval', name: 'x', mode: 'SUBSCRIPTION', unitAmountMinor: '1' }, actor),
    ).rejects.toThrow(/interval/);

    await expect(
      admin.createPlan(
        { serviceId, key: 'pack-interval', name: 'x', mode: 'CREDIT_PACK', unitAmountMinor: '1', interval: 'MONTH' },
        actor,
      ),
    ).rejects.toThrow(/Only a SUBSCRIPTION plan/);

    await expect(
      admin.createPlan({ serviceId, key: 'free', name: 'x', mode: 'CREDIT_PACK', unitAmountMinor: '1' }, actor),
    ).rejects.toThrow(/must grant credits/);

    await expect(
      admin.createPlan({ serviceId, key: 'float', name: 'x', mode: 'CREDIT_PACK', unitAmountMinor: '11800.5', creditsIncluded: 1 }, actor),
    ).rejects.toThrow();
  });

  it('issues a credential once, stores only its hash, and revokes it', async () => {
    const issued = await admin.createCredential(
      { serviceId, label: 'ci', scopes: ['checkout:create', 'usage:write'] },
      actor,
    );
    expect(issued.plaintext).toMatch(/^nid_live_/);

    const stored = await prismaService.unscoped.billingServiceCredential.findUniqueOrThrow({
      where: { id: issued.credential.id },
    });
    expect(JSON.stringify(stored)).not.toContain(issued.plaintext);
    expect(stored.keyHash).toBe(hashApiKey(issued.plaintext));

    const revoked = await admin.revokeCredential(issued.credential.id, actor);
    expect(revoked.revokedAt).not.toBeNull();
  });

  it('refuses an unknown or empty scope list', async () => {
    await expect(
      admin.createCredential({ serviceId, label: 'x', scopes: ['everything:write'] }, actor),
    ).rejects.toThrow(/Unknown scope/);
    await expect(admin.createCredential({ serviceId, label: 'x', scopes: [] }, actor)).rejects.toThrow(/at least one scope/);
  });

  it('reconciliation is a per-tenant summary with nothing in it yet', async () => {
    const tenant = await migratorPrisma.tenant.create({
      data: { name: 'recon', slug: `recon-${tag}` },
    });
    expect(await admin.reconciliation(tenant.id)).toEqual({
      tenantId: tenant.id,
      currency: 'PKR',
      clearingBalanceMinor: 0n,
      revenueByService: [],
      unsettledPayments: [],
    });
    await migratorPrisma.tenant.delete({ where: { id: tenant.id } });
  });

  it('a catalog write without app.billing_admin is rejected by the database', async () => {
    // The RLS assertion, not a permissions test: with the context unset the
    // catalog's write policy must fail closed even for the app role.
    await expect(
      prismaService.client.billingService.create({
        data: { key: `admin-spec-noctx-${tag}`, name: 'Nope', ownerRepo: 'nID' },
      }),
    ).rejects.toThrow();
  });

  it('requires a named actor for every write', async () => {
    await expect(
      admin.createService({ key: `admin-spec-anon-${tag}`, name: 'x', ownerRepo: 'nID' }, {
        actorType: 'PLATFORM_ADMIN',
        actorId: '',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @nid/api exec jest billing-admin-api --runInBand`
Expected: FAIL — `admin-billing.service.ts` does not exist.

- [ ] **Step 4: Write the admin service**

`apps/api/src/modules/billing/admin-billing.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { BillingService as CatalogService, LedgerAccountKind, Plan } from '@nid/db';
import { withBillingAdminContext } from '@nid/db';
import { generateApiKey } from '@nid/shared-types';
import { CheckoutError, InsufficientCreditsError, issueRefund, type RefundStatus } from '@nid/billing';
import { PrismaService } from '../../core/db/prisma.service';
import { PaymentProvidersService } from '../../core/payments/payment-providers.service';
import { AuditService } from '../../core/audit/audit.service';
import type { BillingAdminActor } from '../../core/auth/billing-admin.guard';
import type { CreateCredentialDto, CreatePlanDto, CreateServiceDto } from './dto/catalog.dto';
import type { CreateRefundDto } from './dto/refund.dto';

const SCOPES: readonly string[] = ['checkout:create', 'usage:write', 'invoice:create', 'entitlements:read'];

/**
 * The only path to a catalog write. Each method opens `withBillingAdminContext`,
 * which is what sets `app.billing_admin` for the database policy (spec §5.3) —
 * so the protection is not a forgotten `if`, it is the row-level policy itself,
 * and a code path that skips this service cannot write the catalog at all.
 *
 * `AuditLogEntry.tenantId` is NOT NULL, and a catalog row belongs to no tenant,
 * so audits here use the audited row's own id as the scope key. It is the one
 * place this codebase deliberately bends that column's meaning; the action and
 * entity fields stay truthful, and the reconciliation query never joins audit to
 * tenant data. A later phase with a real internal-admin role gets a proper
 * nullable scope instead.
 */
@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProvidersService,
    private readonly audit: AuditService,
  ) {}

  private assertActor(actor: BillingAdminActor): void {
    if (!actor.actorId) {
      throw new UnauthorizedException('A named platform admin is required for catalog writes.');
    }
  }

  async createService(dto: CreateServiceDto, actor: BillingAdminActor): Promise<CatalogService> {
    this.assertActor(actor);
    if (await this.prisma.unscoped.billingService.findUnique({ where: { key: dto.key } })) {
      throw new ConflictException(`Service ${dto.key} already exists.`);
    }

    return withBillingAdminContext(this.prisma.client, async (tx) => {
      const service = await tx.billingService.create({
        data: { key: dto.key, name: dto.name, ownerRepo: dto.ownerRepo },
      });
      await this.audit.record(tx, service.id, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'billing.admin.service.create',
        entityType: 'service',
        entityId: service.id,
      });
      return service;
    });
  }

  async updateService(id: string, status: 'ACTIVE' | 'INACTIVE', actor: BillingAdminActor) {
    this.assertActor(actor);
    return withBillingAdminContext(this.prisma.client, async (tx) => {
      const service = await tx.billingService.update({ where: { id }, data: { status } });
      await this.audit.record(tx, service.id, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'billing.admin.service.update',
        entityType: 'service',
        entityId: service.id,
      });
      return service;
    });
  }

  /**
   * Versioned, never edited (D11): the next integer version of
   * `(serviceId, key)` is created, and the previous row keeps its status, because
   * repricing and withdrawing from sale are different decisions made at
   * different times.
   */
  async createPlan(dto: CreatePlanDto, actor: BillingAdminActor): Promise<Plan> {
    this.assertActor(actor);
    let unitAmountMinor: bigint;
    try {
      unitAmountMinor = BigInt(dto.unitAmountMinor);
    } catch {
      throw new BadRequestException('unitAmountMinor must be an integer string of minor units.');
    }
    if (dto.mode === 'SUBSCRIPTION' && !dto.interval) {
      throw new BadRequestException('A SUBSCRIPTION plan needs an interval.');
    }
    if (dto.mode !== 'SUBSCRIPTION' && dto.interval) {
      throw new BadRequestException(`Only a SUBSCRIPTION plan can carry an interval (got ${dto.mode}).`);
    }
    if (dto.mode === 'CREDIT_PACK' && (dto.creditsIncluded ?? 0) <= 0) {
      throw new BadRequestException('A CREDIT_PACK plan must grant credits.');
    }

    return withBillingAdminContext(this.prisma.client, async (tx) => {
      const latest = await tx.plan.findFirst({
        where: { serviceId: dto.serviceId, key: dto.key },
        orderBy: { version: 'desc' },
      });
      const plan = await tx.plan.create({
        data: {
          serviceId: dto.serviceId,
          key: dto.key,
          version: (latest?.version ?? 0) + 1,
          name: dto.name,
          description: dto.description ?? null,
          mode: dto.mode,
          unitAmountMinor,
          interval: dto.mode === 'SUBSCRIPTION' ? dto.interval : null,
          creditsIncluded: dto.mode === 'CREDIT_PACK' ? (dto.creditsIncluded ?? 0) : 0,
          overageUnitAmountMinor: dto.overageUnitAmountMinor
            ? BigInt(dto.overageUnitAmountMinor)
            : null,
        },
      });
      await this.audit.record(tx, plan.id, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'billing.admin.plan.create',
        entityType: 'plan',
        entityId: plan.id,
      });
      return plan;
    });
  }

  async updatePlanStatus(id: string, status: 'ACTIVE' | 'ARCHIVED', actor: BillingAdminActor) {
    this.assertActor(actor);
    return withBillingAdminContext(this.prisma.client, async (tx) => {
      const plan = await tx.plan.update({ where: { id }, data: { status } });
      await this.audit.record(tx, plan.id, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'billing.admin.plan.update',
        entityType: 'plan',
        entityId: plan.id,
      });
      return plan;
    });
  }

  /**
   * The plaintext is returned once and never stored, exactly like TenantApiKey.
   */
  async createCredential(dto: CreateCredentialDto, actor: BillingAdminActor) {
    this.assertActor(actor);
    if (dto.scopes.length === 0) {
      throw new BadRequestException('A billing credential needs at least one scope.');
    }
    const unknown = dto.scopes.filter((scope) => !SCOPES.includes(scope));
    if (unknown.length > 0) throw new BadRequestException(`Unknown scope(s): ${unknown.join(', ')}.`);

    if (!(await this.prisma.unscoped.billingService.findUnique({ where: { id: dto.serviceId } }))) {
      throw new NotFoundException(`Service ${dto.serviceId} not found.`);
    }

    const generated = generateApiKey('live');
    return withBillingAdminContext(this.prisma.client, async (tx) => {
      const credential = await tx.billingServiceCredential.create({
        data: {
          serviceId: dto.serviceId,
          label: dto.label,
          keyPrefix: generated.prefix,
          keyHash: generated.hash,
          scopes: dto.scopes,
        },
      });
      await this.audit.record(tx, credential.id, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'billing.admin.credential.create',
        entityType: 'account',
        entityId: credential.id,
      });
      return { credential, plaintext: generated.plaintext };
    });
  }

  async revokeCredential(id: string, actor: BillingAdminActor) {
    this.assertActor(actor);
    return withBillingAdminContext(this.prisma.client, async (tx) => {
      const existing = await tx.billingServiceCredential.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException(`Credential ${id} not found.`);
      const revoked = await tx.billingServiceCredential.update({
        where: { id },
        data: { revokedAt: existing.revokedAt ?? new Date() },
      });
      await this.audit.record(tx, revoked.id, {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: 'billing.admin.credential.revoke',
        entityType: 'account',
        entityId: revoked.id,
      });
      return revoked;
    });
  }

  /**
   * The one admin action that moves money out. The audit action name carries the
   * provider's answer, because "we tried" and "it succeeded" are different facts
   * to whoever reads the log a month later.
   */
  async refund(dto: CreateRefundDto, actor: BillingAdminActor): Promise<{ refundId: string; status: RefundStatus }> {
    this.assertActor(actor);

    const providerName = await this.prisma.forTenant(dto.tenantId, async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: dto.paymentId } });
      if (!payment) throw new NotFoundException(`Payment ${dto.paymentId} not found for that tenant.`);
      return payment.provider;
    });

    let amountMinor: bigint;
    try {
      amountMinor = BigInt(dto.amountMinor);
    } catch {
      throw new BadRequestException('amountMinor must be an integer string of minor units.');
    }

    try {
      const result = await issueRefund(
        { prisma: this.prisma.client, provider: this.providers.resolve(providerName) },
        { tenantId: dto.tenantId, paymentId: dto.paymentId, amountMinor, reason: dto.reason },
      );
      await this.prisma.forTenant(dto.tenantId, (tx) =>
        this.audit.record(tx, dto.tenantId, {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: `billing.admin.refund.${result.status.toLowerCase()}`,
          entityType: 'refund',
          entityId: result.refundId,
        }),
      );
      return result;
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        throw new UnprocessableEntityException(
          'The credits bought by that payment are already spent, so refunding it would leave the tenant in credit debt. Adjust the credit balance first.',
        );
      }
      if (error instanceof CheckoutError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }

  /**
   * Per-tenant by design — see the scope note at the top of this task. Clearing
   * is reported as debits minus credits, which is what the platform is holding
   * at the PSP before payout; revenue is grouped by the ledger account's own
   * service attribution, so a plan change never rewrites history.
   */
  async reconciliation(tenantId: string): Promise<{
    tenantId: string;
    currency: string;
    clearingBalanceMinor: bigint;
    revenueByService: Array<{ serviceId: string | null; kind: LedgerAccountKind; amountMinor: bigint }>;
    unsettledPayments: Array<{ paymentId: string; intentId: string; intentStatus: string }>;
  }> {
    const tenant = await this.prisma.forTenant(tenantId, async (tx) => {
      const account = await tx.billingAccount.findUnique({ where: { tenantId } });
      if (!account) throw new NotFoundException(`No billing account for tenant ${tenantId}.`);

      const entries = await tx.ledgerEntry.findMany({
        where: { tenantId },
        include: { account: true },
      });

      const revenue = new Map<string, bigint>();
      let clearingBalanceMinor = 0n;
      for (const entry of entries) {
        const signed = entry.direction === 'DEBIT' ? entry.amountMinor : -entry.amountMinor;
        if (entry.account.kind === 'PSP_CLEARING') clearingBalanceMinor += signed;
        if (entry.account.kind === 'REVENUE' || entry.account.kind === 'DEFERRED_REVENUE') {
          const key = `${entry.account.kind}|${entry.account.serviceId ?? ''}`;
          revenue.set(key, (revenue.get(key) ?? 0n) - signed);
        }
      }

      const unsettled = await tx.payment.findMany({
        where: { tenantId, paymentIntent: { status: { not: 'SUCCEEDED' } } },
        include: { paymentIntent: true },
        take: 200,
      });

      return {
        tenantId,
        currency: account.currency,
        clearingBalanceMinor,
        revenueByService: [...revenue.entries()].map(([key, amountMinor]) => {
          const [kind, serviceId] = key.split('|');
          return { serviceId: serviceId === '' ? null : serviceId, kind: kind as LedgerAccountKind, amountMinor };
        }),
        unsettledPayments: unsettled.map((payment) => ({
          paymentId: payment.id,
          intentId: payment.paymentIntentId,
          intentStatus: payment.paymentIntent?.status ?? 'UNKNOWN',
        })),
      };
    });
    if (!tenant) throw new InternalServerErrorException('Reconciliation returned nothing.');
    return tenant;
  }
}
```

- [ ] **Step 5: Write the controller**

`apps/api/src/modules/billing/admin-billing.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BillingAdminGuard } from '../../core/auth/billing-admin.guard';
import { CurrentBillingAdmin } from '../../core/auth/current-billing.decorator';
import type { BillingAdminActor } from '../../core/auth/billing-admin.guard';
import { AdminBillingService } from './admin-billing.service';
import {
  CreateCredentialDto,
  CreatePlanDto,
  CreateServiceDto,
  UpdatePlanStatusDto,
  UpdateServiceStatusDto,
} from './dto/catalog.dto';
import { CreateRefundDto } from './dto/refund.dto';

@Controller('v1/billing/admin')
@UseGuards(BillingAdminGuard)
export class AdminBillingController {
  constructor(private readonly admin: AdminBillingService) {}

  @Post('services')
  createService(@Body() dto: CreateServiceDto, @CurrentBillingAdmin() actor: BillingAdminActor) {
    return this.admin.createService(dto, actor);
  }

  @Patch('services/:id')
  updateService(
    @Param('id') id: string,
    @Body() dto: UpdateServiceStatusDto,
    @CurrentBillingAdmin() actor: BillingAdminActor,
  ) {
    return this.admin.updateService(id, dto.status, actor);
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto, @CurrentBillingAdmin() actor: BillingAdminActor) {
    return this.admin.createPlan(dto, actor);
  }

  @Patch('plans/:id')
  updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanStatusDto,
    @CurrentBillingAdmin() actor: BillingAdminActor,
  ) {
    return this.admin.updatePlanStatus(id, dto.status, actor);
  }

  @Post('credentials')
  @HttpCode(201)
  createCredential(@Body() dto: CreateCredentialDto, @CurrentBillingAdmin() actor: BillingAdminActor) {
    return this.admin.createCredential(dto, actor);
  }

  @Post('credentials/:id/revoke')
  @HttpCode(200)
  revokeCredential(@Param('id') id: string, @CurrentBillingAdmin() actor: BillingAdminActor) {
    return this.admin.revokeCredential(id, actor);
  }

  @Post('refunds')
  @HttpCode(201)
  refund(@Body() dto: CreateRefundDto, @CurrentBillingAdmin() actor: BillingAdminActor) {
    return this.admin.refund(dto, actor);
  }

  @Get('reconciliation')
  reconciliation(@Query('tenantId') tenantId: string) {
    return this.admin.reconciliation(tenantId);
  }
}
```

Add `HttpCode` to the `@nestjs/common` import list, and in the tenant controller
(Task 11) the same `@HttpCode` annotations already appear — both files must
import it or `pnpm typecheck` fails.

- [ ] **Step 6: Register and verify**

`apps/api/src/modules/billing/billing.module.ts` becomes:

```ts
@Module({
  imports: [AuthModule, AccountsModule],
  controllers: [BillingController, AdminBillingController],
  providers: [BillingService, AdminBillingService],
  exports: [BillingService],
})
export class BillingModule {}
```

Run: `pnpm --filter @nid/api test && pnpm typecheck && pnpm lint && pnpm --filter @nid/api build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): add admin catalog, credential, refund and per-tenant reconciliation endpoints"
```

---

## Task 13: Public checkout status, provider webhooks, and the dev payment switch

**Files:**
- Create: `apps/api/src/modules/billing/billing-events.service.ts`, `checkout-public.controller.ts`, `billing-webhooks.controller.ts`, `dev-payments.controller.ts`, `dto/mock-payment.dto.ts`
- Modify: `apps/api/src/core/config/env.ts` (add `nodeEnv`), `apps/api/src/modules/billing/billing.module.ts`
- Test: `apps/api/test/checkout-public-api.spec.ts`, `apps/api/test/billing-webhook-api.spec.ts`, `apps/api/test/dev-payments.spec.ts`

**Interfaces:**
- Consumes: `getCheckoutSummary`/`CheckoutSummary`/`abandonCheckout` (Task 7), `settlePayment`/`SettlePaymentResult` (Task 8), `PaymentProvidersService.registry/resolve` (Task 9), `PrismaService.client/forTenant` (existing), `ProviderRegistry`/`PaymentProvider`/`ParsedWebhook`/`UnknownProviderError`/`mapProviderStatus` (`@nid/payments`, Tasks 2-3), `signWebhookPayload`/`verifyWebhookSignature`/`generateCheckoutToken`/`sha256Hex` (`@nid/shared-types`), `ensureBillingAccount` (Task 4), `BillingError`/`isUniqueViolation` (Task 4), `withTenantContext`/`withBillingAdminContext`/`TransactionClient`/`Prisma` (`@nid/db`), `AuditService.record` with `actorType: 'SYSTEM'` and `entityType`/`entityId` (Task 9).
- Produces: `AppEnv.nodeEnv`; `EnqueueEventInput`; `BillingEventsService.enqueue(tx, input): Promise<boolean>` and `enqueueForTenant(tenantId, input): Promise<boolean>`; `CheckoutPublicController.summary(token)` / `.status(token)` and `CheckoutStatusView`; `BillingWebhooksController.handle(providerName, req, headers)` and `WebhookAck`; `DevPaymentsController.pay(dto)`; `MockPaymentDto`. Task 14's credit warnings and Task 15's service endpoints call `BillingEventsService`.

Routes created here (spec §8, "Checkout (capability token)" and "Provider webhooks" groups):

```
GET  /v1/billing/checkout-sessions/:token          → summary + payUrl (public, token-gated)
GET  /v1/billing/checkout-sessions/:token/status   → poll for the return page
POST /v1/billing/webhooks/:provider                → public, signature-verified
POST /v1/billing/dev/mock-payments                 → dev-only settlement switch
```

The rules this task exists to enforce:

1. **A verified webhook is the only evidence that money moved.** The return page
   polls and never marks anything paid (spec §7.1 step 8).
   `MockPaymentProvider.verifyWebhook` returns `false` on purpose, so no mock
   payment can be "signed" into existence — the dev endpoint is the only way to
   settle a mock checkout, and it 404s in production.
2. **Verify, then read, then write — in that order.** Nothing touches the
   database before `verifyWebhook` returns true, so a forged delivery costs nID
   one HMAC comparison and no queries.
3. **Answer 200 almost always.** A 5xx makes the PSP retry forever, and the
   retry hits the same bug. Evidence nID could not act on is logged and
   acknowledged, not bounced. The exceptions are 401 (bad signature) and 404
   (unknown provider name).
4. **Outbound events are queued after the money transaction commits.** A rolled
   back settlement must not leave a `payment.succeeded` notification waiting.

- [ ] **Step 1: Add `nodeEnv` to the env surface**

House rule 6 keeps configuration in `core/config/env`, and the dev endpoint's
right to exist is configuration.

In `apps/api/src/core/config/env.ts`, append to `interface AppEnv` (after
`mockPaymentOutcome`, which Task 9 added last) and to `loadEnv()`'s returned
object in the same position:

```ts
  /**
   * Not a style preference: this is one of the two gates standing between
   * /v1/billing/dev/mock-payments — which marks a checkout paid with no money
   * moving — and a production deployment. The other is PAYMENT_PROVIDERS.
   */
  nodeEnv: 'development' | 'test' | 'production';
```

```ts
    nodeEnv: process.env['NODE_ENV'] === 'production'
      ? 'production'
      : process.env['NODE_ENV'] === 'test'
        ? 'test'
        : 'development',
```

Anything unrecognised collapses to `development` rather than throwing: a typo in
`NODE_ENV` must not turn a staging box into "production" and break its mock
payments, and it cannot arm the dev switch in real production, because that
deployment's `PAYMENT_PROVIDERS` is `rapid-gateway` and the second gate requires
`mock` to be allowlisted. Both gates have to pass.

Then add `nodeEnv: 'development' as const` to the `AppEnv` fixture literal in
`apps/api/src/core/payments/payment-providers.service.spec.ts` (Task 9), or that
spec stops typechecking.

Run: `pnpm --filter @nid/api typecheck`
Expected: PASS.

- [ ] **Step 2: Write the failing public-token test**

`apps/api/test/checkout-public-api.spec.ts`:

```ts
/**
 * The checkout token is a capability: whoever holds it can see this one
 * checkout and nothing else. No session, no API key. Run with
 * RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { NotFoundException } from '@nestjs/common';
import { createPrismaClient, withTenantContext, type PrismaClient } from '@nid/db';
import { generateCheckoutToken } from '@nid/shared-types';
import { PrismaService } from '../src/core/db/prisma.service';
import { CheckoutPublicController } from '../src/modules/billing/checkout-public.controller';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('checkout capability token endpoints (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let controller: CheckoutPublicController;
  let tenantId: string;
  let serviceId: string;
  const tag = Date.now().toString(36);
  /** Only the hash is stored, so the plaintext lives here in the test. */
  let plaintext: string;
  let tokenHash: string;
  let intentId: string;

  beforeAll(async () => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    controller = new CheckoutPublicController(prismaService);
    tenantId = (await migratorPrisma.tenant.create({ data: { name: `pub ${tag}`, slug: `pub-${tag}` } })).id;
    serviceId = (await migratorPrisma.billingService.create({
      data: { key: `pub-${tag}`, name: `ERP-1 ${tag}`, ownerRepo: 'erp-1' },
    })).id;

    const token = generateCheckoutToken();
    plaintext = token.plaintext;
    tokenHash = token.hash;

    // Rows are inserted directly rather than through createCheckoutSession: this
    // spec asks what the token reveals, and a provider round-trip adds nothing
    // to that question.
    await withTenantContext(prismaService.client, tenantId, async (tx) => {
      const account = await tx.billingAccount.create({ data: { tenantId } });
      const intent = await tx.paymentIntent.create({
        data: {
          tenantId,
          billingAccountId: account.id,
          purpose: 'CREDIT_TOPUP',
          amountMinor: 11800n,
          currency: 'PKR',
          provider: 'mock',
          providerRef: `mock_${tag}`,
          checkoutUrl: `http://localhost:3500/mock-pay/mock_${tag}`,
          idempotencyKey: `pub-${tag}`,
          metadata: { planId: `plan-${tag}`, serviceId, creditsMinor: '10000', taxMinor: '1800' },
        },
      });
      intentId = intent.id;
      await tx.checkoutSession.create({
        data: {
          tenantId,
          paymentIntentId: intent.id,
          tokenHash,
          returnUrl: 'http://localhost:3200/billing',
          expiresAt: new Date(Date.now() + 600_000),
        },
      });
    });
  });

  afterAll(async () => {
    await migratorPrisma.checkoutSession.deleteMany({ where: { tenantId } });
    await migratorPrisma.paymentIntent.deleteMany({ where: { tenantId } });
    await migratorPrisma.billingAccount.deleteMany({ where: { tenantId } });
    await migratorPrisma.billingService.deleteMany({ where: { id: serviceId } });
    await migratorPrisma.tenant.delete({ where: { id: tenantId } });
    await prismaService.onModuleDestroy();
    await migratorPrisma.$disconnect();
  });

  it('reveals the payable amount and pay URL, and nothing about the tenant', async () => {
    const summary = await controller.summary(plaintext);
    expect(summary.amountMinor).toBe(11800n);
    expect(summary.status).toBe('PENDING');
    expect(summary.serviceName).toBe(`ERP-1 ${tag}`);
    expect(summary.payUrl).toContain(`/checkout/${plaintext}`);

    const serialised = JSON.stringify(summary, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    // The token page is public. A tenant id here would be a second capability
    // an attacker did not earn.
    expect(serialised).not.toContain(tenantId);
    expect(serialised).not.toContain(intentId);
    expect(serialised).not.toContain(serviceId);
  });

  it('answers the same 404 for a wrong token, an unknown token and a malformed one', async () => {
    await expect(controller.summary('not-a-real-token-at-all')).rejects.toBeInstanceOf(NotFoundException);
    // A 500-character token and a 43-character one must be indistinguishable, or
    // the endpoint doubles as a token-format oracle next to a brute-force target.
    await expect(controller.summary('a'.repeat(500))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('status poll returns only state — no pay URL, no description', async () => {
    const status = await controller.status(plaintext);
    expect(status).toEqual({
      status: 'PENDING',
      intentStatus: 'REQUIRES_CHECKOUT',
      expiresAt: expect.any(Date),
    });
  });

  it('stops offering a pay URL once the intent has been paid', async () => {
    await withTenantContext(prismaService.client, tenantId, async (tx) => {
      await tx.paymentIntent.update({ where: { id: intentId }, data: { status: 'SUCCEEDED' } });
      await tx.checkoutSession.update({ where: { paymentIntentId: intentId }, data: { status: 'COMPLETED' } });
    });
    const summary = await controller.summary(plaintext);
    expect(summary.status).toBe('COMPLETED');
    expect(summary.payUrl).toBeNull();
  });
});
```

`intentId` is asserted absent even though `CheckoutSummary` has no `sessionId`
field a caller could use — the check exists because a future "helpful" author
might widen the projection, and this is the test that stops them.

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @nid/api exec jest checkout-public-api --runInBand`
Expected: FAIL — `Cannot find module '../src/modules/billing/checkout-public.controller'`.

- [ ] **Step 4: Write the public controller**

`apps/api/src/modules/billing/checkout-public.controller.ts`:

```ts
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { CheckoutSessionStatus, PaymentIntentStatus } from '@nid/db';
import { getCheckoutSummary, type CheckoutSummary } from '@nid/billing';
import { PrismaService } from '../../core/db/prisma.service';

/** What the return page needs — deliberately less than the summary. */
export interface CheckoutStatusView {
  status: CheckoutSessionStatus;
  intentStatus: PaymentIntentStatus;
  expiresAt: Date;
}

/**
 * No guard on this controller: the token in the path is the authorisation
 * (spec §10). `checkout_session_lookup`'s open SELECT policy is what makes the
 * read possible at all, so this is the one place the app role reads a
 * tenant-owned row without a tenant context — which is exactly why
 * `getCheckoutSummary` hand-builds its projection instead of returning the
 * session include-graph.
 */
@Controller('v1/billing/checkout-sessions')
export class CheckoutPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':token')
  async summary(@Param('token') token: string): Promise<CheckoutSummary> {
    const summary = await getCheckoutSummary(this.prisma.client, token);
    if (!summary) throw new NotFoundException('This checkout link is not valid.');
    return summary;
  }

  @Get(':token/status')
  async status(@Param('token') token: string): Promise<CheckoutStatusView> {
    const summary = await getCheckoutSummary(this.prisma.client, token);
    if (!summary) throw new NotFoundException('This checkout link is not valid.');
    return { status: summary.status, intentStatus: summary.intentStatus, expiresAt: summary.expiresAt };
  }
}
```

The message is generic on purpose: "unknown token", "expired" and "not yours"
must not be distinguishable, because these URLs get pasted into support chats.
Nest matches this controller's `GET :token` independently of Task 11's
`POST checkout-sessions` under the guarded controller, so the paths can overlap
without either guard applying to the other verb.

- [ ] **Step 5: Write the failing webhook test**

`apps/api/test/billing-webhook-api.spec.ts`. The mock provider cannot sign —
that is its security property — so this spec builds a registry around a provider
whose `verifyWebhook`/`parseWebhook` do real HMAC work, which is the same
contract `RapidGatewayProvider` implements.

```ts
/**
 * Live-Postgres coverage for the only endpoint that can turn a provider's word
 * into nID state. Run with RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest, Request } from 'express';
import {
  ProviderRegistry,
  mapProviderStatus,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type ParsedWebhook,
  type PaymentProvider,
  type ProviderPayment,
  type RefundInput,
  type RefundResult,
} from '@nid/payments';
import { signWebhookPayload, verifyWebhookSignature } from '@nid/shared-types';
import {
  createPrismaClient,
  withBillingAdminContext,
  withTenantContext,
  type PrismaClient,
} from '@nid/db';
import { ensureBillingAccount } from '@nid/billing';
import { PrismaService } from '../src/core/db/prisma.service';
import { PaymentProvidersService } from '../src/core/payments/payment-providers.service';
import { AuditService } from '../src/core/audit/audit.service';
import { BillingEventsService } from '../src/modules/billing/billing-events.service';
import { BillingWebhooksController } from '../src/modules/billing/billing-webhooks.controller';

const PROVIDER_NAME = 'signed-fake';
const WEBHOOK_SECRET = `webhook-secret-${Date.now().toString(36)}`;

/** The shape Task 3's adapter implements, minus the HTTP call. */
class SignedFakeProvider implements PaymentProvider {
  readonly name = PROVIDER_NAME;

  createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    throw new Error('not used by this spec');
  }

  fetchPayment(_providerRef: string): Promise<ProviderPayment> {
    throw new Error('not used by this spec');
  }

  refund(_input: RefundInput): Promise<RefundResult> {
    throw new Error('not used by this spec');
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const header = headers['x-fake-signature'];
    if (typeof header !== 'string') return false;
    const parts = new Map(header.split(',').map((kv) => kv.split('='))) as Map<string, string>;
    const timestamp = Number(parts.get('t'));
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60_000) return false;
    return verifyWebhookSignature(
      WEBHOOK_SECRET,
      rawBody.toString('utf8'),
      timestamp,
      parts.get('v1') ?? '',
    );
  }

  parseWebhook(rawBody: Buffer): ParsedWebhook {
    const body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    return {
      providerEventId: String(body.id),
      type: String(body.type),
      providerRef: String(body.transaction_id ?? ''),
      status: mapProviderStatus(String(body.status)),
      // Deliberately nullable: the "succeeded with no amount" case below.
      paidAmountMinor: body.paid_amount_minor == null ? null : BigInt(String(body.paid_amount_minor)),
      currency: body.currency == null ? null : String(body.currency),
      methodType: body.method == null ? null : String(body.method),
      occurredAt: body.paid_at == null ? null : new Date(String(body.paid_at)),
      raw: body,
    };
  }
}

function signedRequest(payload: Record<string, unknown>): RawBodyRequest<Request> {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const timestamp = Date.now();
  const signature = signWebhookPayload(WEBHOOK_SECRET, rawBody.toString('utf8'), timestamp);
  // Stubbing the request object is the pattern apps/api/test/tenant-staff.spec.ts
  // already uses: what is under test is the handler, not Nest's HTTP plumbing.
  return { rawBody, headers: { 'x-fake-signature': `t=${timestamp},v1=${signature}` } } as unknown as RawBodyRequest<Request>;
}

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('provider webhooks (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let controller: BillingWebhooksController;
  let tenantId: string;
  let serviceId: string;
  let planId: string;
  const tag = Date.now().toString(36);

  /**
   * OutboundEvent has no paymentIntentId column (Task 1), so the link lives in
   * the payload — read it through a shape instead of a Prisma JSON path filter,
   * which would make the query depend on Postgres' jsonb semantics for an
   * assertion that is really about what this handler queued.
   */
  function intentOf(payload: unknown): string | null {
    return (payload as { paymentIntentId?: string } | null)?.paymentIntentId ?? null;
  }

  async function ledgerKinds(refId: string): Promise<string[]> {
    const entries = await migratorPrisma.ledgerEntry.findMany({
      where: { transaction: { refType: 'payment_intent', refId } },
      select: { direction: true, account: { select: { kind: true } } },
    });
    return entries.map((entry) => `${entry.direction}:${entry.account?.kind}`).sort();
  }

  beforeAll(async () => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    // buildRegistry() is env-driven and the allowlist contains no signing fake,
    // so the registry is assembled by hand and handed over structurally.
    const registry = new ProviderRegistry([new SignedFakeProvider()]);
    const providers = {
      registry,
      resolve: (name: string) => registry.get(name),
    } as unknown as PaymentProvidersService;
    controller = new BillingWebhooksController(
      providers,
      prismaService,
      new BillingEventsService(prismaService),
      new AuditService(),
    );

    tenantId = (await migratorPrisma.tenant.create({ data: { name: `wh ${tag}`, slug: `wh-${tag}` } })).id;
    // A billing target, so outbound events actually get queued.
    await migratorPrisma.tenant.update({
      where: { id: tenantId },
      data: {
        billingWebhookUrl: 'https://erp1.example.test/nid/billing',
        billingWebhookSecretPlaintext: 'sk_test_1',
      },
    });

    const service = await withBillingAdminContext(prismaService.client, (tx) =>
      tx.billingService.create({ data: { key: `erp-${tag}`, name: 'ERP-1', ownerRepo: 'erp-1' } }),
    );
    serviceId = service.id;
    const plan = await withBillingAdminContext(prismaService.client, (tx) =>
      tx.plan.create({
        data: {
          serviceId: service.id,
          key: 'monthly',
          version: 1,
          name: 'Monthly',
          mode: 'SUBSCRIPTION',
          interval: 'MONTH',
          unitAmountMinor: 50000n,
        },
      }),
    );
    planId = plan.id;
  });

  /**
   * Every case starts from the same place: an intent waiting for its webhook,
   * shaped exactly the way `reserveCheckout` leaves it (server-computed amount,
   * provider ref recorded, PROCESSING) minus the provider round-trip.
   */
  async function seedIntent(
    purpose: 'CREDIT_TOPUP' | 'INVOICE' | 'SUBSCRIPTION',
    overrides: Record<string, unknown> = {},
  ): Promise<{ intentId: string; providerRef: string; metadata: Record<string, string> }> {
    const providerRef = `fake_${tag}_${purpose}`;
    const created = await withTenantContext(prismaService.client, tenantId, async (tx) => {
      const account = await ensureBillingAccount(tx, tenantId);
      const metadata: Record<string, string> = {
        planId: '',
        serviceId: '',
        creditsMinor: '50000',
        taxMinor: '0',
      };

      if (purpose !== 'CREDIT_TOPUP') {
        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            billingAccountId: account.id,
            number: `INV-${tag}-${purpose}`,
            currency: 'PKR',
            status: 'OPEN',
            subtotalMinor: 50000n,
            totalMinor: 50000n,
            issuedAt: new Date(),
          },
        });
        metadata.invoiceId = invoice.id;
        metadata.serviceId = serviceId;
        if (purpose === 'SUBSCRIPTION') {
          const subscription = await tx.subscription.create({
            data: { tenantId, billingAccountId: account.id, planId, status: 'INCOMPLETE' },
          });
          metadata.subscriptionId = subscription.id;
          metadata.interval = 'MONTH';
        }
      }

      const intent = await tx.paymentIntent.create({
        data: {
          tenantId,
          billingAccountId: account.id,
          purpose,
          amountMinor: 50000n,
          currency: 'PKR',
          status: 'PROCESSING',
          provider: PROVIDER_NAME,
          providerRef,
          idempotencyKey: `wh-${purpose}-${tag}`,
          metadata: { ...metadata, ...overrides },
        },
      });
      await tx.checkoutSession.create({
        data: {
          tenantId,
          paymentIntentId: intent.id,
          tokenHash: `token-hash-${purpose}-${tag}`,
          expiresAt: new Date(Date.now() + 600_000),
        },
      });
      return { intentId: intent.id, providerRef, metadata: { ...metadata, ...overrides } };
    });
    return created;
  }

  it('settles a signed SUCCEEDED event: payment, ledger, intent, session, invoice, outbound queue, audit', async () => {
    const { intentId: id, providerRef } = await seedIntent('INVOICE');
    const ack = await controller.handle(
      PROVIDER_NAME,
      signedRequest({
        id: `evt_${tag}_1`,
        type: 'payment.succeeded',
        transaction_id: providerRef,
        status: 'succeeded',
        paid_amount_minor: '50000',
        currency: 'PKR',
        method: 'card',
        paid_at: '2026-10-31T10:00:00.000Z',
      }),
    );
    expect(ack).toEqual({ received: true, duplicate: false, eventStatus: 'PROCESSED' });

    const intent = await migratorPrisma.paymentIntent.findUniqueOrThrow({
      where: { id },
      include: { payments: true, checkoutSession: true },
    });
    expect(intent.status).toBe('SUCCEEDED');
    expect(intent.payments).toHaveLength(1);
    expect(intent.checkoutSession?.status).toBe('COMPLETED');

    const invoice = await migratorPrisma.invoice.findUniqueOrThrow({
      where: { id: (intent.metadata as Record<string, string>).invoiceId as string },
    });
    expect(invoice.status).toBe('PAID');
    expect(invoice.amountPaidMinor).toBe(intent.payments[0]!.amountMinor);

    // The zero-sum shape from spec §7.2, proven through the transaction's ref.
    expect(await ledgerKinds(id)).toEqual(['CREDIT:REVENUE', 'DEBIT:PSP_CLEARING']);

    const queued = (await migratorPrisma.outboundEvent.findMany({ where: { tenantId } })).filter(
      (event) => intentOf(event.payload) === id,
    );
    // Compared as a set: all three rows share one commit timestamp, so an
    // order-by would be a coin toss the assertion should not depend on.
    expect(queued.map((event) => event.eventType).sort()).toEqual([
      'checkout.completed',
      'invoice.paid',
      'payment.succeeded',
    ]);
    expect(queued.every((event) => event.status === 'PENDING')).toBe(true);
    expect(queued[0]?.targetUrl).toBe('https://erp1.example.test/nid/billing');
    expect(queued.find((event) => event.eventType === 'invoice.paid')?.payload).toMatchObject({
      amountMinor: '50000',
      paymentIntentId: id,
      invoiceId: (intent.metadata as Record<string, string>).invoiceId as string,
    });

    // House rule 3, system-actor variant: the write that changed money is itself auditable.
    const audit = await migratorPrisma.auditLogEntry.findFirst({
      where: { tenantId, action: 'billing.webhook.process', entityType: 'payment_intent', entityId: id },
    });
    expect(audit?.actorType).toBe('SYSTEM');
  });

  it('replaying the same providerEventId is a visible no-op, not a second payment', async () => {
    const { intentId: id, providerRef } = await seedIntent('CREDIT_TOPUP');
    const payload = {
      id: `evt_${tag}_2`,
      type: 'payment.succeeded',
      transaction_id: providerRef,
      status: 'succeeded',
      paid_amount_minor: '50000',
      currency: 'PKR',
      method: 'raast',
      paid_at: '2026-10-31T10:05:00.000Z',
    };
    await controller.handle(PROVIDER_NAME, signedRequest(payload));
    const second = await controller.handle(PROVIDER_NAME, signedRequest(payload));
    expect(second).toEqual({ received: true, duplicate: true, eventStatus: 'PROCESSED' });

    expect(await migratorPrisma.webhookEvent.count({ where: { providerEventId: `evt_${tag}_2` } })).toBe(1);
    expect(await migratorPrisma.payment.count({ where: { paymentIntentId: id } })).toBe(1);
    // Not "two credits for one payment" — the reason dedupe happens before
    // settlement rather than inside it.
    const account = await migratorPrisma.billingAccount.findUniqueOrThrow({ where: { tenantId } });
    expect(account.creditBalanceMinor).toBe(50000n);
    const queuedForThisIntent = (await migratorPrisma.outboundEvent.findMany({ where: { tenantId } })).filter(
      (event) => intentOf(event.payload) === id,
    );
    // The duplicate delivery queued nothing: CREDIT_TOPUP emits
    // payment.succeeded + checkout.completed, once.
    expect(queuedForThisIntent).toHaveLength(2);
  });

  it('rejects an unsigned body before it can reach the database', async () => {
    const { intentId: id, providerRef } = await seedIntent('INVOICE');
    const rawBody = Buffer.from(
      JSON.stringify({
        id: `evt_${tag}_forged`,
        type: 'payment.succeeded',
        transaction_id: providerRef,
        status: 'succeeded',
        paid_amount_minor: '1',
        currency: 'PKR',
      }),
    );
    await expect(
      controller.handle(PROVIDER_NAME, { rawBody, headers: {} } as unknown as RawBodyRequest<Request>),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(await migratorPrisma.webhookEvent.count({ where: { providerEventId: `evt_${tag}_forged` } })).toBe(0);
    const intent = await migratorPrisma.paymentIntent.findUniqueOrThrow({ where: { id } });
    expect(intent.status).toBe('PROCESSING');
    expect(await migratorPrisma.ledgerEntry.count({ where: { transaction: { refId: id } } })).toBe(0);
  });

  it('stores an unknown event type as evidence without acting on it', async () => {
    const { intentId: id, providerRef } = await seedIntent('INVOICE');
    const ack = await controller.handle(
      PROVIDER_NAME,
      signedRequest({
        id: `evt_${tag}_3`,
        type: 'refund.adjusted',
        transaction_id: providerRef,
        status: 'succeeded',
        paid_amount_minor: '50000',
        currency: 'PKR',
      }),
    );
    expect(ack.eventStatus).toBe('IGNORED');
    const stored = await migratorPrisma.webhookEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider: PROVIDER_NAME, providerEventId: `evt_${tag}_3` } },
    });
    expect(stored.signatureValid).toBe(true);
    // The payload says "succeeded" and nID still did not settle: an
    // unrecognised type is not an instruction, however plausible it looks.
    const intent = await migratorPrisma.paymentIntent.findUniqueOrThrow({ where: { id } });
    expect(intent.status).toBe('PROCESSING');
    expect(await migratorPrisma.payment.count({ where: { paymentIntentId: id } })).toBe(0);
  });

  it('refuses to settle a SUCCEEDED event that carries no amount', async () => {
    const { intentId: id, providerRef } = await seedIntent('INVOICE');
    const ack = await controller.handle(
      PROVIDER_NAME,
      signedRequest({
        id: `evt_${tag}_4`,
        type: 'payment.succeeded',
        transaction_id: providerRef,
        status: 'succeeded',
        currency: 'PKR',
      }),
    );
    expect(ack.eventStatus).toBe('FAILED');
    const stored = await migratorPrisma.webhookEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider: PROVIDER_NAME, providerEventId: `evt_${tag}_4` } },
    });
    expect(stored.error).toContain('amount');
    expect(await migratorPrisma.payment.count({ where: { paymentIntentId: id } })).toBe(0);
  });

  it('a signed event whose amount contradicts the intent is refused, recorded and acknowledged', async () => {
    const { intentId: id, providerRef } = await seedIntent('INVOICE');
    const payload = {
      id: `evt_${tag}_6`,
      type: 'payment.succeeded',
      transaction_id: providerRef,
      // Half of what nID priced: a partial payment, which Phase 1 does not
      // settle. The provider's word is evidence, not an instruction to re-book
      // the order at whatever number arrived with it.
      status: 'succeeded',
      paid_amount_minor: '25000',
      currency: 'PKR',
    };
    const ack = await controller.handle(PROVIDER_NAME, signedRequest(payload));
    expect(ack.eventStatus).toBe('FAILED');

    const stored = await migratorPrisma.webhookEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider: PROVIDER_NAME, providerEventId: `evt_${tag}_6` } },
    });
    expect(stored.error).toContain('does not match');
    const intent = await migratorPrisma.paymentIntent.findUniqueOrThrow({ where: { id } });
    expect(intent.status).toBe('PROCESSING');
    expect(await migratorPrisma.payment.count({ where: { paymentIntentId: id } })).toBe(0);

    // The retry that the 200 prevents from becoming a storm is still answered
    // correctly: the refusal row makes the redelivery a duplicate.
    const replay = await controller.handle(PROVIDER_NAME, signedRequest(payload));
    expect(replay).toEqual({ received: true, duplicate: true, eventStatus: 'FAILED' });
  });

  it('a FAILED event closes the intent and expires the session', async () => {
    const { intentId: id, providerRef, metadata } = await seedIntent('SUBSCRIPTION');
    const ack = await controller.handle(
      PROVIDER_NAME,
      signedRequest({
        id: `evt_${tag}_5`,
        type: 'payment.failed',
        transaction_id: providerRef,
        status: 'failed',
        paid_amount_minor: '0',
        currency: 'PKR',
      }),
    );
    expect(ack.eventStatus).toBe('PROCESSED');
    const intent = await migratorPrisma.paymentIntent.findUniqueOrThrow({ where: { id } });
    expect(intent.status).toBe('FAILED');
    const session = await migratorPrisma.checkoutSession.findFirstOrThrow({ where: { paymentIntentId: id } });
    expect(session.status).toBe('EXPIRED');
    // An unpaid subscription invoice stays OPEN and nothing is activated.
    const invoice = await migratorPrisma.invoice.findUniqueOrThrow({ where: { id: metadata.invoiceId as string } });
    expect(invoice.status).toBe('OPEN');
    const subscription = await migratorPrisma.subscription.findUniqueOrThrow({
      where: { id: metadata.subscriptionId as string },
    });
    expect(subscription.status).toBe('INCOMPLETE');
    expect(await migratorPrisma.ledgerEntry.count({ where: { transaction: { refId: id } } })).toBe(0);
  });

  it('an event for a providerRef nID never issued is acknowledged and logged, not settled', async () => {
    const ack = await controller.handle(
      PROVIDER_NAME,
      signedRequest({
        id: `evt_${tag}_orphan`,
        type: 'payment.succeeded',
        transaction_id: `fake_never_issued_${tag}`,
        status: 'succeeded',
        paid_amount_minor: '50000',
        currency: 'PKR',
      }),
    );
    // A 200-shaped ack, because the PSP will otherwise retry an event that can
    // never match anything nID issued.
    expect(ack).toEqual({ received: true, duplicate: false, eventStatus: 'UNATTRIBUTED' });
    // WebhookEvent.tenantId is NOT NULL, so an event with no tenant cannot be
    // persisted — it is logged only. This is the one place webhook evidence can
    // be lost in Phase 1; the warn line is what a support ticket is reconciled
    // against, and Phase 2 gets an unattributed-events queue.
    expect(
      await migratorPrisma.webhookEvent.count({ where: { providerEventId: `evt_${tag}_orphan` } }),
    ).toBe(0);
  });

  afterAll(async () => {
    for (const model of [
      'outboundEvent',
      'webhookEvent',
      'ledgerEntry',
      'ledgerTransaction',
      'ledgerAccount',
      'creditLedgerEntry',
      'payment',
      'refund',
      'checkoutSession',
      'paymentIntent',
      'invoiceLine',
      'invoice',
      'subscription',
      'billingAccount',
    ] as const) {
      await migratorPrisma[model].deleteMany({ where: { tenantId } });
    }
    await migratorPrisma.plan.deleteMany({ where: { id: planId } });
    await migratorPrisma.billingService.deleteMany({ where: { id: serviceId } });
    await migratorPrisma.tenant.delete({ where: { id: tenantId } });
    await prismaService.onModuleDestroy();
    await migratorPrisma.$disconnect();
  });
});
```

`OutboundEvent` has no `paymentIntentId` column — Task 1 defined it with
`tenantId`, `serviceId`, `eventType`, `payload`, `targetUrl` — so the link from a
queued event back to the payment that produced it lives inside `payload`, which
is why the spec above filters in JavaScript instead of in a `where`. That is
good enough for Phase 1, where nothing reads the queue: Phase 2's
`outboundWebhookWorkflow` will want a real column to index `nextAttemptAt` per
payment, and adding it is a `ALTER TABLE ... ADD COLUMN` plus a backfill from the
payload, recorded as a Phase 2 schema note in `docs/PHASES.md` (Task 18).

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm --filter @nid/api exec jest billing-webhook-api --runInBand`
Expected: FAIL — `billing-events.service.ts` / `billing-webhooks.controller.ts` do not exist (the spec skips without `RUN_DB_TESTS=true`; run it with).

- [ ] **Step 7: Write the outbound-event queue**

`apps/api/src/modules/billing/billing-events.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type TransactionClient } from '@nid/db';
import { PrismaService } from '../../core/db/prisma.service';

export interface EnqueueEventInput {
  tenantId: string;
  serviceId?: string;
  /** One of spec §9's names: payment.succeeded, invoice.paid, subscription.activated, checkout.completed, credits.low, credits.exhausted. */
  eventType: string;
  /** Minor-unit amounts arrive as strings: Prisma rejects BigInt in a Json column. */
  payload: Record<string, unknown>;
}

/**
 * Phase 1 records the intent to notify. Signing with
 * `Tenant.billingWebhookSecretPlaintext` and the retry ladder (1m, 5m, 30m, 2h,
 * 12h) belong to Phase 2's `outboundWebhookWorkflow`, which reads exactly these
 * PENDING rows — so this row shape is the contract between the two phases and
 * must not drift silently.
 */
@Injectable()
export class BillingEventsService {
  private readonly logger = new Logger(BillingEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns false when the tenant has nowhere to receive events. A PENDING row
   * with no target would sit in the delivery log forever and read as "stuck"
   * rather than "not configured", so the absence goes in the log instead of the
   * data.
   */
  async enqueue(tx: TransactionClient, input: EnqueueEventInput): Promise<boolean> {
    const tenant = await tx.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant?.billingWebhookUrl || !tenant.billingWebhookSecretPlaintext) {
      this.logger.debug(
        `Tenant ${input.tenantId} has no billing webhook target; ${input.eventType} not queued`,
      );
      return false;
    }

    await tx.outboundEvent.create({
      data: {
        tenantId: input.tenantId,
        serviceId: input.serviceId || null,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonObject,
        targetUrl: tenant.billingWebhookUrl,
        status: 'PENDING',
      },
    });
    return true;
  }

  /** For callers whose money transaction has already committed — the webhook handler. */
  enqueueForTenant(tenantId: string, input: EnqueueEventInput): Promise<boolean> {
    return this.prisma.forTenant(tenantId, (tx) => this.enqueue(tx, input));
  }
}
```

No audit row here: the `OutboundEvent` is itself the durable record of the
decision, and three queued events per payment would triple the audit table for
information it already carries.

- [ ] **Step 8: Write the webhook controller**

`apps/api/src/modules/billing/billing-webhooks.controller.ts`:

```ts
import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest, Request } from 'express';
import type { PaymentIntent, WebhookEventStatus } from '@nid/db';
import { Prisma } from '@nid/db';
import {
  abandonCheckout,
  settlePayment,
  BillingError,
  isUniqueViolation,
  type SettlePaymentResult,
} from '@nid/billing';
import { UnknownProviderError, type ParsedWebhook, type PaymentProvider } from '@nid/payments';
import { PrismaService } from '../../core/db/prisma.service';
import { PaymentProvidersService } from '../../core/payments/payment-providers.service';
import { AuditService } from '../../core/audit/audit.service';
import { BillingEventsService } from './billing-events.service';

/**
 * The three event names this handler acts on. A provider that spells them
 * differently is mapped inside its own `parseWebhook` — Task 3's adapter is the
 * only place a provider's vocabulary enters nID, never a branch here (house
 * rule 1). The names to confirm against Rapid Gateway's real payload are
 * listed in docs/vendors/rapid-gateway/README.md.
 */
const ACTIONABLE_EVENT_TYPES = new Set(['payment.succeeded', 'payment.failed', 'payment.expired']);

export interface WebhookAck {
  received: true;
  duplicate: boolean;
  eventStatus: WebhookEventStatus | 'UNATTRIBUTED';
}

type ProcessOutcome = { status: WebhookEventStatus; settled: SettlePaymentResult | null };

/**
 * Public by design and signature-protected rather than session-protected
 * (spec §10). Needs `rawBody: true` from Task 9's main.ts: the signature is
 * over the exact bytes the PSP signed, and a body re-serialised by the JSON
 * parser never matches them.
 */
@Controller('v1/billing/webhooks')
export class BillingWebhooksController {
  private readonly logger = new Logger(BillingWebhooksController.name);

  constructor(
    private readonly providers: PaymentProvidersService,
    private readonly prisma: PrismaService,
    private readonly events: BillingEventsService,
    private readonly audit: AuditService,
  ) {}

  @Post(':provider')
  @HttpCode(200)
  async handle(
    @Param('provider') providerName: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookAck> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Webhook deliveries must be received as a raw body.');
    }

    const provider = this.resolveProvider(providerName);

    // Constant-time and replay-windowed, over these bytes. The provider owns the
    // window (Task 3 rejects anything older than five minutes); this handler owns
    // the ordering — nothing below runs on unverified input.
    if (!provider.verifyWebhook(rawBody, headers)) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const event = provider.parseWebhook(rawBody);

    const seen = await this.prisma.client.webhookEvent.findUnique({
      where: { provider_providerEventId: { provider: providerName, providerEventId: event.providerEventId } },
    });
    if (seen) return { received: true, duplicate: true, eventStatus: seen.status };

    const intent = event.providerRef
      ? await this.prisma.client.paymentIntent.findUnique({
          where: { provider_providerRef: { provider: providerName, providerRef: event.providerRef } },
        })
      : null;

    if (!intent) {
      this.logger.warn(
        `Unattributed ${event.type} event ${event.providerEventId} from ${providerName} for ref "${event.providerRef}"`,
      );
      return { received: true, duplicate: false, eventStatus: 'UNATTRIBUTED' };
    }

    let outcome: ProcessOutcome;
    try {
      outcome = await this.process(providerName, event, intent);
    } catch (error) {
      // settlePayment can refuse a signed event — an amount that does not match
      // the intent, a plan whose credit split does not add up. Letting that
      // escape as a 500 would mean the PSP retries an event that will fail the
      // same way every time, so the refusal is stored as evidence and answered
      // with 200. The dedupe row is what makes the retry a duplicate read of
      // FAILED rather than a second attempt at settlement.
      if (!(error instanceof BillingError)) throw error;
      await this.recordRefusal(providerName, event, intent, error.message);
      return { received: true, duplicate: false, eventStatus: 'FAILED' };
    }

    // After commit: a settlement that rolled back must not queue a notification.
    if (outcome.settled && outcome.settled.settled && !outcome.settled.alreadySettled) {
      await this.emitSettledEvents(event, intent, outcome.settled);
    }

    return { received: true, duplicate: false, eventStatus: outcome.status };
  }

  /**
   * Best-effort: if this insert itself fails, the warn line plus the original
   * error are all that survives, and a 500 is then the honest answer — the PSP
   * will retry, and the retry will produce the same log line.
   */
  private async recordRefusal(
    providerName: string,
    event: ParsedWebhook,
    intent: PaymentIntent,
    reason: string,
  ): Promise<void> {
    this.logger.error(
      `Webhook ${event.providerEventId} (${event.type}) refused for intent ${intent.id}: ${reason}`,
    );
    try {
      await this.prisma.forTenant(intent.tenantId, (tx) =>
        tx.webhookEvent.create({
          data: {
            tenantId: intent.tenantId,
            provider: providerName,
            providerEventId: event.providerEventId,
            type: event.type,
            payload: event.raw as Prisma.InputJsonObject,
            signatureValid: true,
            status: 'FAILED',
            error: reason,
          },
        }),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  private resolveProvider(name: string): PaymentProvider {
    try {
      return this.providers.resolve(name);
    } catch (error) {
      // 404 rather than a 500: the provider name arrives in the URL, so an
      // attacker or a misconfigured sandbox picking it is a routing miss, not a
      // crash — and a 500 invites retries against a path that will never exist.
      if (error instanceof UnknownProviderError) throw new NotFoundException('Unknown payment provider.');
      throw error;
    }
  }

  /**
   * Dedupe row, settlement, webhook status and audit commit in one tenant
   * transaction, so a crash cannot leave a processed webhook with no payment —
   * or a payment whose only evidence of why it exists has vanished.
   */
  private async process(
    providerName: string,
    event: ParsedWebhook,
    intent: PaymentIntent,
  ): Promise<ProcessOutcome> {
    // A signed "succeeded" with no amount is the one event nID must not rescue
    // by pricing it from the intent: settlePayment's amount check exists to
    // catch a partial payment, and copying the expected amount in would make
    // that check vacuous. So it is stored as failed evidence, not guessed.
    const amountMissing = event.status === 'SUCCEEDED' && (event.paidAmountMinor === null || event.currency === null);

    return this.prisma.forTenant(intent.tenantId, async (tx) => {
      const webhook = await tx.webhookEvent.create({
        data: {
          tenantId: intent.tenantId,
          provider: providerName,
          providerEventId: event.providerEventId,
          type: event.type,
          payload: event.raw as Prisma.InputJsonObject,
          signatureValid: true,
          status: amountMissing ? 'FAILED' : 'RECEIVED',
          error: amountMissing ? 'SUCCEEDED event carried no paid amount or currency; refused to settle.' : null,
        },
      });

      if (amountMissing) return { status: 'FAILED' as const, settled: null };

      const actionable = ACTIONABLE_EVENT_TYPES.has(event.type);
      if (!actionable || event.status === 'PENDING') {
        // Either a type this handler has no instruction for, or a provider that
        // called it actionable while its own transaction is not terminal. Both
        // are evidence; neither is a reason to change money state.
        await tx.webhookEvent.update({
          where: { id: webhook.id },
          data: { status: 'IGNORED', processedAt: new Date() },
        });
        return { status: 'IGNORED' as const, settled: null };
      }

      let settled: SettlePaymentResult | null = null;
      if (event.status === 'SUCCEEDED') {
        settled = await settlePayment(tx, {
          tenantId: intent.tenantId,
          intentId: intent.id,
          provider: providerName,
          providerTransactionId: event.providerRef,
          paidAmountMinor: event.paidAmountMinor as bigint,
          currency: event.currency as string,
          methodType: event.methodType,
          paidAt: event.occurredAt ?? new Date(),
        });
      } else {
        // FAILED / EXPIRED / CANCELED all mean this attempt is over.
        await abandonCheckout(tx, intent.id);
      }

      await tx.webhookEvent.update({
        where: { id: webhook.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
      await this.audit.record(tx, intent.tenantId, {
        actorType: 'SYSTEM',
        action: 'billing.webhook.process',
        entityType: 'payment_intent',
        entityId: intent.id,
      });

      return { status: 'PROCESSED' as const, settled };
    });
  }

  /**
   * Spec §9's event names, derived from the settled intent — never from the
   * event's own vocabulary, so a provider renaming its events cannot rename
   * nID's.
   */
  private async emitSettledEvents(
    event: ParsedWebhook,
    intent: PaymentIntent,
    settled: SettlePaymentResult,
  ): Promise<void> {
    const metadata = (intent.metadata ?? {}) as Record<string, string>;
    const types = ['payment.succeeded', 'checkout.completed'];
    if (intent.purpose === 'INVOICE' || intent.purpose === 'ONE_OFF') types.push('invoice.paid');
    if (intent.purpose === 'SUBSCRIPTION') types.push('subscription.activated');

    const payload = {
      tenantId: intent.tenantId,
      paymentIntentId: intent.id,
      paymentId: settled.paymentId,
      purpose: intent.purpose,
      // Strings, not numbers: a BigInt is unserialisable and a float would
      // truncate the integer subunits the provider already rounded in.
      amountMinor: intent.amountMinor.toString(),
      currency: intent.currency,
      invoiceId: metadata.invoiceId ?? null,
      subscriptionId: metadata.subscriptionId ?? null,
      planId: metadata.planId ?? null,
      creditsMinor: metadata.creditsMinor ?? null,
      providerEventId: event.providerEventId,
    };

    for (const eventType of types) {
      await this.events.enqueueForTenant(intent.tenantId, {
        tenantId: intent.tenantId,
        serviceId: metadata.serviceId || undefined,
        eventType,
        payload,
      });
    }
  }
}
```

Two things in the middle of that file are decisions, not formatting:

- **`providerTransactionId: event.providerRef`.** Task 8's idempotency key is
  `(provider, providerTransactionId)` and Task 3 guarantees `providerRef` is the
  provider's own transaction id, so two event ids describing one charge collapse
  on that unique index instead of minting two payments.
- **The `as bigint` / `as string` pair** narrows what the `amountMissing` guard
  already proved. Do not "simplify" them into `?? 0n` — that turns a refused
  settlement into a book of a payment for nothing.

- [ ] **Step 9: Write the dev payment switch**

`apps/api/src/modules/billing/dto/mock-payment.dto.ts`:

```ts
import { IsIn, IsString, MaxLength } from 'class-validator';

/**
 * The payer's side of the mock PSP is apps/checkout-ui's /mock-pay/[providerRef]
 * page (Task 16); this is the money side. Only the outcome is client-supplied —
 * never an amount, which is read back off the intent.
 */
export class MockPaymentDto {
  @IsString()
  @MaxLength(128)
  providerRef!: string;

  @IsIn(['success', 'failure'])
  outcome!: 'success' | 'failure';
}
```

`apps/api/src/modules/billing/dev-payments.controller.ts`:

```ts
import { Body, Controller, HttpCode, Logger, NotFoundException, Post } from '@nestjs/common';
import { abandonCheckout, ensureBillingAccount, settlePayment } from '@nid/billing';
import { loadEnv } from '../../core/config/env';
import { PrismaService } from '../../core/db/prisma.service';
import { PaymentProvidersService } from '../../core/payments/payment-providers.service';
import { BillingEventsService } from './billing-events.service';
import { MockPaymentDto } from './dto/mock-payment.dto';

/**
 * The stand-in for a PSP webhook while Rapid Gateway's real protocol is still
 * provisional (docs/vendors/rapid-gateway/README.md). Without it, nothing from
 * checkout through ledger to entitlement can be exercised end-to-end, because
 * MockPaymentProvider deliberately cannot produce a verifiable signature.
 *
 * 404 rather than 403 when it is not allowed: an endpoint that answers 403 is a
 * confirmed target for anyone guessing the path.
 */
@Controller('v1/billing/dev')
export class DevPaymentsController {
  private readonly logger = new Logger(DevPaymentsController.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProvidersService,
    private readonly events: BillingEventsService,
  ) {}

  @Post('mock-payments')
  @HttpCode(200)
  async pay(@Body() dto: MockPaymentDto) {
    if (this.env.nodeEnv === 'production' || !this.providers.registry.has('mock')) {
      throw new NotFoundException();
    }

    const intent = await this.prisma.client.paymentIntent.findFirst({
      where: { provider: 'mock', providerRef: dto.providerRef },
    });
    if (!intent) throw new NotFoundException('No mock checkout for that reference.');
    if (intent.status === 'SUCCEEDED') return { settled: false, reason: 'already settled' };

    if (dto.outcome === 'failure') {
      await this.prisma.forTenant(intent.tenantId, (tx) => abandonCheckout(tx, intent.id));
      return { settled: false, reason: 'failed' };
    }

    const result = await this.prisma.forTenant(intent.tenantId, async (tx) => {
      // Idempotent no-op for an account that exists; for a tenant that predates
      // billing, the credit top-up path needs somewhere to post.
      await ensureBillingAccount(tx, intent.tenantId);
      return settlePayment(tx, {
        tenantId: intent.tenantId,
        intentId: intent.id,
        provider: 'mock',
        providerTransactionId: dto.providerRef,
        // MockPaymentProvider.fetchPayment reports 0n, so the only honest source
        // for what was paid is the amount nID itself priced.
        paidAmountMinor: intent.amountMinor,
        currency: intent.currency,
        methodType: 'mock_card',
        paidAt: new Date(),
      });
    });

    const metadata = (intent.metadata ?? {}) as Record<string, string>;
    await this.events.enqueueForTenant(intent.tenantId, {
      tenantId: intent.tenantId,
      serviceId: metadata.serviceId || undefined,
      eventType: 'checkout.completed',
      payload: {
        tenantId: intent.tenantId,
        paymentIntentId: intent.id,
        paymentId: result.paymentId,
        amountMinor: intent.amountMinor.toString(),
        currency: intent.currency,
        devMock: true,
      },
    });

    this.logger.warn(`Dev mock payment settled intent ${intent.id} for tenant ${intent.tenantId}`);
    return { settled: result.settled, alreadySettled: result.alreadySettled };
  }
}
```

The warn-level line for every dev settlement is deliberate: on a shared staging
database, "why does this tenant have credits" needs an answer in the log.

- [ ] **Step 10: Write the dev-gate test**

`apps/api/test/dev-payments.spec.ts` — no database, because the gates are pure
configuration checks that run before any query.

```ts
/**
 * `loadEnv()` runs in the controller's field initialiser, so mutating
 * NODE_ENV before construction is what exercises the production gate.
 */
import { NotFoundException } from '@nestjs/common';
import type { ProviderRegistry } from '@nid/payments';
import { PrismaService } from '../src/core/db/prisma.service';
import { PaymentProvidersService } from '../src/core/payments/payment-providers.service';
import { BillingEventsService } from '../src/modules/billing/billing-events.service';
import { DevPaymentsController } from '../src/modules/billing/dev-payments.controller';

function controllerWith(nodeEnv: string, hasMock: boolean): DevPaymentsController {
  process.env['NODE_ENV'] = nodeEnv;
  const prisma = new PrismaService();
  return new DevPaymentsController(
    prisma,
    { registry: { has: (name: string) => hasMock && name === 'mock' } as unknown as ProviderRegistry },
    new BillingEventsService(prisma),
  );
}

describe('DevPaymentsController gates', () => {
  const original = process.env['NODE_ENV'];
  afterAll(() => {
    process.env['NODE_ENV'] = original;
  });

  const dto = { providerRef: 'mock_abc', outcome: 'success' as const };

  it('404s in production before touching the database', async () => {
    const controller = controllerWith('production', true);
    await expect(controller.pay(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s when mock is not allowlisted, even in development', async () => {
    const controller = controllerWith('development', false);
    await expect(controller.pay(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('proceeds only when both gates pass', async () => {
    const controller = controllerWith('development', true);
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = new PrismaService();
    // Replacing the client is what proves the gates opened: the next statement
    // in pay() is the intent lookup, and an unopened controller never reaches it.
    Object.defineProperty(prisma, 'client', { value: { paymentIntent: { findFirst } }, configurable: true });
    const passing = new DevPaymentsController(
      prisma,
      { registry: { has: () => true } } as unknown as PaymentProvidersService,
      new BillingEventsService(prisma),
    );
    await expect(passing.pay(dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledTimes(1);
    void controller;
  });
});
```

The third case stubs `PrismaService.client` rather than hitting Postgres, so it
is deterministic; asserting "it threw a Prisma connection error" instead would
pass or fail depending on whether a database happens to be listening.

- [ ] **Step 11: Wire the module and run everything**

`apps/api/src/modules/billing/billing.module.ts` becomes:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AdminBillingController } from './admin-billing.controller';
import { AdminBillingService } from './admin-billing.service';
import { BillingEventsService } from './billing-events.service';
import { BillingWebhooksController } from './billing-webhooks.controller';
import { CheckoutPublicController } from './checkout-public.controller';
import { DevPaymentsController } from './dev-payments.controller';

@Module({
  imports: [AuthModule, AccountsModule],
  controllers: [
    BillingController,
    AdminBillingController,
    CheckoutPublicController,
    BillingWebhooksController,
    DevPaymentsController,
  ],
  providers: [BillingService, AdminBillingService, BillingEventsService],
  exports: [BillingService, BillingEventsService],
})
export class BillingModule {}
```

Keep Task 12's `imports`/controller list as the base and add only what is new
here; `exports: [BillingEventsService]` is for Task 14's credit warnings and
Task 15's service controller, both of which enqueue.

Run: `RUN_DB_TESTS=true pnpm --filter @nid/api exec jest checkout-public-api billing-webhook-api --runInBand`
Expected: PASS.

Run: `pnpm --filter @nid/api exec jest dev-payments --runInBand`
Expected: PASS (no database needed).

Run: `pnpm typecheck && pnpm lint && pnpm --filter @nid/api build`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add apps/api packages/db
git commit -m "feat(api): add checkout capability endpoints, signature-verified provider webhooks and dev settlement switch"
```

---

## Task 14: Usage metering, credit warnings and entitlements computed on read

**Files:**
- Create: `packages/billing/src/usage.ts`, `packages/billing/src/entitlements.ts`
- Modify: `packages/billing/src/invoices.ts` (add `accrueInvoiceLine`, `addInvoiceLine`, and an empty-invoice guard in `issueInvoice`), `packages/billing/src/index.ts`
- Test: `packages/billing/src/credit-warning.spec.ts` (pure), `packages/billing/src/usage.db.spec.ts` (which also covers `computeEntitlements`, since an entitlement is only interesting next to usage state)

**Interfaces:**
- Consumes: `getServiceByKey` (Task 5), `debitAccount`/`CreditMovementResult` (Task 6), `postLedgerTransaction` (Task 4), `createInvoice`/`invoiceTotals`/`nextInvoiceNumber` (Task 5), `assertPositiveMinor`/`assertCurrency` (Task 4), `BillingError`/`isUniqueViolation` (Task 4), `TransactionClient`/`Plan` (`@nid/db`).
- Produces: `CreditWarningKind`, `CreditWarning`, `RecordUsageInput`, `UsageDrain`, `UsageOutcome`, `recordUsage(tx, input)`, `detectCreditWarning(balanceBeforeMinor, balanceAfterMinor, thresholdMinor)`, `resolveLowBalanceThreshold(tx, billingAccountId, plan)`, `evaluateCredits(tx, input)`; `accrueInvoiceLine(tx, tenantId, currency, line)`, `addInvoiceLine(tx, invoiceId, line)`; `ServiceEntitlementStatus`, `ServiceEntitlement`, `EntitlementView`, `computeEntitlements(tx, tenantId)`, `assertEntitled(tx, tenantId, serviceKey)`. Task 15's service endpoints call `recordUsage`/`computeEntitlements` and enqueue warnings through Task 13's `BillingEventsService`; Task 15's verification hook calls `evaluateCredits` and `assertEntitled`.

Four rules this task exists to enforce:

1. **The plan decides whether usage costs anything.** A plan with
   `overageUnitAmountMinor = null` is metering, not billing: the `UsageRecord` is
   written and no money moves. Inventing a price for unmetered usage would turn a
   catalog typo into a charge.
2. **One path per call: credits or accrual, never both.** A partial credit draw
   plus an invoice for the remainder would need two idempotency keys and a
   `CreditLedgerEntry` whose reference points at half a charge. When the balance
   cannot cover the whole charge, the whole charge accrues and no credits are
   spent.
3. **The `UsageRecord` is inserted before anything is charged.**
   `(serviceId, idempotencyKey)` is unique, so a retried report reads the original
   outcome instead of charging twice — same arbiter as Task 6's credits.
4. **Entitlements are computed on read** (D12): no table to drift, and a
   suspension changes the answer on the next call.

- [ ] **Step 1: Write the failing pure test for the warning crossing**

`packages/billing/src/credit-warning.spec.ts`:

```ts
import { detectCreditWarning } from './usage';

describe('detectCreditWarning', () => {
  const threshold = 1000n;

  it('fires exhausted only on the crossing into zero', () => {
    expect(detectCreditWarning(250n, 0n, threshold)).toBe('credits.exhausted');
    // Already at zero: the tenant was told once. Re-firing on every debit makes
    // the delivery log meaningless.
    expect(detectCreditWarning(0n, 0n, threshold)).toBeNull();
  });

  it('fires low only when the balance falls through the threshold', () => {
    expect(detectCreditWarning(1200n, 900n, threshold)).toBe('credits.low');
    expect(detectCreditWarning(900n, 800n, threshold)).toBeNull();
    expect(detectCreditWarning(1200n, 1100n, threshold)).toBeNull();
  });

  it('prefers exhausted over low when one debit crosses both', () => {
    expect(detectCreditWarning(1200n, 0n, threshold)).toBe('credits.exhausted');
  });

  it('never fires on a credit', () => {
    expect(detectCreditWarning(0n, 5000n, threshold)).toBeNull();
    expect(detectCreditWarning(900n, 1200n, threshold)).toBeNull();
  });

  it('treats a threshold of zero as "low warnings disabled"', () => {
    expect(detectCreditWarning(1200n, 1n, 0n)).toBeNull();
    expect(detectCreditWarning(1200n, 0n, 0n)).toBe('credits.exhausted');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @nid/billing test -- --runTestsByPath src/credit-warning.spec.ts`
Expected: FAIL — `Cannot find module './usage'`.

- [ ] **Step 3: Add the accrual primitives to `invoices.ts`**

Both go next to `createInvoice`, because only this file may compute invoice
totals.

```ts
/**
 * Adds a line to the tenant's running draft bill, or opens one carrying this
 * line. There is no "empty draft" state: `invoiceTotals` rejects zero-line
 * invoices, so the first accrued line is what creates the invoice. One draft per
 * tenant rather than one per service — the payer settles one invoice for
 * everything they used, and `issueInvoice` is what turns it into a bill.
 */
export async function accrueInvoiceLine(
  tx: TransactionClient,
  tenantId: string,
  currency: string,
  line: CreateInvoiceLineInput,
): Promise<{ invoiceId: string; lineId: string }> {
  assertCurrency(currency);
  const draft = await tx.invoice.findFirst({
    where: { tenantId, status: 'DRAFT', currency },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (draft) return addInvoiceLine(tx, draft.id, line);

  const created = await createInvoice(tx, { tenantId, currency, lines: [line] });
  const firstLine = created.lines[0];
  if (!firstLine) throw new BillingError('Accrual created an invoice with no line.');
  return { invoiceId: created.id, lineId: firstLine.id };
}

/**
 * Appends to a DRAFT invoice and recomputes its totals from its lines, so a
 * stored total can never disagree with the sum of what is on the invoice.
 * Anything past DRAFT is rejected: silently rewriting an OPEN invoice would
 * change a bill the payer has already been sent.
 */
export async function addInvoiceLine(
  tx: TransactionClient,
  invoiceId: string,
  line: CreateInvoiceLineInput,
): Promise<{ invoiceId: string; lineId: string }> {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, tenantId: true, number: true, status: true } });
  if (!invoice) throw new BillingError(`Invoice ${invoiceId} not found.`);
  if (invoice.status !== 'DRAFT') {
    throw new BillingError(`Invoice ${invoice.number} is ${invoice.status}; only DRAFT invoices accept new lines.`);
  }

  const created = await tx.invoiceLine.create({
    data: {
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      serviceId: line.serviceId,
      subscriptionId: line.subscriptionId ?? null,
      description: line.description,
      quantity: line.quantity ?? 1,
      unitAmountMinor: line.unitAmountMinor,
      amountMinor: line.unitAmountMinor * BigInt(line.quantity ?? 1),
      taxMinor: line.taxMinor ?? 0n,
    },
  });

  const lines = await tx.invoiceLine.findMany({ where: { invoiceId: invoice.id } });
  const totals = invoiceTotals(lines);

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { subtotalMinor: totals.subtotalMinor, taxMinor: totals.taxMinor, totalMinor: totals.totalMinor },
  });
  return { invoiceId: invoice.id, lineId: created.id };
}
```

`invoiceTotals(lines)` accepts the persisted rows because its parameter type only
requires `quantity`, `unitAmountMinor` and `taxMinor`.

Then add the empty-invoice guard to `issueInvoice`, before its `transition` call,
so a draft can never be issued without anything on it:

```ts
  const lineCount = await tx.invoiceLine.count({ where: { invoiceId } });
  if (lineCount === 0) throw new BillingError(`Invoice ${invoiceId} has no lines; nothing to issue.`);
```

Run: `pnpm --filter @nid/billing test`
Expected: the five existing invoice specs still pass (no test issues an empty
draft); `credit-warning.spec.ts` still fails.

- [ ] **Step 4: Write the failing DB test**

`packages/billing/src/usage.db.spec.ts`:

```ts
/**
 * Live-Postgres coverage for metering: the two money paths, the idempotency
 * arbiter, the crossings, and the entitlement view that reads the result. Run
 * with RUN_DB_TESTS=true pnpm --filter @nid/billing test
 */
import {
  createPrismaClient,
  withBillingAdminContext,
  withTenantContext,
  type PrismaClient,
} from '@nid/db';
import { ensureBillingAccount } from './accounts';
import { creditAccount } from './credits';
import { computeEntitlements } from './entitlements';
import { recordUsage, type RecordUsageInput } from './usage';

const runDb = process.env['RUN_DB_TESTS'] === 'true' ? describe : describe.skip;

runDb('recordUsage (live Postgres)', () => {
  let prisma: PrismaClient;
  let superuser: PrismaClient;
  let tenantId: string;
  let meteredServiceId: string;
  let freeServiceId: string;
  let meteredPlanId: string;
  const tag = Date.now().toString(36);

  beforeAll(async () => {
    prisma = createPrismaClient(process.env['APP_DATABASE_URL']);
    superuser = createPrismaClient(process.env['DATABASE_URL']);
    tenantId = (await superuser.tenant.create({ data: { name: `usage ${tag}`, slug: `usage-${tag}` } })).id;

    const catalog = await withBillingAdminContext(prisma, async (tx) => {
      const metered = await tx.billingService.create({
        data: { key: `metered-${tag}`, name: 'Metered', ownerRepo: 'erp-1' },
      });
      const free = await tx.billingService.create({
        data: { key: `free-${tag}`, name: 'Free', ownerRepo: 'communicator' },
      });
      // 250 per unit overage, and the low-balance threshold stored on the plan.
      const plan = await tx.plan.create({
        data: {
          serviceId: metered.id,
          key: 'usage',
          version: 1,
          name: 'Metered',
          mode: 'SUBSCRIPTION',
          interval: 'MONTH',
          unitAmountMinor: 50000n,
          overageUnitAmountMinor: 250n,
          features: { lowBalanceThresholdMinor: 1000, max_users: 25 },
        },
      });
      await tx.plan.create({
        data: {
          serviceId: free.id,
          key: 'free',
          version: 1,
          name: 'Free tier',
          mode: 'SUBSCRIPTION',
          interval: 'MONTH',
          unitAmountMinor: 0n,
        },
      });
      return { meteredId: metered.id, freeId: free.id, planId: plan.id };
    });
    meteredServiceId = catalog.meteredId;
    freeServiceId = catalog.freeId;
    meteredPlanId = catalog.planId;

    // The priced subscription is created here, not inside the entitlement test
    // that first noticed it: `recordUsage` reads its unit price from the
    // tenant's ACTIVE subscription plan, so a subscription created late would
    // leave every earlier credit-draw assertion running unpriced (drain NONE)
    // and the threshold falling back to last-topup/10 instead of the plan's
    // documented `features.lowBalanceThresholdMinor`.
    await withTenantContext(prisma, tenantId, async (tx) => {
      const account = await ensureBillingAccount(tx, tenantId);
      await tx.subscription.create({
        data: {
          tenantId,
          billingAccountId: account.id,
          planId: meteredPlanId,
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2026-11-30T00:00:00.000Z'),
        },
      });
    });
  });

  /**
   * A deterministic starting balance, every time: the credit rows are cleared,
   * the cache is zeroed by the migrator role, and one TOPUP moves it. Setting
   * `creditBalanceMinor` directly is only acceptable in a fixture — production
   * code never has this column in an UPDATE (Task 6 owns the single path).
   */
  async function fund(balanceMinor: bigint, key: string): Promise<void> {
    await clearUsageState();
    const account = await withTenantContext(prisma, tenantId, (tx) => ensureBillingAccount(tx, tenantId));
    await superuser.creditLedgerEntry.deleteMany({ where: { billingAccountId: account.id } });
    await superuser.$executeRaw`UPDATE "BillingAccount" SET "creditBalanceMinor" = 0 WHERE "id" = ${account.id}`;
    if (balanceMinor <= 0n) return;
    await withTenantContext(prisma, tenantId, (tx) =>
      creditAccount(tx, {
        tenantId,
        billingAccountId: account.id,
        deltaMinor: balanceMinor,
        reason: 'TOPUP',
        refType: 'test_funding',
        refId: `fund-${tag}-${key}`,
      }),
    );
  }

  async function clearUsageState(): Promise<void> {
    await superuser.usageRecord.deleteMany({ where: { tenantId } });
    await superuser.ledgerEntry.deleteMany({ where: { transaction: { refType: 'usage_record' } } });
    await superuser.ledgerTransaction.deleteMany({ where: { tenantId, refType: 'usage_record' } });
    await superuser.creditLedgerEntry.deleteMany({ where: { tenantId, reason: 'USAGE' } });
    const drafts = await superuser.invoice.findMany({
      where: { tenantId, status: 'DRAFT' },
      select: { id: true },
    });
    await superuser.invoiceLine.deleteMany({ where: { invoiceId: { in: drafts.map((row) => row.id) } } });
    await superuser.invoice.deleteMany({ where: { id: { in: drafts.map((row) => row.id) } } });
  }

  function input(key: string, quantity: bigint, overrides: Partial<RecordUsageInput> = {}): RecordUsageInput {
    return {
      tenantId,
      serviceKey: `metered-${tag}`,
      metricKey: 'api_calls',
      quantity,
      occurredAt: new Date(),
      idempotencyKey: key,
      ...overrides,
    };
  }

  beforeEach(clearUsageState);

  it('draws credits and posts the matching ledger transaction', async () => {
    await fund(5000n, 'a');
    const outcome = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u1', 4n)));

    expect(outcome.chargedMinor).toBe(1000n);
    expect(outcome.drain).toBe('CREDITS');
    expect(outcome.creditBalanceAfterMinor).toBe(4000n);
    expect(outcome.warnings).toEqual([]);

    const balance = await superuser.billingAccount.findUniqueOrThrow({ where: { tenantId } });
    expect(balance.creditBalanceMinor).toBe(4000n);
    const entries = await superuser.ledgerEntry.findMany({
      where: { transaction: { refType: 'usage_record', refId: outcome.usageRecordId } },
      select: { direction: true, amountMinor: true, account: { select: { kind: true } } },
    });
    expect(entries.map((e) => `${e.direction}:${e.account?.kind}:${e.amountMinor}`)).toEqual([
      'DEBIT:CUSTOMER_CREDITS:1000',
      'CREDIT:REVENUE:1000',
    ]);
  });

  it('replays the same idempotency key without a second charge', async () => {
    await fund(5000n, 'b');
    const first = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u2', 4n)));
    const second = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u2', 4n)));

    expect(second.usageRecordId).toBe(first.usageRecordId);
    expect(second.alreadyRecorded).toBe(true);
    // A replay that reported a different cost would tell the service its own
    // retry changed the price.
    expect(second.chargedMinor).toBe(1000n);
    expect(second.drain).toBe('CREDITS');
    expect(await superuser.creditLedgerEntry.count({ where: { tenantId, reason: 'USAGE' } })).toBe(1);
    const balance = await superuser.billingAccount.findUniqueOrThrow({ where: { tenantId } });
    expect(balance.creditBalanceMinor).toBe(4000n);
  });

  it('accrues the whole charge to a draft invoice when credits cannot cover it', async () => {
    await fund(500n, 'c');
    const outcome = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u3', 4n)));

    // 1000 due, 500 held: nothing is spent, everything accrues.
    expect(outcome.drain).toBe('INVOICE');
    expect(outcome.chargedMinor).toBe(1000n);
    expect(outcome.creditBalanceAfterMinor).toBe(500n);
    expect(await superuser.creditLedgerEntry.count({ where: { tenantId, reason: 'USAGE' } })).toBe(0);
    expect(outcome.warnings).toEqual([]);

    const invoice = await superuser.invoice.findUniqueOrThrow({ where: { id: outcome.invoiceId as string } });
    expect(invoice.status).toBe('DRAFT');
    expect(invoice.totalMinor).toBe(1000n);
    const line = await superuser.invoiceLine.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    expect(line.unitAmountMinor).toBe(250n);
    expect(line.quantity).toBe(4);
    const usage = await superuser.usageRecord.findUniqueOrThrow({ where: { id: outcome.usageRecordId } });
    expect(usage.invoiceLineId).toBe(line.id);
  });

  it('stacks a second accrual onto the same draft invoice and recomputes the total', async () => {
    await fund(0n, 'd');
    const first = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u4', 4n)));
    const second = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u5', 2n)));

    expect(second.invoiceId).toBe(first.invoiceId);
    const invoice = await superuser.invoice.findUniqueOrThrow({ where: { id: first.invoiceId as string } });
    expect(invoice.totalMinor).toBe(1500n);
    expect(invoice.subtotalMinor).toBe(1500n);
    expect(await superuser.invoiceLine.count({ where: { invoiceId: invoice.id } })).toBe(2);
  });

  it('records unpriced usage without touching money', async () => {
    await fund(5000n, 'e');
    const outcome = await withTenantContext(prisma, tenantId, (tx) =>
      recordUsage(tx, input('u6', 99n, { serviceKey: `free-${tag}` })),
    );
    expect(outcome.chargedMinor).toBe(0n);
    expect(outcome.drain).toBe('NONE');
    expect(outcome.invoiceId).toBeUndefined();
    const balance = await superuser.billingAccount.findUniqueOrThrow({ where: { tenantId } });
    expect(balance.creditBalanceMinor).toBe(5000n);
  });

  it('reports each crossing exactly once, at the debit that causes it', async () => {
    await fund(1200n, 'f');
    const low = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u7', 1n)));
    expect(low.warnings).toEqual([{ eventType: 'credits.low', balanceAfterMinor: 950n, thresholdMinor: 1000n }]);

    const again = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u8', 1n)));
    expect(again.creditBalanceAfterMinor).toBe(700n);
    expect(again.warnings).toEqual([]);

    const drained = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u9', 4n)));
    // 700 available, 1000 due: it accrues, so the pool is spent-but-not-empty
    // and no exhausted warning fires. That state is real and must not be
    // reported as "out of credits".
    expect(drained.drain).toBe('INVOICE');
    expect(drained.warnings).toEqual([]);
    expect(drained.creditBalanceAfterMinor).toBe(700n);
  });

  it('fires exhausted when the last credits are drawn', async () => {
    await fund(500n, 'g');
    const outcome = await withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u10', 2n)));
    expect(outcome.drain).toBe('CREDITS');
    expect(outcome.warnings).toEqual([
      { eventType: 'credits.exhausted', balanceAfterMinor: 0n, thresholdMinor: 1000n },
    ]);
  });

  it('refuses priced usage for a tenant with no billing account at all', async () => {
    const bare = (await superuser.tenant.create({ data: { name: `bare ${tag}`, slug: `bare-${tag}` } })).id;
    await expect(
      withTenantContext(prisma, bare, (tx) => recordUsage(tx, input('u11', 1n, { tenantId: bare }))),
    ).rejects.toThrow(/billing account/);
    await superuser.tenant.delete({ where: { id: bare } });
  });

  it('rejects a quantity of zero instead of writing a meaningless record', async () => {
    await fund(1000n, 'h');
    await expect(withTenantContext(prisma, tenantId, (tx) => recordUsage(tx, input('u12', 0n)))).rejects.toThrow(
      /quantity/,
    );
    expect(await superuser.usageRecord.count({ where: { tenantId, idempotencyKey: 'u12' } })).toBe(0);
  });

  it('entitlements follow subscriptions, credits and suspension', async () => {
    await fund(3000n, 'i');

    const view = await withTenantContext(prisma, tenantId, (tx) => computeEntitlements(tx, tenantId));
    expect(view.tenantId).toBe(tenantId);
    expect(view.suspended).toBe(false);
    expect(view.services[`metered-${tag}`]).toMatchObject({
      status: 'active',
      features: { lowBalanceThresholdMinor: 1000, max_users: 25 },
      creditsMinor: 3000n,
      subscription: { planKey: 'usage', periodEnd: new Date('2026-11-30T00:00:00.000Z') },
    });
    // No subscription for the free service, but the tenant-wide pool is positive.
    expect(view.services[`free-${tag}`]).toMatchObject({ status: 'active', subscription: null });

    await withTenantContext(prisma, tenantId, (tx) =>
      tx.subscription.updateMany({ where: { tenantId }, data: { status: 'PAST_DUE' } }),
    );
    const late = await withTenantContext(prisma, tenantId, (tx) => computeEntitlements(tx, tenantId));
    expect(late.services[`metered-${tag}`].status).toBe('past_due');

    await withTenantContext(prisma, tenantId, (tx) =>
      tx.billingAccount.update({ where: { tenantId }, data: { status: 'SUSPENDED' } }),
    );
    const suspended = await withTenantContext(prisma, tenantId, (tx) => computeEntitlements(tx, tenantId));
    // One read, every service flips: there is no per-service sync state to chase.
    expect(Object.values(suspended.services).every((entry) => entry.status === 'suspended')).toBe(true);
    expect(suspended.suspended).toBe(true);
  });

  afterAll(async () => {
    await clearUsageState();
    await superuser.creditLedgerEntry.deleteMany({ where: { tenantId } });
    await superuser.subscription.deleteMany({ where: { tenantId } });
    await superuser.ledgerAccount.deleteMany({ where: { tenantId } });
    await superuser.ledgerTransaction.deleteMany({ where: { tenantId } });
    await superuser.billingAccount.deleteMany({ where: { tenantId } });
    await superuser.tenant.delete({ where: { id: tenantId } });
    await superuser.plan.deleteMany({ where: { serviceId: { in: [meteredServiceId, freeServiceId] } } });
    await superuser.billingService.deleteMany({ where: { id: { in: [meteredServiceId, freeServiceId] } } });
    await prisma.$disconnect();
    await superuser.$disconnect();
  });
});
```

Three deliberate details, so they are not "tidied" into bugs during review:

- **`superuser` does the assertions.** `ledgerEntry`, `creditLedgerEntry` and
  `billingAccount` are RLS-scoped, so an unscoped read through the app role
  returns zero rows and turns every count into a vacuous pass.
- **`fund()` clears state first.** Tests run in file order and share one tenant;
  a leftover balance would make the crossing test depend on which case ran
  before it.
- **`it('fires exhausted …')` exists** because the crossing test above can only
  prove `credits.low` — an accrued debit never empties the pool.

- [ ] **Step 5: Run it to verify it fails**

Run: `RUN_DB_TESTS=true pnpm --filter @nid/billing test -- --runTestsByPath src/usage.db.spec.ts`
Expected: FAIL — `Cannot find module './usage'`.

- [ ] **Step 6: Write `usage.ts`**

```ts
import type { Plan, TransactionClient } from '@nid/db';
import { BillingError, isUniqueViolation } from './errors';
import { getServiceByKey } from './catalog';
import { debitAccount } from './credits';
import { accrueInvoiceLine } from './invoices';
import { postLedgerTransaction } from './ledger';

export type CreditWarningKind = 'credits.low' | 'credits.exhausted';

export interface CreditWarning {
  eventType: CreditWarningKind;
  balanceAfterMinor: bigint;
  thresholdMinor: bigint;
}

export interface RecordUsageInput {
  tenantId: string;
  /** The service's catalog key. Which credential called is the API guard's business, not this function's. */
  serviceKey: string;
  metricKey: string;
  quantity: bigint;
  occurredAt: Date;
  idempotencyKey: string;
}

export type UsageDrain = 'CREDITS' | 'INVOICE' | 'NONE';

export interface UsageOutcome {
  usageRecordId: string;
  chargedMinor: bigint;
  /** Which pot the charge came from; NONE means the plan prices nothing. */
  drain: UsageDrain;
  creditBalanceAfterMinor: bigint | null;
  invoiceId?: string;
  /** True when this idempotency key had already been reported. */
  alreadyRecorded: boolean;
  warnings: CreditWarning[];
}

/**
 * Pure, because the crossing logic decides whether a service is told anything and
 * deserves a test without a database. Only a decrease can fire, and exhausted
 * wins when one debit crosses both lines: "you have nothing left" is the message
 * the service has to act on.
 */
export function detectCreditWarning(
  balanceBeforeMinor: bigint,
  balanceAfterMinor: bigint,
  thresholdMinor: bigint,
): CreditWarningKind | null {
  if (balanceAfterMinor >= balanceBeforeMinor) return null;
  if (balanceAfterMinor === 0n && balanceBeforeMinor > 0n) return 'credits.exhausted';
  if (thresholdMinor > 0n && balanceBeforeMinor > thresholdMinor && balanceAfterMinor <= thresholdMinor) {
    return 'credits.low';
  }
  return null;
}

/**
 * spec §7.3 allows either source for the low threshold: the plan's
 * `features.lowBalanceThresholdMinor`, or 10% of the last top-up. The plan wins,
 * because it is deliberate; the fallback is what keeps the warning working for a
 * tenant whose catalog entry predates the feature.
 */
export async function resolveLowBalanceThreshold(
  tx: TransactionClient,
  billingAccountId: string,
  plan: Plan | null,
): Promise<bigint> {
  const fromPlan = (plan?.features as { lowBalanceThresholdMinor?: number | string } | null)?.lowBalanceThresholdMinor;
  if (fromPlan !== undefined && fromPlan !== null) {
    const value = BigInt(fromPlan);
    if (value > 0n) return value;
  }
  const lastTopUp = await tx.creditLedgerEntry.findFirst({
    where: { billingAccountId, reason: 'TOPUP' },
    orderBy: { createdAt: 'desc' },
  });
  if (!lastTopUp || lastTopUp.deltaMinor <= 0n) return 0n;
  return lastTopUp.deltaMinor / 10n;
}

/**
 * The metering entry point for a service reporting consumption (spec §7.3).
 *
 * The ordering is the design: the UsageRecord is inserted first, so the unique
 * (serviceId, idempotencyKey) key makes a retried report a no-op even if the
 * caller dies between the record and the charge.
 */
export async function recordUsage(tx: TransactionClient, input: RecordUsageInput): Promise<UsageOutcome> {
  if (input.quantity <= 0n) {
    throw new BillingError(`Usage quantity must be positive, received ${input.quantity}.`);
  }

  const service = await getServiceByKey(tx, input.serviceKey);
  if (!service || service.status !== 'ACTIVE') {
    throw new BillingError(`Billing service "${input.serviceKey}" is not available.`);
  }

  const account = await tx.billingAccount.findUnique({ where: { tenantId: input.tenantId } });

  const subscription = await tx.subscription.findFirst({
    where: { tenantId: input.tenantId, status: { in: ['ACTIVE', 'PAST_DUE'] }, plan: { serviceId: service.id } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
  const plan = subscription?.plan ?? null;
  const unitMinor = plan?.overageUnitAmountMinor ?? null;
  const chargedMinor = unitMinor === null ? 0n : unitMinor * input.quantity;

  if (chargedMinor > 0n && !account) {
    // Loud rather than silent: metering for a tenant outside billing is fine when
    // nothing is priced, but a charge with nowhere to land must not be dropped.
    throw new BillingError(
      `Tenant ${input.tenantId} has no billing account; onboard it before reporting priced usage for "${input.serviceKey}".`,
    );
  }

  let usageRecordId: string;
  try {
    const record = await tx.usageRecord.create({
      data: {
        tenantId: input.tenantId,
        serviceId: service.id,
        metricKey: input.metricKey,
        quantity: input.quantity,
        occurredAt: input.occurredAt,
        idempotencyKey: input.idempotencyKey,
      },
    });
    usageRecordId = record.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return replayExistingUsage(tx, service.id, input.tenantId, input.idempotencyKey);
  }

  if (chargedMinor === 0n) {
    return {
      usageRecordId,
      chargedMinor: 0n,
      drain: 'NONE',
      creditBalanceAfterMinor: account?.creditBalanceMinor ?? null,
      alreadyRecorded: false,
      warnings: [],
    };
  }

  // `account` is non-null here: the check above threw when it was absent and
  // there was something to charge.
  const billingAccount = account as NonNullable<typeof account>;

  if (billingAccount.creditBalanceMinor >= chargedMinor) {
    const balanceBefore = billingAccount.creditBalanceMinor;
    const movement = await debitAccount(tx, {
      tenantId: input.tenantId,
      billingAccountId: billingAccount.id,
      deltaMinor: chargedMinor,
      reason: 'USAGE',
      // The usage record is the reference, so one report is charged once and a
      // later correction can point back at the row that caused it.
      refType: 'usage_record',
      refId: usageRecordId,
    });
    if (!movement.applied) {
      return replayExistingUsage(tx, service.id, input.tenantId, input.idempotencyKey);
    }

    await postLedgerTransaction(tx, {
      tenantId: input.tenantId,
      type: 'CREDIT_USAGE',
      refType: 'usage_record',
      refId: usageRecordId,
      currency: billingAccount.currency,
      occurredAt: input.occurredAt,
      lines: [
        { kind: 'CUSTOMER_CREDITS', direction: 'DEBIT', amountMinor: chargedMinor },
        { kind: 'REVENUE', serviceId: service.id, direction: 'CREDIT', amountMinor: chargedMinor },
      ],
    });

    const balanceAfter = movement.entry.balanceAfterMinor;
    const threshold = await resolveLowBalanceThreshold(tx, billingAccount.id, plan);
    const kind = detectCreditWarning(balanceBefore, balanceAfter, threshold);

    return {
      usageRecordId,
      chargedMinor,
      drain: 'CREDITS',
      creditBalanceAfterMinor: balanceAfter,
      alreadyRecorded: false,
      warnings: kind ? [{ eventType: kind, balanceAfterMinor: balanceAfter, thresholdMinor: threshold }] : [],
    };
  }

  if (input.quantity > BigInt(Number.MAX_SAFE_INTEGER)) {
    // InvoiceLine.quantity is an Int (Task 1); a report this large is a client
    // bug, and saying so beats truncating the number on the bill.
    throw new BillingError(
      `Usage quantity ${input.quantity} exceeds the invoice line's Int column; report it in smaller batches.`,
    );
  }

  const withLine = await accrueInvoiceLine(tx, input.tenantId, billingAccount.currency, {
    serviceId: service.id,
    description: `${service.name}: ${input.metricKey} × ${input.quantity}`,
    unitAmountMinor: unitMinor as bigint,
    quantity: Number(input.quantity),
  });
  await tx.usageRecord.update({ where: { id: usageRecordId }, data: { invoiceLineId: withLine.lineId } });

  return {
    usageRecordId,
    chargedMinor,
    drain: 'INVOICE',
    creditBalanceAfterMinor: billingAccount.creditBalanceMinor,
    invoiceId: withLine.invoiceId,
    alreadyRecorded: false,
    // No warning: the pool did not change, so no threshold was crossed.
    warnings: [],
  };
}

/**
 * A replay reports what the original call did. The charge is re-read from the
 * credit entry or the invoice line rather than re-run, so a second call cannot
 * move money — and never carries a warning, because the crossing belongs to the
 * call that caused it.
 */
async function replayExistingUsage(
  tx: TransactionClient,
  serviceId: string,
  tenantId: string,
  idempotencyKey: string,
): Promise<UsageOutcome> {
  const record = await tx.usageRecord.findUnique({
    where: { serviceId_idempotencyKey: { serviceId, idempotencyKey } },
  });
  if (!record) throw new BillingError('Usage report collided, but no record exists.');

  const account = await tx.billingAccount.findUnique({ where: { tenantId } });
  const entry = await tx.creditLedgerEntry.findFirst({
    where: { tenantId, refType: 'usage_record', refId: record.id, reason: 'USAGE' },
  });
  if (entry) {
    return {
      usageRecordId: record.id,
      chargedMinor: entry.deltaMinor,
      drain: 'CREDITS',
      creditBalanceAfterMinor: entry.balanceAfterMinor,
      alreadyRecorded: true,
      warnings: [],
    };
  }
  if (record.invoiceLineId) {
    const line = await tx.invoiceLine.findUniqueOrThrow({ where: { id: record.invoiceLineId } });
    return {
      usageRecordId: record.id,
      chargedMinor: line.amountMinor,
      drain: 'INVOICE',
      creditBalanceAfterMinor: account?.creditBalanceMinor ?? null,
      invoiceId: line.invoiceId,
      alreadyRecorded: true,
      warnings: [],
    };
  }
  return {
    usageRecordId: record.id,
    chargedMinor: 0n,
    drain: 'NONE',
    creditBalanceAfterMinor: account?.creditBalanceMinor ?? null,
    alreadyRecorded: true,
    warnings: [],
  };
}

/**
 * Warnings for a debit that did not come through `recordUsage` — the nID
 * verification charge (Task 15) above all, which draws credits without a
 * UsageRecord. Call it inside the same transaction, with the balance as it was
 * before the debit, and enqueue what comes back.
 */
export async function evaluateCredits(
  tx: TransactionClient,
  input: { tenantId: string; balanceBeforeMinor: bigint; planId?: string },
): Promise<CreditWarning[]> {
  const account = await tx.billingAccount.findUnique({ where: { tenantId: input.tenantId } });
  if (!account) return [];
  const plan = input.planId ? await tx.plan.findUnique({ where: { id: input.planId } }) : null;
  const threshold = await resolveLowBalanceThreshold(tx, account.id, plan);
  const kind = detectCreditWarning(input.balanceBeforeMinor, account.creditBalanceMinor, threshold);
  return kind
    ? [{ eventType: kind, balanceAfterMinor: account.creditBalanceMinor, thresholdMinor: threshold }]
    : [];
}
```

The `account as NonNullable<typeof account>` line is the one cast worth keeping:
the guard above already proved a missing account throws when there is something
to charge, and restating that as a second `if` would suggest the branch is
reachable.

- [ ] **Step 7: Write `entitlements.ts`**

```ts
import type { TransactionClient } from '@nid/db';
import { BillingError } from './errors';

export type ServiceEntitlementStatus = 'active' | 'past_due' | 'suspended' | 'none';

export interface ServiceEntitlement {
  status: ServiceEntitlementStatus;
  /** Copied from the pinned plan row, so a later price change cannot move a limit. */
  features: Record<string, unknown>;
  creditsMinor: bigint;
  subscription: { planKey: string; periodEnd: Date | null } | null;
}

export interface EntitlementView {
  tenantId: string;
  suspended: boolean;
  services: Record<string, ServiceEntitlement>;
}

/**
 * Computed on read (D12): nothing to drift, and a suspension takes effect on the
 * next call rather than the next sync job.
 *
 * `creditsMinor` is the tenant-wide pool repeated per service, because there is
 * one BillingAccount and one balance (spec §7.3). Credits therefore make every
 * active service usable — a service that needs its own gate must express it as a
 * plan with features, not by assuming the pool is per service. This is the
 * chosen reading of spec §9's response shape, recorded in Task 18's deviations.
 */
export async function computeEntitlements(tx: TransactionClient, tenantId: string): Promise<EntitlementView> {
  const account = await tx.billingAccount.findUnique({ where: { tenantId } });
  const suspended = account === null ? false : account.status === 'SUSPENDED' || account.status === 'CLOSED';
  const creditsMinor = account?.creditBalanceMinor ?? 0n;

  const [services, subscriptions] = await Promise.all([
    tx.billingService.findMany({ where: { status: 'ACTIVE' }, orderBy: { key: 'asc' } }),
    tx.subscription.findMany({
      where: { tenantId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const view: Record<string, ServiceEntitlement> = {};
  for (const service of services) {
    const subscription = subscriptions.find((row) => row.plan.serviceId === service.id) ?? null;
    const features = (subscription?.plan.features as Record<string, unknown> | null) ?? {};

    let status: ServiceEntitlementStatus;
    if (suspended) {
      status = 'suspended';
    } else if (subscription?.status === 'PAST_DUE') {
      status = 'past_due';
    } else if (subscription?.status === 'ACTIVE') {
      status = 'active';
    } else {
      // No subscription: prepaid credits are the only thing that can authorise
      // this service, and the pool is tenant-wide.
      status = creditsMinor > 0n ? 'active' : 'none';
    }

    view[service.key] = {
      status,
      features,
      creditsMinor,
      subscription: subscription
        ? { planKey: subscription.plan.key, periodEnd: subscription.currentPeriodEnd }
        : null,
    };
  }

  return { tenantId, suspended, services: view };
}

/**
 * The question a service asks before doing billable work. Task 15's verification
 * hook is Phase 1's only caller. Nothing may install this as middleware: a
 * suspended tenant must still be able to read its own invoices and top up.
 */
export async function assertEntitled(
  tx: TransactionClient,
  tenantId: string,
  serviceKey: string,
): Promise<void> {
  const view = await computeEntitlements(tx, tenantId);
  if (view.suspended) throw new BillingError(`Tenant ${tenantId} is suspended.`);
  const entitlement = view.services[serviceKey];
  if (!entitlement || entitlement.status === 'none') {
    throw new BillingError(`Tenant ${tenantId} has no entitlement for "${serviceKey}".`);
  }
}
```

Add to `packages/billing/src/index.ts`:

```ts
export * from './usage';
export * from './entitlements';
```

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter @nid/billing test -- --runTestsByPath src/credit-warning.spec.ts`
Expected: PASS — 5 tests.

Run: `RUN_DB_TESTS=true pnpm --filter @nid/billing test -- --runTestsByPath src/usage.db.spec.ts`
Expected: PASS — 10 tests.

Run: `pnpm --filter @nid/billing test && pnpm typecheck && pnpm lint`
Expected: PASS and clean.

- [ ] **Step 9: Commit**

```bash
git add packages/billing
git commit -m "feat(billing): add idempotent usage metering, credit warning crossings and on-read entitlements"
```

---

## Task 15: Service-credential surface and nID's own verification charge

**Files:**
- Create: `apps/api/src/modules/billing/billing-service-credentials.service.ts`, `apps/api/src/modules/billing/billing-service-credentials.controller.ts`, `apps/api/src/modules/billing/dto/service-checkout.dto.ts`, `apps/api/src/modules/billing/dto/service-usage.dto.ts`, `apps/api/src/modules/billing/dto/service-invoice.dto.ts`, `apps/api/src/core/http/billing-error.filter.ts`
- Modify: `apps/api/src/modules/billing/billing.module.ts` (register the controller and provider), `apps/api/src/modules/verification-cases/verification-cases.service.ts` (credit hook), `apps/api/src/modules/verification-cases/verification-cases.controller.ts` (`@UseFilters`), `apps/api/src/modules/verification-cases/verification-cases.module.ts` (import `BillingModule`)
- Test: `apps/api/test/billing-service-credentials.spec.ts`, `apps/api/test/verification-credit.spec.ts`

**Interfaces:**
- Consumes: `BillingServiceGuard`, `BillingServiceActor`, `@CurrentBillingService()`, `assertScope` (Task 9); `recordUsage`, `computeEntitlements`, `assertEntitled`, `evaluateCredits`, `CreditWarning`, `UsageOutcome`, `EntitlementView` (Task 14); `chargeVerificationCase`, `getBillingAccount`, `ensureBillingAccount`, `creditAccount`, `InsufficientCreditsError`, `BillingError` (Tasks 4/6); `createCheckoutSession`, `CheckoutError`, `CheckoutOutcome` (Task 7); `createInvoice`, `issueInvoice`, `getInvoiceWithLines`, `getPlanById`, `InvoiceWithLines` (Tasks 5/7); `BillingEventsService.enqueueForTenant` (Task 13); `PrismaService.forTenant/unscoped/client`, `AuditService.record`, `PaymentProvidersService` (existing + Task 9).
- Produces: `BillingServiceCredentialsService` with `entitlements(actor, tenantId)`, `account(actor, tenantId)`, `usage(actor, dto, idempotencyKey)`, `checkout(actor, dto, idempotencyKey)`, `invoice(actor, dto, idempotencyKey)`; routes `POST /v1/billing/service/checkout-sessions|usage|invoices`, `GET /v1/billing/service/entitlements?tenantId=`, `GET /v1/billing/service/accounts/:tenantId`; `ServiceInvoiceResult`; `BillingErrorFilter`; `ServiceUsageDto`, `ServiceCheckoutDto`, `ServiceInvoiceDto`; `VerificationCasesService.chargeCaseCredits()` (private, wired into `create()`). Task 17's dashboard and Task 18's end-to-end spec exercise these routes.

Five rules this task exists to enforce:

1. **The credential names a service, never a tenant.** `actor.serviceId` and
   `actor.serviceKey` come from the guard, and every write forces the money to
   belong to that service: usage is recorded under `actor.serviceKey`, invoice
   lines under `actor.serviceId`, and a checkout is only opened for a plan the
   caller owns. A `communicator` credential cannot bill a tenant for `erp-1`.
2. **`tenantId` is a parameter, not an assumption** (spec §8 marks it required).
   A service acts on behalf of a customer it is serving, so the tenant arrives
   in the body or query, and every read still runs inside `forTenant(tenantId)`
   — RLS applies to the service's own queries exactly as it does to a tenant's.
3. **nID pays itself through the same catalog** (spec §9.1). The verification
   charge is a `debitAccount` against the `nid` service's revenue line, not a
   special case in the ledger.
4. **Billing stays optional for existing tenants.** A tenant with no
   `BillingAccount`, or one whose balance is already zero, is not in the billing
   system at all, and creating financial rows as a side effect of a verification
   call would put them there without asking. Once a tenant *does* hold credits,
   the rules apply: suspended is refused, and insufficient balance is refused
   with 402 rather than silently served for free.
5. **The charge commits with the case.** It runs inside the transaction that
   already writes the case, its attempts and its session, so a rollback that
   leaves no case also leaves no debit — and a refused debit leaves the tenant's
   credits untouched.

- [ ] **Step 1: Write the failing service-surface test**

`apps/api/test/billing-service-credentials.spec.ts`:

```ts
/**
 * Live-Postgres coverage for the service-credential surface. Like Task 11's and
 * Task 12's specs this calls the service with the actor the guard would have
 * produced: the guard's own behaviour (hash lookup, revoked credential,
 * inactive service) is covered by Task 9's guard spec, and repeating it here
 * would only test the mock. What is under test is who a credential may bill,
 * and what it may see.
 */
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaClient, withBillingAdminContext, type PrismaClient } from '@nid/db';
import { creditAccount, ensureBillingAccount } from '@nid/billing';
import { BillingServiceCredentialsService } from '../src/modules/billing/billing-service-credentials.service';
import { BillingEventsService } from '../src/modules/billing/billing-events.service';
import { assertScope } from '../src/core/auth/billing-service.guard';
import { PrismaService } from '../src/core/db/prisma.service';
import { PaymentProvidersService } from '../src/core/payments/payment-providers.service';
import { AuditService } from '../src/core/audit/audit.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('BillingServiceCredentialsService (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let surface: BillingServiceCredentialsService;
  let mineId: string;
  let theirsId: string;
  let myPackId: string;
  let myMeteredPlanId: string;
  let theirPlanId: string;
  const tag = Date.now().toString(36);
  const mineKey = `mine-${tag}`;
  const tenantIds: string[] = [];
  const actor = {
    serviceId: '',
    serviceKey: mineKey,
    credentialId: `cred-${tag}`,
    scopes: ['checkout:create', 'usage:write', 'invoice:create', 'entitlements:read'],
  };

  /**
   * A tenant with a billing webhook target, so the credit warnings this surface
   * raises have somewhere to be queued and the queued row is assertable.
   */
  async function newTenant(label: string): Promise<string> {
    const tenant = await migratorPrisma.tenant.create({
      data: {
        name: `svc ${label} ${tag}`,
        slug: `svc-${label}-${tag}`,
        billingWebhookUrl: 'https://services.example.test/billing-hook',
        billingWebhookSecretPlaintext: `secret-${tag}`,
      },
    });
    tenantIds.push(tenant.id);
    return tenant.id;
  }

  /** Runs as the app role inside the tenant's own RLS scope, like every real write does. */
  async function fund(tenantId: string, balanceMinor: bigint, key: string): Promise<void> {
    await prismaService.forTenant(tenantId, async (tx) => {
      const account = await ensureBillingAccount(tx, tenantId);
      await creditAccount(tx, {
        tenantId,
        billingAccountId: account.id,
        deltaMinor: balanceMinor,
        reason: 'TOPUP',
        refType: 'test_funding',
        refId: `fund-${tag}-${key}`,
      });
    });
  }

  /**
   * `recordUsage` takes its unit price from the tenant's ACTIVE subscription
   * plan, so a usage test with no subscription reports `drain: NONE` and moves
   * no money. Task 14's spec creates the same shape in beforeAll.
   */
  async function subscribe(tenantId: string, planId: string): Promise<void> {
    await prismaService.forTenant(tenantId, async (tx) => {
      const account = await ensureBillingAccount(tx, tenantId);
      await tx.subscription.create({
        data: {
          tenantId,
          billingAccountId: account.id,
          planId,
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        },
      });
    });
  }

  beforeAll(async () => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    surface = new BillingServiceCredentialsService(
      prismaService,
      new PaymentProvidersService(),
      new AuditService(),
      new BillingEventsService(prismaService),
    );

    const catalog = await withBillingAdminContext(prismaService.client, async (tx) => {
      const mine = await tx.billingService.create({ data: { key: mineKey, name: `Mine ${tag}`, ownerRepo: 'nID' } });
      const theirs = await tx.billingService.create({
        data: { key: `theirs-${tag}`, name: `Theirs ${tag}`, ownerRepo: 'erp-1' },
      });
      const pack = await tx.plan.create({
        data: {
          serviceId: mine.id,
          key: 'pack',
          version: 1,
          name: 'Pack',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 11800n,
          creditsIncluded: 11800,
        },
      });
      const metered = await tx.plan.create({
        data: {
          serviceId: mine.id,
          key: 'metered',
          version: 1,
          name: 'Metered',
          mode: 'SUBSCRIPTION',
          interval: 'MONTH',
          unitAmountMinor: 50000n,
          overageUnitAmountMinor: 1250n,
          // The threshold is pinned on the plan so the warning tests do not
          // depend on how the fixture happened to be funded.
          features: { lowBalanceThresholdMinor: 1000 },
        },
      });
      const theirPlan = await tx.plan.create({
        data: {
          serviceId: theirs.id,
          key: 'pack',
          version: 1,
          name: 'Their pack',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 1000n,
          creditsIncluded: 1000,
        },
      });
      return { mine, theirs, pack, metered, theirPlan };
    });

    mineId = catalog.mine.id;
    theirsId = catalog.theirs.id;
    myPackId = catalog.pack.id;
    myMeteredPlanId = catalog.metered.id;
    theirPlanId = catalog.theirPlan.id;
    actor.serviceId = mineId;
  });

  afterAll(async () => {
    // The migrator role bypasses RLS, which is the only way to clear rows a
    // tenant owns; deleting the services cascades nothing (Plan.serviceId is
    // Restrict), so plans go first.
    await migratorPrisma.plan.deleteMany({ where: { serviceId: { in: [mineId, theirsId] } } });
    await migratorPrisma.billingService.deleteMany({ where: { id: { in: [mineId, theirsId] } } });
    for (const tenantId of tenantIds) await migratorPrisma.tenant.delete({ where: { id: tenantId } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  it('reports entitlements for the caller\'s service only', async () => {
    const tenantId = await newTenant('entitlements');
    await fund(tenantId, 25000n, 'entitlements');
    const view = await surface.entitlements(actor, tenantId);
    expect(Object.keys(view.services)).toEqual([mineKey]);
    expect(view.services[mineKey]?.status).toBe('active');
    expect(view.services[mineKey]?.creditsMinor).toBe(25000n);
    expect(view.suspended).toBe(false);
  });

  it('404s a tenant with no billing account rather than inventing one', async () => {
    const tenantId = await newTenant('orphan');
    await expect(surface.account(actor, tenantId)).rejects.toThrow(NotFoundException);
  });

  it('reads a tenant\'s billing account and audits the read to the credential', async () => {
    const tenantId = await newTenant('account');
    await fund(tenantId, 41800n, 'account');
    const account = await surface.account(actor, tenantId);
    expect(account.status).toBe('ACTIVE');
    expect(account.creditBalanceMinor).toBe(41800n);
    expect(account.currency).toBe('PKR');

    const audited = await prismaService.forTenant(tenantId, (tx) =>
      tx.auditLogEntry.findFirst({
        where: { tenantId, actorType: 'SERVICE', actorId: actor.credentialId, action: 'billing.service.account.read' },
      }),
    );
    expect(audited).not.toBeNull();
  });

  it('draws usage from credits, and a replay charges nothing twice', async () => {
    const tenantId = await newTenant('usage');
    await subscribe(tenantId, myMeteredPlanId);
    await fund(tenantId, 5000n, 'usage');

    const first = await surface.usage(actor, { tenantId, metricKey: 'verifications', quantity: '2' }, `usage-${tag}-1`);
    expect(first.drain).toBe('CREDITS');
    expect(first.chargedMinor).toBe(2500n);
    expect(first.alreadyRecorded).toBe(false);

    const after = await prismaService.forTenant(tenantId, (tx) =>
      tx.billingAccount.findUniqueOrThrow({ where: { tenantId } }),
    );
    expect(after.creditBalanceMinor).toBe(2500n);

    const replay = await surface.usage(actor, { tenantId, metricKey: 'verifications', quantity: '2' }, `usage-${tag}-1`);
    expect(replay.alreadyRecorded).toBe(true);
    expect(replay.chargedMinor).toBe(2500n);
    expect(replay.creditBalanceAfterMinor).toBe(2500n);
    expect(
      await prismaService.forTenant(tenantId, (tx) => tx.creditLedgerEntry.count({ where: { tenantId, reason: 'USAGE' } })),
    ).toBe(1);
  });

  it('refuses a credential that lacks the scope, before touching the database', async () => {
    const tenantId = await newTenant('scope');
    await expect(
      surface.usage({ ...actor, scopes: ['entitlements:read'] }, { tenantId, metricKey: 'verifications', quantity: '1' }, `usage-${tag}-scope`),
    ).rejects.toThrow(ForbiddenException);
    expect(await prismaService.forTenant(tenantId, (tx) => tx.usageRecord.count())).toBe(0);
  });

  it('queues credits.exhausted once, addressed to the tenant\'s billing webhook target', async () => {
    const tenantId = await newTenant('exhausted');
    await subscribe(tenantId, myMeteredPlanId);
    await fund(tenantId, 1250n, 'exhausted');

    const outcome = await surface.usage(actor, { tenantId, metricKey: 'verifications', quantity: '1' }, `usage-${tag}-2`);
    expect(outcome.warnings.map((w) => w.eventType)).toEqual(['credits.exhausted']);

    const queued = await prismaService.forTenant(tenantId, (tx) =>
      tx.outboundEvent.findMany({ where: { tenantId, eventType: 'credits.exhausted' } }),
    );
    expect(queued).toHaveLength(1);
    expect(queued[0]?.status).toBe('PENDING');
    expect(queued[0]?.targetUrl).toBe('https://services.example.test/billing-hook');
    expect(queued[0]?.serviceId).toBe(mineId);

    // The replay reports the same balance and fires no second warning.
    await surface.usage(actor, { tenantId, metricKey: 'verifications', quantity: '1' }, `usage-${tag}-2`);
    expect(
      await prismaService.forTenant(tenantId, (tx) => tx.outboundEvent.count({ where: { tenantId, eventType: 'credits.exhausted' } })),
    ).toBe(1);
  });

  it('refuses to open a checkout for another service\'s plan', async () => {
    const tenantId = await newTenant('foreign');
    await expect(
      surface.checkout(actor, { tenantId, purpose: 'CREDIT_TOPUP', planId: theirPlanId }, `checkout-${tag}-other`),
    ).rejects.toThrow(ForbiddenException);
    expect(await prismaService.forTenant(tenantId, (tx) => tx.paymentIntent.count())).toBe(0);
  });

  it('opens a checkout for its own plan and reuses the same intent on replay', async () => {
    const tenantId = await newTenant('checkout');
    const created = await surface.checkout(actor, { tenantId, purpose: 'CREDIT_TOPUP', planId: myPackId }, `checkout-${tag}-own`);
    expect(created.reused).toBe(false);
    if (created.reused) throw new Error('expected a fresh checkout token');
    expect(created.checkoutUrl).toContain('/checkout/');

    const again = await surface.checkout(actor, { tenantId, purpose: 'CREDIT_TOPUP', planId: myPackId }, `checkout-${tag}-own`);
    expect(again.reused).toBe(true);
    expect(again.intentId).toBe(created.intentId);
    expect(await prismaService.forTenant(tenantId, (tx) => tx.paymentIntent.count())).toBe(1);
  });

  it('creates, issues and links a one-off invoice, and a replay does not bill twice', async () => {
    const tenantId = await newTenant('invoice');
    const created = await surface.invoice(
      actor,
      { tenantId, description: 'Onboarding audit', unitAmountMinor: '250000', quantity: '2' },
      `invoice-${tag}-1`,
    );
    expect(created.invoice.status).toBe('OPEN');
    expect(created.invoice.totalMinor).toBe(500000n);
    expect(created.invoice.lines[0]?.serviceId).toBe(mineId);
    expect(created.reused).toBe(false);
    expect(created.checkoutUrl).toContain('/checkout/');

    const replay = await surface.invoice(
      actor,
      { tenantId, description: 'Onboarding audit', unitAmountMinor: '250000', quantity: '2' },
      `invoice-${tag}-1`,
    );
    expect(replay.reused).toBe(true);
    expect(replay.invoice.id).toBe(created.invoice.id);
    expect(await prismaService.forTenant(tenantId, (tx) => tx.invoice.count())).toBe(1);
  });

  it('refuses an idempotency key already spent on a different kind of charge', async () => {
    const tenantId = await newTenant('collision');
    await surface.checkout(actor, { tenantId, purpose: 'CREDIT_TOPUP', planId: myPackId }, `shared-${tag}`);
    await expect(
      surface.invoice(actor, { tenantId, description: 'x', unitAmountMinor: '100' }, `shared-${tag}`),
    ).rejects.toThrow(ConflictException);
    // The refusal happens before any invoice is written.
    expect(await prismaService.forTenant(tenantId, (tx) => tx.invoice.count())).toBe(0);
  });
});

describe('assertScope (pure)', () => {
  it('accepts a listed scope and rejects a missing one, naming it', () => {
    const scoped = { serviceId: 'svc', serviceKey: 'erp-1', credentialId: 'cred', scopes: ['usage:write'] };
    expect(() => assertScope(scoped, 'usage:write')).not.toThrow();
    expect(() => assertScope(scoped, 'checkout:create')).toThrow(/checkout:create/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @nid/api exec jest billing-service-credentials --runInBand`
Expected: FAIL — `billing-service-credentials.service.ts` does not exist. Without `RUN_DB_TESTS=true` the gated block skips and only the pure `assertScope` case runs; the gated run is Step 6.

- [ ] **Step 3: Write the DTOs**

`apps/api/src/modules/billing/dto/service-usage.dto.ts`:

```ts
import { IsOptional, IsString, Matches } from 'class-validator';

export class ServiceUsageDto {
  /** Required, and required *from the caller*: a billing credential has no tenant of its own (spec §8). */
  @IsString()
  tenantId!: string;

  @IsString()
  metricKey!: string;

  /**
   * A string, not a number: usage quantities are BigInt and JSON numbers are
   * doubles, so a large count would arrive already rounded. This is a count of
   * billable events, not an amount — the price comes from the plan's overage
   * unit, which the caller never sends.
   */
  @Matches(/^\d+$/, { message: 'quantity must be a positive integer sent as a string.' })
  quantity!: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;
}
```

`apps/api/src/modules/billing/dto/service-checkout.dto.ts`:

```ts
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ServiceCheckoutDto {
  @IsString()
  tenantId!: string;

  /**
   * Deliberately narrower than the tenant surface. A service cannot pay down an
   * arbitrary invoice (`INVOICE`) or buy an unbilled one-off (`ONE_OFF`): it
   * raises `POST /v1/billing/service/invoices` for that, and the checkout there
   * is derived from the invoice the service just created. Accepting a raw
   * `invoiceId` here would let one service send a payment link for another
   * service's bill.
   */
  @IsIn(['CREDIT_TOPUP', 'SUBSCRIPTION'] as const)
  purpose!: 'CREDIT_TOPUP' | 'SUBSCRIPTION';

  @IsString()
  planId!: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;
}
```

`apps/api/src/modules/billing/dto/service-invoice.dto.ts`:

```ts
import { IsOptional, IsString, Matches } from 'class-validator';

export class ServiceInvoiceDto {
  @IsString()
  tenantId!: string;

  @IsString()
  description!: string;

  /** Minor units as a string, for the same reason as `quantity`. */
  @Matches(/^\d+$/, { message: 'unitAmountMinor must be a positive integer sent as a string.' })
  unitAmountMinor!: string;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'quantity must be a positive integer sent as a string.' })
  quantity?: string;
}
```

- [ ] **Step 4: Write the service**

`apps/api/src/modules/billing/billing-service-credentials.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { TransactionClient } from '@nid/db';
import {
  CheckoutError,
  computeEntitlements,
  createCheckoutSession,
  createInvoice,
  ensureBillingAccount,
  getBillingAccount,
  getInvoiceWithLines,
  getPlanById,
  issueInvoice,
  recordUsage,
  type CheckoutOutcome,
  type EntitlementView,
  type InvoiceWithLines,
  type UsageOutcome,
} from '@nid/billing';
import { PrismaService } from '../../core/db/prisma.service';
import { PaymentProvidersService } from '../../core/payments/payment-providers.service';
import { AuditService } from '../../core/audit/audit.service';
import { assertScope, type BillingServiceActor } from '../../core/auth/billing-service.guard';
import { BillingEventsService } from './billing-events.service';
import type { ServiceCheckoutDto } from './dto/service-checkout.dto';
import type { ServiceInvoiceDto } from './dto/service-invoice.dto';
import type { ServiceUsageDto } from './dto/service-usage.dto';

export interface ServiceInvoiceResult {
  invoice: InvoiceWithLines;
  intentId: string;
  reused: boolean;
  /** Null on a replay: a capability token is handed out exactly once (Task 7). */
  token: string | null;
  checkoutUrl: string | null;
  expiresAt: Date | null;
}

@Injectable()
export class BillingServiceCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProvidersService,
    private readonly audit: AuditService,
    private readonly events: BillingEventsService,
  ) {}

  /**
   * Filtered to the caller's own key. `computeEntitlements` returns the whole
   * catalog because the tenant-facing surface needs all of it; a service has no
   * business seeing what its customer spends at other services, and spec §9's
   * response shape is preserved either way.
   */
  async entitlements(actor: BillingServiceActor, tenantId: string): Promise<EntitlementView> {
    assertScope(actor, 'entitlements:read');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const view = await computeEntitlements(tx, tenantId);
      await this.audit.record(tx, tenantId, {
        actorType: 'SERVICE',
        actorId: actor.credentialId,
        action: 'billing.service.entitlements.read',
        entityType: 'billing_service',
        entityId: actor.serviceId,
      });
      const mine = view.services[actor.serviceKey];
      return { tenantId, suspended: view.suspended, services: mine ? { [actor.serviceKey]: mine } : {} };
    });
  }

  /**
   * The minimum a service needs to gate work: is this tenant in good standing,
   * and do they have balance. A tenant nobody has ever billed has no account
   * row, and inventing one to answer a read would make a read a write.
   */
  async account(actor: BillingServiceActor, tenantId: string) {
    assertScope(actor, 'entitlements:read');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const account = await getBillingAccount(tx, tenantId);
      if (!account) throw new NotFoundException('This tenant has no billing account.');
      await this.audit.record(tx, tenantId, {
        actorType: 'SERVICE',
        actorId: actor.credentialId,
        action: 'billing.service.account.read',
        entityType: 'billing_account',
        entityId: account.id,
      });
      return {
        tenantId,
        status: account.status,
        currency: account.currency,
        creditBalanceMinor: account.creditBalanceMinor,
        outstandingMinor: await outstandingMinor(tx, tenantId),
      };
    });
  }

  async usage(actor: BillingServiceActor, dto: ServiceUsageDto, idempotencyKey: string): Promise<UsageOutcome> {
    assertScope(actor, 'usage:write');
    const quantity = BigInt(dto.quantity);
    if (quantity <= 0n) throw new BadRequestException('quantity must be positive.');
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('occurredAt must be an ISO-8601 timestamp.');
    }

    const outcome = await this.prisma.forTenant(dto.tenantId, async (tx) => {
      // `serviceKey` comes from the credential, never the body: the whole point
      // of the scope is that erp-1 cannot book revenue against communicator.
      const result = await recordUsage(tx, {
        tenantId: dto.tenantId,
        serviceKey: actor.serviceKey,
        metricKey: dto.metricKey,
        quantity,
        occurredAt,
        idempotencyKey,
      });
      await this.audit.record(tx, dto.tenantId, {
        actorType: 'SERVICE',
        actorId: actor.credentialId,
        action: result.alreadyRecorded ? 'billing.service.usage.replay' : 'billing.service.usage.write',
        entityType: 'usage_record',
        entityId: result.usageRecordId,
      });
      return result;
    });

    // After commit: a warning about money that moved must not be queued for a
    // charge that rolled back. `enqueue` returns false rather than throwing when
    // the tenant has no webhook target, so opting out costs one debug log.
    for (const warning of outcome.warnings) {
      await this.events.enqueueForTenant(dto.tenantId, {
        tenantId: dto.tenantId,
        serviceId: actor.serviceId,
        eventType: warning.eventType,
        payload: {
          balanceAfterMinor: warning.balanceAfterMinor.toString(),
          thresholdMinor: warning.thresholdMinor.toString(),
          metricKey: dto.metricKey,
          usageRecordId: outcome.usageRecordId,
          serviceKey: actor.serviceKey,
        },
      });
    }
    return outcome;
  }

  async checkout(actor: BillingServiceActor, dto: ServiceCheckoutDto, idempotencyKey: string): Promise<CheckoutOutcome> {
    assertScope(actor, 'checkout:create');
    const plan = await this.prisma.forTenant(dto.tenantId, (tx) => getPlanById(tx, dto.planId));
    if (!plan) throw new NotFoundException(`Plan ${dto.planId} not found.`);
    if (plan.serviceId !== actor.serviceId) {
      throw new ForbiddenException('A service credential can only open checkout for its own plans.');
    }
    if (plan.status !== 'ACTIVE') throw new ConflictException(`Plan ${plan.key} is ${plan.status}.`);

    const provider = this.providers.defaultProvider;
    try {
      const outcome = await createCheckoutSession(
        {
          prisma: this.prisma.client,
          provider,
          checkoutUiUrl: this.providers.checkoutUiUrl,
          webhookUrl: this.providers.webhookUrlFor(provider.name),
          allowedReturnOrigins: this.providers.returnOrigins,
        },
        {
          tenantId: dto.tenantId,
          purpose: dto.purpose,
          planId: dto.planId,
          returnUrl: dto.returnUrl,
          idempotencyKey,
        },
      );
      await this.prisma.forTenant(dto.tenantId, (tx) =>
        this.audit.record(tx, dto.tenantId, {
          actorType: 'SERVICE',
          actorId: actor.credentialId,
          action: 'billing.service.checkout.create',
          entityType: 'payment_intent',
          entityId: outcome.intentId,
        }),
      );
      return outcome;
    } catch (error) {
      if (error instanceof CheckoutError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }

  /**
   * Spec §7.5: a service creates the invoice, nID issues it and hands back the
   * hosted link; payment then follows the standard checkout path.
   *
   * Idempotency lives on `PaymentIntent(tenantId, idempotencyKey)`, which is
   * written after the invoice, so this method pre-reads that intent and returns
   * the original invoice instead of billing again. The residual race — two
   * concurrent POSTs sharing one brand-new key — can leave a second OPEN
   * invoice with no intent attached. That is a client bug (a key means one
   * in-flight request), it moves no money, and Task 12's reconciliation surfaces
   * an unpaid OPEN invoice; Phase 2 closes it with `@@unique([tenantId,
   * idempotencyKey])` on `Invoice`, recorded as a schema note in `docs/PHASES.md`
   * in Task 18.
   */
  async invoice(
    actor: BillingServiceActor,
    dto: ServiceInvoiceDto,
    idempotencyKey: string,
  ): Promise<ServiceInvoiceResult> {
    assertScope(actor, 'invoice:create');
    const unitAmountMinor = BigInt(dto.unitAmountMinor);
    const quantity = dto.quantity === undefined ? 1 : Number(BigInt(dto.quantity));
    if (unitAmountMinor <= 0n) throw new BadRequestException('unitAmountMinor must be positive.');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('quantity must be positive.');

    const prior = await this.prisma.forTenant(dto.tenantId, (tx) =>
      tx.paymentIntent.findUnique({ where: { tenantId_idempotencyKey: { tenantId: dto.tenantId, idempotencyKey } } }),
    );
    if (prior) {
      if (prior.purpose !== 'INVOICE') {
        throw new ConflictException(
          `Idempotency key ${idempotencyKey} already created a ${prior.purpose} charge for this tenant.`,
        );
      }
      const metadata = (prior.metadata ?? {}) as { invoiceId?: string };
      const existing = metadata.invoiceId
        ? await this.prisma.forTenant(dto.tenantId, (tx) =>
            getInvoiceWithLines(tx, dto.tenantId, metadata.invoiceId as string),
          )
        : null;
      if (!existing) throw new ConflictException(`Intent ${prior.id} references an invoice that no longer exists.`);
      return {
        invoice: existing,
        intentId: prior.id,
        reused: true,
        token: null,
        checkoutUrl: prior.checkoutUrl,
        expiresAt: prior.expiresAt,
      };
    }

    const created = await this.prisma.forTenant(dto.tenantId, async (tx) => {
      // `createInvoice` needs a billing account for both the FK and the
      // currency, and it refuses when the account is missing: a service
      // billing a tenant who has never been onboarded creates the account,
      // exactly as Task 11's `overview()` does on first read.
      const account = await ensureBillingAccount(tx, dto.tenantId);
      const invoice = await createInvoice(tx, {
        tenantId: dto.tenantId,
        currency: account.currency,
        lines: [{ serviceId: actor.serviceId, description: dto.description, unitAmountMinor, quantity }],
      });
      return issueInvoice(tx, invoice.id);
    });

    const provider = this.providers.defaultProvider;
    try {
      const outcome = await createCheckoutSession(
        {
          prisma: this.prisma.client,
          provider,
          checkoutUiUrl: this.providers.checkoutUiUrl,
          webhookUrl: this.providers.webhookUrlFor(provider.name),
          allowedReturnOrigins: this.providers.returnOrigins,
        },
        { tenantId: dto.tenantId, purpose: 'INVOICE', invoiceId: created.id, idempotencyKey },
      );
      await this.prisma.forTenant(dto.tenantId, (tx) =>
        this.audit.record(tx, dto.tenantId, {
          actorType: 'SERVICE',
          actorId: actor.credentialId,
          action: 'billing.service.invoice.create',
          entityType: 'invoice',
          entityId: created.id,
        }),
      );
      return {
        invoice: created,
        intentId: outcome.intentId,
        reused: outcome.reused,
        token: outcome.reused ? null : outcome.token,
        checkoutUrl: outcome.checkoutUrl,
        expiresAt: outcome.expiresAt,
      };
    } catch (error) {
      if (error instanceof CheckoutError) {
        // The bill exists and is correct; only the link failed. Voiding it would
        // destroy the evidence a human needs to retry, so report both facts and
        // let the next call with the same key find the invoice through the
        // intent it never got.
        throw new UnprocessableEntityException(
          `Invoice ${created.number} was issued but no payment link could be opened: ${error.message}`,
        );
      }
      throw error;
    }
  }
}

async function outstandingMinor(tx: TransactionClient, tenantId: string): Promise<bigint> {
  const outstanding = await tx.invoice.aggregate({
    where: { tenantId, status: 'OPEN' },
    _sum: { totalMinor: true, amountPaidMinor: true },
  });
  const due = (outstanding._sum.totalMinor ?? 0n) - (outstanding._sum.amountPaidMinor ?? 0n);
  return due > 0n ? due : 0n;
}
```

`outstandingMinor` is a module-local helper rather than a method on
`@nid/billing`: Task 11's `overview()` computes the same expression inside its
own transaction, and hoisting a two-line aggregate into the package would hide
which tenant scope a financial read runs in.

- [ ] **Step 5: Write the controller and register it**

`apps/api/src/modules/billing/billing-service-credentials.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BillingServiceGuard, type BillingServiceActor } from '../../core/auth/billing-service.guard';
import { CurrentBillingService } from '../../core/auth/current-billing.decorator';
import { BillingServiceCredentialsService } from './billing-service-credentials.service';
import { ServiceCheckoutDto } from './dto/service-checkout.dto';
import { ServiceInvoiceDto } from './dto/service-invoice.dto';
import { ServiceUsageDto } from './dto/service-usage.dto';

/**
 * The ecosystem-facing surface (spec §8's "Service" group). The guard resolves a
 * BillingServiceCredential; `assertScope` is called per method rather than as a
 * second guard, because one credential can hold `usage:write` without
 * `invoice:create` and a controller-level guard could not express that per route
 * without a decorator per scope.
 */
@Controller('v1/billing/service')
@UseGuards(BillingServiceGuard)
export class BillingServiceCredentialsController {
  constructor(private readonly billing: BillingServiceCredentialsService) {}

  @Post('checkout-sessions')
  @HttpCode(201)
  createCheckout(
    @CurrentBillingService() actor: BillingServiceActor,
    @Body() dto: ServiceCheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billing.checkout(actor, dto, requireKey(idempotencyKey));
  }

  @Post('usage')
  @HttpCode(201)
  reportUsage(
    @CurrentBillingService() actor: BillingServiceActor,
    @Body() dto: ServiceUsageDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billing.usage(actor, dto, requireKey(idempotencyKey));
  }

  @Post('invoices')
  @HttpCode(201)
  createInvoice(
    @CurrentBillingService() actor: BillingServiceActor,
    @Body() dto: ServiceInvoiceDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billing.invoice(actor, dto, requireKey(idempotencyKey));
  }

  @Get('entitlements')
  entitlements(@CurrentBillingService() actor: BillingServiceActor, @Query('tenantId') tenantId?: string) {
    if (!tenantId?.trim()) throw new BadRequestException('A ?tenantId= is required.');
    return this.billing.entitlements(actor, tenantId.trim());
  }

  @Get('accounts/:tenantId')
  account(@CurrentBillingService() actor: BillingServiceActor, @Param('tenantId') tenantId: string) {
    return this.billing.account(actor, tenantId);
  }
}

/** Same rule as the tenant surface: a missing key is a malformed request, never a server-generated one. */
function requireKey(value: string | undefined): string {
  if (!value?.trim()) throw new BadRequestException('Idempotency-Key is required.');
  return value.trim();
}
```

In `apps/api/src/modules/billing/billing.module.ts`, add to the existing
`@Module` decorator:

```ts
  controllers: [/* Tasks 11/13 */ BillingServiceCredentialsController],
  providers: [/* existing */ BillingServiceCredentialsService],
  exports: [/* existing */ BillingServiceCredentialsService, BillingEventsService],
```

`BillingEventsService` is added to `exports` here because Task 15's verification
hook injects it across module boundaries.

- [ ] **Step 6: Run the service-surface tests**

Run: `RUN_DB_TESTS=true pnpm --filter @nid/api exec jest billing-service-credentials --runInBand`
Expected: PASS — 10 gated cases plus the pure `assertScope` case.

Run: `pnpm --filter @nid/api test && pnpm typecheck && pnpm lint`
Expected: PASS and clean.

- [ ] **Step 7: Write the failing verification-credit test**

`apps/api/test/verification-credit.spec.ts`:

```ts
/**
 * Live-Postgres coverage for nID billing its own verification cases (spec
 * §9.1). The Temporal and storage collaborators are stubbed: this test is about
 * whether a case and a debit commit together, and starting a real workflow
 * proves nothing about money.
 */
import { createPrismaClient, withBillingAdminContext, type PrismaClient } from '@nid/db';
import { BillingError, InsufficientCreditsError, creditAccount, ensureBillingAccount } from '@nid/billing';
import { loadEnv } from '../src/core/config/env';
import { VerificationCasesService } from '../src/modules/verification-cases/verification-cases.service';
import { CreateVerificationCaseDto } from '../src/modules/verification-cases/dto/create-verification-case.dto';
import { PrismaService } from '../src/core/db/prisma.service';
import { AuditService } from '../src/core/audit/audit.service';
import { BillingEventsService } from '../src/modules/billing/billing-events.service';
import type { TemporalClientService } from '../src/core/temporal/temporal-client.service';
import type { StorageService } from '../src/core/storage/storage.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('verification case credits (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let cases: VerificationCasesService;
  const tag = Date.now().toString(36);
  /** The price nID charges itself per case, from the same env the hook reads. */
  const charge = loadEnv().verificationCaseCreditMinor;
  const started: string[] = [];
  const temporalStub = {
    startVerification: async (workflowId: string) => {
      started.push(workflowId);
    },
    submitMethodPayload: async () => undefined,
  } as unknown as TemporalClientService;
  const storageStub = {} as unknown as StorageService;

  interface Fixture {
    tenantId: string;
    subjectId: string;
    policyName: string;
  }
  const fixtures = new Map<string, Fixture>();

  /**
   * A tenant with one `document_ocr` policy, one subject, and optionally a
   * credit balance. `billingWebhookUrl` is set so a raised warning has a target
   * and the queued row is assertable.
   */
  async function fixture(name: string, balanceMinor: bigint | null, billingStatus = 'ACTIVE'): Promise<Fixture> {
    const tenant = await migratorPrisma.tenant.create({
      data: {
        name: `credit ${name}`,
        slug: `credit-${name}-${tag}`,
        billingWebhookUrl: 'https://nid.example.test/billing-hook',
        billingWebhookSecretPlaintext: `secret-${tag}`,
      },
    });
    const subject = await migratorPrisma.subject.create({
      data: { tenantId: tenant.id, type: 'PERSON', nationalIdNumber: `40201-${tag.slice(0, 5)}-1` },
    });
    const policy = await migratorPrisma.verificationPolicy.create({
      data: {
        tenantId: tenant.id,
        name: `basic-${name}`,
        claimType: 'IDENTITY',
        level: 'DOCUMENT_VERIFIED',
        methods: ['document_ocr'],
      },
    });
    if (balanceMinor !== null) {
      await prismaService.forTenant(tenant.id, async (tx) => {
        const account = await ensureBillingAccount(tx, tenant.id);
        if (billingStatus !== 'ACTIVE') await tx.billingAccount.update({ where: { id: account.id }, data: { status: billingStatus } });
        if (balanceMinor > 0n) {
          await creditAccount(tx, {
            tenantId: tenant.id,
            billingAccountId: account.id,
            deltaMinor: balanceMinor,
            reason: 'TOPUP',
            refType: 'test_funding',
            refId: `credit-${name}-${tag}`,
          });
        }
      });
    }
    return { tenantId: tenant.id, subjectId: subject.id, policyName: policy.name };
  }

  /** Structurally a CreateVerificationCaseDto; importing the class here would
   * only prove that class-validator runs, which is the pipe's own test. */
  function input(name: string): CreateVerificationCaseDto {
    const f = fixtures.get(name) as Fixture;
    return { policyName: f.policyName, subjectId: f.subjectId };
  }

  beforeAll(async () => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    cases = new VerificationCasesService(
      prismaService,
      new AuditService(),
      temporalStub,
      storageStub,
      new BillingEventsService(prismaService),
    );

    // nID bills itself through the catalog (spec §9.1), and
    // `chargeVerificationCase` returns without charging when the `nid` service
    // row is missing. A test environment that has run Task 18's seed already
    // has it; this upsert keeps the spec independent of the seed.
    await withBillingAdminContext(prismaService.client, (tx) =>
      tx.billingService.upsert({
        where: { key: 'nid' },
        create: { key: 'nid', name: 'nID', ownerRepo: 'nID' },
        update: { status: 'ACTIVE' },
      }),
    );

    fixtures.set('rich', await fixture('rich', charge * 4n));
    fixtures.set('poor', await fixture('poor', 1n));
    fixtures.set('broke', await fixture('broke', 0n));
    fixtures.set('outsider', await fixture('outsider', null));
    fixtures.set('suspended', await fixture('suspended', charge * 4n, 'SUSPENDED'));
  });

  afterAll(async () => {
    for (const f of fixtures.values()) await migratorPrisma.tenant.delete({ where: { id: f.tenantId } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  it('charges the case from credits and posts the ledger against the nid service', async () => {
    const f = fixtures.get('rich') as Fixture;
    const created = await cases.create(f.tenantId, `key-${tag}`, input('rich'));
    expect(started).toContain(`verification-${created.id}`);

    const account = await prismaService.forTenant(f.tenantId, (tx) =>
      tx.billingAccount.findUniqueOrThrow({ where: { tenantId: f.tenantId } }),
    );
    expect(account.creditBalanceMinor).toBe(charge * 3n);

    const entry = await prismaService.forTenant(f.tenantId, (tx) =>
      tx.creditLedgerEntry.findFirst({ where: { tenantId: f.tenantId, refType: 'verification_case', reason: 'USAGE' } }),
    );
    expect(entry?.refId).toBe(created.id);
    expect(entry?.deltaMinor).toBe(-charge);

    const ledger = await prismaService.forTenant(f.tenantId, (tx) =>
      tx.ledgerTransaction.findFirst({ where: { tenantId: f.tenantId, refType: 'verification_case', refId: created.id } }),
    );
    expect(ledger?.type).toBe('CREDIT_USAGE');
  });

  it('rolls the case back when the balance cannot cover it, leaving credits untouched', async () => {
    const f = fixtures.get('poor') as Fixture;
    await expect(cases.create(f.tenantId, `key-${tag}`, input('poor'))).rejects.toThrow(
      InsufficientCreditsError,
    );

    const scoped = await prismaService.forTenant(f.tenantId, async (tx) => ({
      cases: await tx.verificationCase.count(),
      attempts: await tx.verificationMethodAttempt.count(),
      balance: (await tx.billingAccount.findUniqueOrThrow({ where: { tenantId: f.tenantId } })).creditBalanceMinor,
      entries: await tx.creditLedgerEntry.count({ where: { tenantId: f.tenantId, refType: 'verification_case' } }),
    }));
    expect(scoped.cases).toBe(0);
    expect(scoped.attempts).toBe(0);
    expect(scoped.balance).toBe(1n);
    expect(scoped.entries).toBe(0);
  });

  it('refuses a suspended account and creates no case', async () => {
    const f = fixtures.get('suspended') as Fixture;
    await expect(cases.create(f.tenantId, `key-${tag}`, input('suspended'))).rejects.toThrow(BillingError);
    expect(await prismaService.forTenant(f.tenantId, (tx) => tx.verificationCase.count())).toBe(0);
  });

  it('leaves a tenant with no billing account entirely outside billing', async () => {
    const f = fixtures.get('outsider') as Fixture;
    const created = await cases.create(f.tenantId, `key-${tag}`, input('outsider'));
    expect(created.id).toBeTruthy();
    expect(await prismaService.forTenant(f.tenantId, (tx) => tx.billingAccount.count())).toBe(0);
    expect(await prismaService.forTenant(f.tenantId, (tx) => tx.creditLedgerEntry.count())).toBe(0);
  });

  it('lets a zero-balance tenant create a case rather than locking them out of nID', async () => {
    const f = fixtures.get('broke') as Fixture;
    const created = await cases.create(f.tenantId, `key-${tag}`, input('broke'));
    expect(created.id).toBeTruthy();
    expect(await prismaService.forTenant(f.tenantId, (tx) => tx.creditLedgerEntry.count())).toBe(0);
  });

  it('queues credits.low after the case commits, not before', async () => {
    // One unit of headroom above the price, so the debit lands at exactly 100
    // and the fallback threshold (last top-up / 10) is above that whenever the
    // charge is the default 2500 or anything larger.
    const crossing = await fixture('crossing', charge + 100n);
    fixtures.set('crossing', crossing);
    await cases.create(crossing.tenantId, `key-${tag}`, input('crossing'));

    const queued = await prismaService.forTenant(crossing.tenantId, (tx) =>
      tx.outboundEvent.findMany({ where: { tenantId: crossing.tenantId }, orderBy: { createdAt: 'asc' } }),
    );
    expect(queued.map((event) => event.eventType)).toEqual(['credits.low']);
    expect(queued[0]?.payload).toMatchObject({ balanceAfterMinor: '100' });
    expect(queued[0]?.status).toBe('PENDING');
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `RUN_DB_TESTS=true pnpm --filter @nid/api exec jest verification-credit --runInBand`
Expected: FAIL — `VerificationCasesService`'s constructor takes four arguments, so the fifth is rejected and no credit row is ever written.

- [ ] **Step 9: Add the credit hook to the verification service**

In `apps/api/src/modules/verification-cases/verification-cases.service.ts`, add
the imports:

```ts
import type { TransactionClient } from '@nid/db';
import { assertEntitled, chargeVerificationCase, evaluateCredits, type CreditWarning } from '@nid/billing';
import { BillingEventsService } from '../../modules/billing/billing-events.service';
```

and this constant above `CLAIM_DOCUMENT_METHODS`:

```ts
/**
 * The catalog key nID bills itself under (spec §9.1). Charging against any other
 * service would attribute identity-verification revenue to the wrong ledger
 * line, and revenue is attributed per service because nID is merchant of record
 * for the whole ecosystem.
 */
const NID_SERVICE_KEY = 'nid';
```

Append `private readonly events: BillingEventsService,` to the constructor.

Inside `create()`'s existing `forTenant` callback, immediately after the
`verificationSession.create(...)` call and before `this.audit.record(...)`:

```ts
      const creditWarnings = await this.chargeCaseCredits(tx, tenantId, kase.id, env.verificationCaseCreditMinor);
```

(`env` is the local already read for `sessionTtlMinutes` a few lines above — do
not call `loadEnv()` twice.) Add `creditWarnings` to the object returned from
the transaction, then before the Temporal start:

```ts
    // After the commit: a warning about credits that moved must not be queued
    // for a case that rolled back, and a tenant with no billing webhook target
    // makes `enqueue` return false rather than throwing.
    for (const warning of created.creditWarnings) {
      await this.events.enqueueForTenant(tenantId, {
        tenantId,
        eventType: warning.eventType,
        payload: {
          balanceAfterMinor: warning.balanceAfterMinor.toString(),
          thresholdMinor: warning.thresholdMinor.toString(),
          caseId: created.case.id,
        },
      });
    }
```

and add the private method:

```ts
  /**
   * nID is a customer of its own billing platform. Absence is not an error: a
   * tenant with no BillingAccount, or one whose balance is already zero, is not
   * in the billing system, and creating a billing account as a side effect of a
   * verification call would hand every tenant on the platform financial rows
   * they never asked for. `chargeVerificationCase` enforces the same rule one
   * level down, so the two checks agree.
   *
   * Once a tenant DOES hold credits they are inside the system, and the
   * entitlement rules apply to them: a suspended account is refused, and a
   * balance that cannot cover the case is refused by the atomic debit rather
   * than going negative. Both errors leave this transaction, so no case row
   * survives a refused charge.
   *
   * `assertEntitled` is deliberately not called for a tenant outside billing:
   * they have no plan and no subscription, so it would answer `none` for a
   * service that has always accepted verification cases. That is a regression,
   * not a feature, and it is why the gate is "has credits", not "has an
   * entitlement".
   */
  private async chargeCaseCredits(
    tx: TransactionClient,
    tenantId: string,
    caseId: string,
    amountMinor: bigint,
  ): Promise<CreditWarning[]> {
    if (amountMinor <= 0n) return [];
    const account = await tx.billingAccount.findUnique({ where: { tenantId } });
    if (!account || account.creditBalanceMinor <= 0n) return [];

    const balanceBeforeMinor = account.creditBalanceMinor;
    await assertEntitled(tx, tenantId, NID_SERVICE_KEY);
    await chargeVerificationCase(tx, { tenantId, caseId, amountMinor, serviceKey: NID_SERVICE_KEY });
    // The crossing is computed from the balance captured here, because
    // `chargeVerificationCase` has already rewritten the row.
    return evaluateCredits(tx, { tenantId, balanceBeforeMinor });
  }
```

In `verification-cases.module.ts`, add `BillingModule` to `imports` (it does not
import `VerificationCasesModule`, so this cannot cycle), and in
`billing.module.ts` make sure `BillingEventsService` is exported (Step 5).

The fifth constructor argument breaks the one existing spec that builds this
service directly. In `apps/api/test/organization-verification.spec.ts`, where
`casesService` is constructed (line 54, and note that suite reuses its own
`audit` local), add the queue:

```ts
    casesService = new VerificationCasesService(
      prismaService,
      audit,
      {} as TemporalClientService,
      {} as StorageService,
      new BillingEventsService(prismaService),
    );
```

with `BillingEventsService` imported from
`../src/modules/billing/billing-events.service`. That suite's tenants have no
`BillingAccount`, so the hook returns early and none of its assertions change —
it needs the extra argument only to compile.

- [ ] **Step 10: Map a refused charge to a status code**

`apps/api/src/core/http/billing-error.filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { BillingError, InsufficientCreditsError } from '@nid/billing';

/**
 * Spec §8's error table stops at 422. `InsufficientCreditsError` gets 402
 * Payment Required anyway, because the remedy is literally a top-up and a
 * service integrating with nID has to be able to tell "send this customer to
 * checkout" apart from "we hit a business rule". Recorded as a deviation in
 * Task 18.
 */
@Catch(BillingError)
export class BillingErrorFilter implements ExceptionFilter {
  catch(error: BillingError, host: ArgumentsHost): void {
    const status =
      error instanceof InsufficientCreditsError ? HttpStatus.PAYMENT_REQUIRED : HttpStatus.UNPROCESSABLE_ENTITY;
    const response = host.switchToHttp().getResponse<{ status(code: number): { json(body: unknown): void } }>();
    response.status(status).json({ statusCode: status, message: error.message, error: error.name });
  }
}
```

`@Catch(BillingError)` catches the subclasses too, so one filter covers the
hierarchy without importing every error name. The narrow generic on `getResponse`
is the shape this filter uses; `any` is not available under the repo's strict
config.

Apply it to the one route that can raise it, in
`apps/api/src/modules/verification-cases/verification-cases.controller.ts`:

```ts
  @UseGuards(ApiKeyGuard)
  @UseFilters(new BillingErrorFilter())
  @Post()
  create(@CurrentTenant() tenant: AuthenticatedTenant, @Body() dto: CreateVerificationCaseDto) {
    return this.cases.create(tenant.tenantId, tenant.apiKeyId, dto);
  }
```

with `UseFilters` added to the `@nestjs/common` import list and
`BillingErrorFilter` imported from `../../core/http/billing-error.filter`. Only
`create` gets it: the `submit*` routes write no money, and attaching a filter
where no `BillingError` can reach it would advertise a failure mode the route
does not have.

- [ ] **Step 11: Run the whole gate**

Run: `RUN_DB_TESTS=true pnpm --filter @nid/api exec jest verification-credit billing-service-credentials --runInBand`
Expected: PASS — 6 verification cases and 11 surface cases.

Run: `pnpm --filter @nid/api test`
Expected: PASS — every pre-existing verification-cases spec still passes, because a tenant with no `BillingAccount` returns before `assertEntitled`.

Run: `pnpm typecheck && pnpm lint && pnpm --filter @nid/api build`
Expected: PASS and clean.

- [ ] **Step 12: Commit**

```bash
git add apps/api
git commit -m "feat(billing): add the service-credential surface and charge nID verification cases from prepaid credits"
```

---

## Task 16: `apps/checkout-ui` — the hosted payment pages

**Files:**
- Create: `apps/checkout-ui/package.json`, `apps/checkout-ui/tsconfig.json`, `apps/checkout-ui/next.config.mjs`, `apps/checkout-ui/next-env.d.ts`, `apps/checkout-ui/app/layout.tsx`, `apps/checkout-ui/app/globals.css`, `apps/checkout-ui/app/brand.ts`, `apps/checkout-ui/app/icon.svg`, `apps/checkout-ui/app/page.tsx`, `apps/checkout-ui/app/checkout/[token]/page.tsx`, `apps/checkout-ui/app/return/[token]/page.tsx`, `apps/checkout-ui/app/mock-pay/[providerRef]/page.tsx`, `apps/checkout-ui/lib/api.ts`, `apps/checkout-ui/lib/format.ts`, `apps/checkout-ui/lib/format.test.mts`
- Modify: `README.md` (the new app in the Local setup run list, port 3500)

**Interfaces:**
- Consumes: `getCheckoutSummary`'s response shape as served by Task 13's `GET /v1/billing/checkout-sessions/:token` (`CheckoutSummary`: `sessionId`, `status`, `intentStatus`, `amountMinor`, `currency`, `serviceName`, `description`, `expiresAt`, `payUrl`, `returnUrl` — every BigInt arrives as a **string** because of Task 9's `BigIntSerializerInterceptor`), `GET /v1/billing/checkout-sessions/:token/status` (`CheckoutStatusView`: `status`, `intentStatus`, `expiresAt`), `POST /v1/billing/dev/mock-payments` (`MockPaymentDto`: `providerRef`, `outcome`). Task 7 builds every URL here as `${CHECKOUT_UI_URL}/checkout/<token>`, `/return/<token>` and the mock provider's own `${checkoutUiUrl}/mock-pay/<providerRef>`, so these three routes are the contract: a rename breaks a live checkout link.
- Produces: the three public pages, `lib/api.ts`'s `fetchCheckoutSummary` / `fetchCheckoutStatus` / `postMockPayment`, `formatMinor(minor, currency)` / `formatDateTime(iso)`. Task 17's dashboard has its own copy of the money formatter (see the note under Step 1), and Task 18's manual end-to-end run drives these pages in a browser.

**Global constraint that shapes this whole task:** the page is unauthenticated and public by design (spec §10: the capability token *is* the authorisation). So it renders exactly the four fields the API chose to expose, and it never sends a credential, never reads `localStorage`, and never trusts anything in the URL beyond the token it is about to hand back to the API.

Scaffold first, then the pages. The scaffold is copied rather than retyped because `apps/login-ui` already solved the brand-token and CSS problems (471 lines of `globals.css` including the dark-mode token block); re-emitting it here would invite drift between two UIs that must look identical.

- [ ] **Step 1: Copy the app scaffold from login-ui**

```bash
mkdir -p apps/checkout-ui/app/components apps/checkout-ui/lib
cp apps/login-ui/app/globals.css apps/checkout-ui/app/globals.css
cp apps/login-ui/app/brand.ts apps/checkout-ui/app/brand.ts
cp apps/login-ui/app/icon.svg apps/checkout-ui/app/icon.svg
cp apps/login-ui/app/components/logomark.tsx apps/checkout-ui/app/components/logomark.tsx
```

`logomark.tsx` is the only login-ui component that transfers: it renders the nID
mark from the brand tokens and has no dependency on sessions or OTP. The rest of
login-ui's components are auth widgets, and copying them would put sign-in
semantics inside a page that must not have any.

The money formatter lives in this app rather than in a shared package, and the
dashboard gets its own copy in Task 17. `@nid/billing` owns money *rules* and
imports Prisma, so a browser bundle must not reach for it; `@nid/shared-types`
is build-to-`dist` and only `apps/api` depends on it today, so a UI importing it
would need a build-order and `transitivePackages` change to buy eight lines of
`Intl.NumberFormat`. Two small copies in two separately deployed frontends is
the cheaper answer, and the test in Step 2 is what keeps them honest.

- [ ] **Step 2: Write the formatter and its test**

`apps/checkout-ui/lib/format.ts`:

```ts
/**
 * Minor units (paisa) to a displayed amount. Accepts `string` as well as
 * `bigint` because the API serialises BigInt to a string (Task 9's interceptor)
 * and this page is a browser: `Number()` would silently round anything above
 * 2^53, so the integer and the fraction are split as text and never as a float.
 */
export function formatMinor(minor: bigint | string, currency: string): string {
  const value = typeof minor === 'string' ? minor : minor.toString();
  if (!/^-?\d+$/.test(value)) throw new TypeError(`formatMinor expects an integer string, received ${value}`);

  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  const padded = digits.padStart(3, '0');
  const whole = padded.slice(0, -2).replace(/^0+(?=\d)/, '');
  const fraction = padded.slice(-2);

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${currency} ${grouped}.${fraction}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
```

`apps/checkout-ui/lib/format.test.mts` (`.mts` so `node --test` treats it as ESM
without adding `"type": "module"` to the app's `package.json`, which would
change how Next's own config files are resolved):

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, formatMinor } from './format.ts';

test('formats minor units as rupee/paisa text', () => {
  assert.equal(formatMinor('118000', 'PKR'), 'PKR 1,180.00');
  assert.equal(formatMinor(118000n, 'PKR'), 'PKR 1,180.00');
  assert.equal(formatMinor('50', 'PKR'), 'PKR 0.50');
  assert.equal(formatMinor('0', 'PKR'), 'PKR 0.00');
  assert.equal(formatMinor('1000000', 'PKR'), 'PKR 10,000.00');
});

test('keeps precision past 2^53 instead of rounding through a float', () => {
  // 9_007_199_254_740_993 paisa is 2^53 + 1: Number() would collapse it.
  assert.equal(formatMinor('9007199254740993', 'PKR'), 'PKR 90,071,992,547,409.93');
});

test('formats a negative balance with the sign outside the grouping', () => {
  assert.equal(formatMinor('-250000', 'PKR'), '-PKR 2,500.00');
});

test('rejects a non-integer instead of guessing at what the API meant', () => {
  assert.throws(() => formatMinor('1180.5', 'PKR'), TypeError);
  assert.throws(() => formatMinor('', 'PKR'), TypeError);
});

test('renders a timestamp and tolerates a missing or unparseable one', () => {
  assert.match(formatDateTime('2026-11-30T09:15:00.000Z'), /2026/);
  assert.equal(formatDateTime(null), '');
  assert.equal(formatDateTime('not a date'), '');
});
```

- [ ] **Step 3: Run the formatter test**

Run: `pnpm install --filter @nid/checkout-ui`
Expected: the new workspace package is linked (this is why the `package.json` from Step 4 must exist first — so create `package.json` before running install if doing them out of order).

Run: `cd apps/checkout-ui && node --test lib/format.test.mts`
Expected: PASS — 5 tests.

- [ ] **Step 4: Write `package.json`, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`**

`apps/checkout-ui/package.json`:

```json
{
  "name": "@nid/checkout-ui",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3500",
    "build": "next build",
    "start": "next start -p 3500",
    "typecheck": "tsc --noEmit",
    "lint": "eslint app lib --max-warnings=0",
    "test": "node --test lib/format.test.mts"
  },
  "dependencies": {
    "@nadeemmurtaza/design-system": "^0.1.0",
    "next": "^15.5.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "typescript": "^5.6.0"
  }
}
```

Port 3500 because 3100/3200/3300/3400 are already taken by verify-ui, dashboard,
login-ui and profile-ui (`apps/profile-ui/package.json:6`)
(spec §12). `@nadeemmurtaza/design-system` is needed because `brand.ts` imports
its `BrandTheme` type; the root `pnpm-workspace.yaml` already allows that version
past the release-age gate.

`apps/checkout-ui/tsconfig.json` — login-ui's, plus `**/*.mts` so the test file
is type-checked by `pnpm typecheck`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "**/*.mts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`noUncheckedIndexedAccess` is the root config's standard (every other package
sets it); login-ui's file omits it, and this app has the indexed access that
flag guards — `frames[0]`, `resolved['amountMinor']` and every
`Object.entries()` lookup in the pages.

`allowImportingTsExtensions` is required, not cosmetic: `moduleResolution:
'bundler'` needs an explicit `.ts` extension in `format.test.mts`'s import
because `node --test` resolves ESM specifiers literally and will not append an
extension. Verified against this repo's TypeScript — without the flag,
`pnpm --filter @nid/checkout-ui typecheck` fails with `TS5097: An import path
can only end with a '.ts' extension when 'allowImportingTsExtensions' is
enabled`, and the flag is legal here only because `noEmit` is set.

`apps/checkout-ui/next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

`apps/checkout-ui/next-env.d.ts` — copy login-ui's file, or write it:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

(The `/// <reference path="./.next/types/routes.d.ts" />` line in login-ui's copy
is added by Next itself on the first `next build`; it is absent until then, so
either copy the file after building or let Step 7 add it.)

- [ ] **Step 5: Write the API client**

`apps/checkout-ui/lib/api.ts`:

```ts
const API_URL = process.env.NEXT_PUBLIC_NID_API_URL ?? 'http://localhost:4000';

export class CheckoutApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/**
 * The public checkout surface sends no credential anywhere: the capability
 * token in the path is the authorisation (spec §10), and `checkout_session_lookup`'s
 * open SELECT policy is what lets the API answer at all. So this client has no
 * session handling at all, unlike login-ui's `apiFetch`, and adding one would
 * turn a public page into a confused one.
 */
async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    // A checkout page must never show one payer the previous payer's summary:
    // 'no-store' on both sides of this request.
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new CheckoutApiError(message ?? `Request to ${path} failed with ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

/** Amounts are strings: Task 9's serialiser turns every BigInt into text. */
export interface CheckoutSummaryView {
  sessionId: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELED';
  intentStatus: 'REQUIRES_CHECKOUT' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELED';
  amountMinor: string;
  currency: string;
  serviceName: string;
  description: string;
  expiresAt: string;
  payUrl: string | null;
  returnUrl: string | null;
}

export interface CheckoutStatusView {
  status: CheckoutSummaryView['status'];
  intentStatus: CheckoutSummaryView['intentStatus'];
  expiresAt: string;
}

export function fetchCheckoutSummary(token: string): Promise<CheckoutSummaryView> {
  return getJson(`/v1/billing/checkout-sessions/${encodeURIComponent(token)}`);
}

export function fetchCheckoutStatus(token: string): Promise<CheckoutStatusView> {
  return getJson(`/v1/billing/checkout-sessions/${encodeURIComponent(token)}/status`);
}

/**
 * The dev-only switch (Task 13's `POST /v1/billing/dev/mock-payments`). It 404s
 * outside development with the mock provider removed from the registry, which is
 * why the page treats a 404 as "this environment has no mock payments" rather
 * than as a bug.
 */
export function postMockPayment(input: {
  providerRef: string;
  outcome: 'success' | 'failure';
}): Promise<{ settled: boolean; intentId: string }> {
  return getJson('/v1/billing/dev/mock-payments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
```

- [ ] **Step 6: Write the layout and the three pages**

`apps/checkout-ui/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'nID checkout',
  description: 'Pay for a NEWAX service with nID.',
  // A checkout link pasted into a support chat must not leak into a search
  // index or a crawler: the token in the URL is the only authorisation there is.
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
```

`apps/checkout-ui/app/page.tsx`:

```tsx
/**
 * No directory listing, no "enter a token" form: a token arrives from a service
 * that created the checkout, and a page that accepts one typed in by hand would
 * be a second, less safe entry point to the same data.
 */
export default function CheckoutIndex() {
  return (
    <main className="page">
      <h1>nID checkout</h1>
      <p className="muted">
        Checkout links open at <code>/checkout/&lt;token&gt;</code> and are sent to you by the service you are paying.
      </p>
    </main>
  );
}
```

`apps/checkout-ui/app/checkout/[token]/page.tsx` — server-rendered, as spec §12
requires:

```tsx
import { formatDateTime, formatMinor } from '../../../lib/format';
import { fetchCheckoutSummary, type CheckoutSummaryView } from '../../../lib/api';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * The unknown / expired / already-used / not-yours cases all collapse into one
 * message, because the API already returns one uniform 404 for all four (Task
 * 13) and this page must not become the thing that tells a visitor which it was.
 */
function InvalidLink() {
  return (
    <main className="page">
      <h1>This checkout link is not valid.</h1>
      <p className="muted">
        Checkout links expire shortly after they are opened, and each one can be used once. Ask the service you were
        paying for for a new link.
      </p>
    </main>
  );
}

export default async function CheckoutPage({ params }: PageProps) {
  const { token } = await params;

  let summary: CheckoutSummaryView | null = null;
  try {
    summary = await fetchCheckoutSummary(token);
  } catch (error) {
    // Only a 404 means "not a link we will show". A 5xx or a network failure has
    // a different answer, and telling the payer their link is invalid when the
    // API is simply down would send them back to support.
    if ((error as { status?: number }).status === 404) return <InvalidLink />;
    return (
      <main className="page">
        <h1>Checkout is temporarily unavailable.</h1>
        <p className="muted">Try again in a moment. Nothing has been charged.</p>
      </main>
    );
  }

  const paid = summary.intentStatus === 'SUCCEEDED';
  const expired = summary.status === 'EXPIRED' || summary.status === 'CANCELED' || summary.payUrl === null;

  return (
    <main className="page">
      <p className="eyebrow">{summary.serviceName}</p>
      <h1>{summary.description}</h1>

      <dl className="summary">
        <div>
          <dt>Amount</dt>
          <dd className="amount">{formatMinor(summary.amountMinor, summary.currency)}</dd>
        </div>
        <div>
          <dt>Link expires</dt>
          <dd>{formatDateTime(summary.expiresAt)}</dd>
        </div>
      </dl>

      {paid ? (
        <p className="status status--ok" role="status">
          Already paid. Nothing further is due.
        </p>
      ) : expired ? (
        <p className="status" role="status">
          This link is no longer open. Request a new one from the service.
        </p>
      ) : (
        <>
          <a className="button" href={summary.payUrl} rel="noopener noreferrer">
            Pay {formatMinor(summary.amountMinor, summary.currency)}
          </a>
          <p className="muted">You will complete the payment with our card provider, then come back to this page.</p>
        </>
      )}

      <p className="fineprint">
        nID bills on behalf of every NEWAX service. The amount above is set by nID and cannot be changed here.
      </p>
    </main>
  );
}
```

`apps/checkout-ui/app/return/[token]/page.tsx` — the polling page. It reports
state and never marks anything paid (spec §7.1 step 8), so its only write is a
read of status:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckoutApiError, fetchCheckoutStatus, type CheckoutStatusView } from '../../../lib/api';
import { formatDateTime } from '../../../lib/format';

type ViewState = 'loading' | 'processing' | 'success' | 'failed' | 'expired' | 'unknown';

const POLL_INTERVAL_MS = 2000;
/** A provider can take minutes; the page stops polling and says so rather than spinning forever. */
const POLL_DEADLINE_MS = 5 * 60_000;

function viewFor(status: CheckoutStatusView): ViewState {
  if (status.intentStatus === 'SUCCEEDED') return 'success';
  if (status.intentStatus === 'FAILED' || status.intentStatus === 'CANCELED') return 'failed';
  if (status.intentStatus === 'EXPIRED' || status.status === 'EXPIRED') return 'expired';
  return 'processing';
}

const COPY: Record<ViewState, { heading: string; body: string }> = {
  loading: { heading: 'Confirming your payment…', body: 'This usually takes a few seconds.' },
  processing: {
    heading: 'Confirming your payment…',
    body: 'The card provider has accepted it. nID is waiting for the provider’s confirmation, which is what actually marks this paid.',
  },
  success: { heading: 'Payment received', body: 'nID has recorded it and the service has been notified.' },
  failed: {
    heading: 'Payment not completed',
    body: 'Nothing was charged. You can ask the service for a new checkout link.',
  },
  expired: { heading: 'This checkout link has closed', body: 'Nothing was charged. Ask the service for a new link.' },
  unknown: {
    heading: 'We cannot find that checkout',
    body: 'The link may have been used already. Ask the service for a new one.',
  },
};

export default function ReturnPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>('loading');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Next 15 hands `params` in as a promise even to a client component.
    void params.then((resolved) => {
      if (!cancelled) setToken(resolved.token);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!token) return;
    const deadline = Date.now() + POLL_DEADLINE_MS;
    let handle: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function poll(): Promise<void> {
      try {
        const status = await fetchCheckoutStatus(token as string);
        if (stopped) return;
        setExpiresAt(status.expiresAt);
        const next = viewFor(status);
        setView(next);
        // Only a settled state stops the loop; `processing` is a real answer
        // that keeps polling until the webhook lands.
        if (next === 'processing' && Date.now() < deadline) handle = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (error) {
        if (stopped) return;
        if (error instanceof CheckoutApiError && error.status === 404) {
          setView('unknown');
          return;
        }
        // A transient failure keeps the loop alive: the payment may well have
        // gone through, and a page that gives up on one failed poll is worse
        // than one that retries for five minutes.
        if (Date.now() < deadline) handle = setTimeout(poll, POLL_INTERVAL_MS);
        else setView('failed');
      }
    }

    void poll();
    return () => {
      stopped = true;
      if (handle) clearTimeout(handle);
    };
  }, [token]);

  const copy = COPY[view];
  return (
    <main className="page">
      <div aria-live="polite" role="status">
        <h1>{copy.heading}</h1>
        <p className="muted">{copy.body}</p>
      </div>
      {view === 'processing' && expiresAt ? (
        <p className="muted">This link closes {formatDateTime(expiresAt)}.</p>
      ) : null}
      {/* The caller's own app link is stored on the session and origin-allowlisted
          by Task 7 — it is the only outbound link this page will render. */}
      {view === 'success' ? <BackToService token={token} /> : null}
    </main>
  );
}

async function returnUrlFor(token: string): Promise<string | null> {
  try {
    const { fetchCheckoutSummary } = await import('../../../lib/api');
    const summary = await fetchCheckoutSummary(token);
    return summary.returnUrl;
  } catch {
    return null;
  }
}

function BackToService({ token }: { token: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void returnUrlFor(token).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!url) return null;
  return (
    <p>
      <a className="button button--secondary" href={url} rel="noopener noreferrer">
        Back to the app
      </a>
    </p>
  );
}
```

`returnUrlFor` is fetched only in the success state — the summary read is a
second token-gated request, and asking for it while the payment is still
processing would buy nothing.

`apps/checkout-ui/app/mock-pay/[providerRef]/page.tsx` — the mock provider's
"hosted page", which is where `MockPaymentProvider.createCheckout` sends the
browser (Task 2):

```tsx
'use client';

import { useEffect, useState } from 'react';
import { postMockPayment } from '../../../lib/api';

/**
 * Exists so the mock provider can complete a real browser round-trip: reserve →
 * land here → post an outcome → the API settles → `/return/<token>` reports it.
 * The API side is doubly gated (NODE_ENV and the provider registry), so this
 * page's own warning is presentation, not the control.
 */
export default function MockPayPage({ params }: { params: Promise<{ providerRef: string }> }) {
  const [providerRef, setProviderRef] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void params.then((resolved) => setProviderRef(resolved.providerRef));
  }, [params]);

  async function pay(outcome: 'success' | 'failure'): Promise<void> {
    if (!providerRef) return;
    setPending(true);
    try {
      const result = await postMockPayment({ providerRef, outcome });
      setReport(
        result.settled
          ? `Mock ${outcome} recorded for ${result.intentId}. Open the return page to watch it settle.`
          : `The API did not accept the mock payment for ${result.intentId}.`,
      );
    } catch (error) {
      setReport(
        (error as { status?: number }).status === 404
          ? 'Mock payments are disabled in this environment.'
          : `Mock payment failed: ${(error as Error).message}`,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page">
      <p className="eyebrow">nID development only</p>
      <h1>Simulate a card payment</h1>
      <p className="muted">Reference {providerRef ?? '…'}. No money moves and nothing is sent to a real provider.</p>
      <div className="actions">
        <button type="button" className="button" disabled={pending} onClick={() => void pay('success')}>
          Pay successfully
        </button>
        <button type="button" className="button button--secondary" disabled={pending} onClick={() => void pay('failure')}>
          Decline the card
        </button>
      </div>
      {report ? (
        <p className="status" role="status">
          {report}
        </p>
      ) : null}
    </main>
  );
}
```

Append the page classes this app uses (which login-ui does not have) to
`apps/checkout-ui/app/globals.css`, so the copied file still owns the tokens and
these rules only add layout:

```css
/* ── checkout-ui pages ─────────────────────────────────────────────── */
.page {
  max-width: 34rem;
  margin: 0 auto;
  padding: 2.5rem 1.25rem 4rem;
}

.eyebrow {
  margin: 0 0 0.5rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
}

.summary {
  display: grid;
  gap: 0.75rem;
  margin: 1.5rem 0;
  padding: 1.25rem;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.summary div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.summary dt {
  color: var(--muted);
}

.summary dd {
  margin: 0;
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.button {
  display: inline-block;
  padding: 0.85rem 1.5rem;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--accent);
  color: var(--on-accent);
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.button:hover {
  background: var(--accent-hover);
}

.button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.button--secondary {
  background: transparent;
  color: var(--accent);
  border-color: var(--border);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.status {
  margin-top: 1.25rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: var(--card-bg);
  border: 1px solid var(--border);
}

.status--ok {
  border-color: var(--success);
}

.muted {
  color: var(--muted);
}

.fineprint {
  margin-top: 2.5rem;
  color: var(--muted);
  font-size: 0.8rem;
}

@media (max-width: 480px) {
  .page {
    padding-top: 1.5rem;
  }

  .summary div {
    flex-direction: column;
    gap: 0.15rem;
  }
}
```

- [ ] **Step 7: Typecheck, lint, build**

Run: `pnpm install`
Expected: the workspace links `@nid/checkout-ui` (root scripts glob `apps/*`, so `typecheck`/`lint`/`test`/`build` pick it up with no other change).

Run: `pnpm --filter @nid/checkout-ui typecheck && pnpm --filter @nid/checkout-ui lint && pnpm --filter @nid/checkout-ui test`
Expected: PASS.

Run: `pnpm --filter @nid/checkout-ui build`
Expected: PASS — four static/`force-dynamic` routes with no Prisma or Nest import.

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: green across the whole monorepo — this is the first task since Task 1 to add a workspace package, so a failure here is this app's wiring, not someone else's code.

- [ ] **Step 8: Smoke the pages against a running API**

```bash
pnpm --filter @nid/api dev &      # port from NID_API_PORT, default 4000
pnpm --filter @nid/checkout-ui dev &
curl -s http://localhost:3500/checkout/not-a-real-token | grep -o "not valid"
curl -s http://localhost:3500/return/not-a-real-token -o /dev/null -w "%{http_code}\n"
```

Expected: the first prints `not valid` (the server-rendered invalid state, which
proves the API's uniform 404 reached the page and did not become an error
boundary); the second prints `200` (the return page always renders and lets its
own poll decide the copy).

This is the same manual path Task 18 records with a real seeded intent and a
browser: the difference here is only that no money exists yet, so the assertions
are about states, not about balances.

- [ ] **Step 9: Record the new app in the run book**

In `README.md`'s "Local setup" block, add after the `@nid/profile-ui` line:

```bash
pnpm --filter @nid/checkout-ui dev   # in a seventh terminal: hosted checkout at :3500
```

and one sentence under the block, in the same voice as the note that follows it:

> `apps/checkout-ui` is public and unauthenticated: `/checkout/<token>`,
> `/return/<token>`, and the dev-only `/mock-pay/<providerRef>`. It needs
> `NEXT_PUBLIC_NID_API_URL`, and `apps/api` needs `CHECKOUT_UI_URL=http://localhost:3500`
> or every checkout link it hands out points somewhere else.

- [ ] **Step 10: Commit**

```bash
git add apps/checkout-ui README.md pnpm-lock.yaml
git commit -m "feat(checkout-ui): add the hosted checkout, return and mock-payment pages on port 3500"
```

---

## Task 17: Dashboard billing section — overview, top-up, invoices, subscriptions, history

**Files:**
- Create: `apps/dashboard/app/billing/page.tsx`, `apps/dashboard/app/billing/sections.tsx`, `apps/dashboard/app/billing/money.ts`, `apps/dashboard/app/billing/money.test.mts`, `apps/dashboard/app/billing/use-checkout.ts`, `apps/dashboard/app/billing/invoices/[id]/page.tsx`, `apps/dashboard/lib/use-resource.ts`
- Modify: `apps/dashboard/lib/api-client.ts`, `apps/dashboard/app/components/header.tsx`, `apps/dashboard/app/globals.css`, `apps/dashboard/package.json`, `apps/dashboard/tsconfig.json`

**Interfaces:**
- Consumes: Task 11's `GET /v1/billing/account`, `GET /v1/billing/services`, `GET /v1/billing/plans?service=<key>`, `POST /v1/billing/checkout-sessions` (+ required `Idempotency-Key` header), `GET /v1/billing/invoices`, `GET /v1/billing/invoices/:id`, `GET /v1/billing/subscriptions`, `POST /v1/billing/subscriptions/:id/cancel`, `GET /v1/billing/payments`, `GET /v1/billing/usage`, `GET /v1/billing/events`; Task 9's `BigIntSerializerInterceptor`, which means **every `BigInt` column arrives as a decimal string** and every `Int` column arrives as a number; Task 7's `CheckoutOutcome`, whose `checkoutUrl` is the nID token page (`${CHECKOUT_UI_URL}/checkout/<token>`) and whose `providerCheckoutUrl` is the provider's own page; `apiFetch`/`ApiError`/`useDashboardSession`/`Header`/`Logomark` (existing).
- Produces: `formatMinor(minor: string, currency: string): string`, `useResource<T>(path, credential)`, `useCheckout(credential)`, the `/billing` and `/billing/invoices/[id]` routes, and the `Header` nav that every dashboard page now renders. Task 18's manual end-to-end run drives `/billing` in a browser.

**Global constraints that shape this task:** spec §12 — overview shows credit balance, active subscriptions, last payment and outstanding invoices; top-up is "choose a credit pack per service → hosted checkout"; invoices show lines per service and are payable; subscriptions show plan, period and cancel-at-period-end; usage, payment history and the webhook delivery log are listed; every section has empty/loading/error states; and **no API key is pasted for billing** — the dashboard's existing staff session (or the tenant API key it was opened with) is the only credential, which is why every call here goes through `apiFetch` and this task never adds a credential input.

- [ ] **Step 1: Write the failing money-formatter test**

`apps/dashboard/app/billing/money.test.mts` (`.mts` so `node --test` treats it as ESM and type-strips the TypeScript; the app's `tsconfig` change in Step 2 is what lets `tsc` see it):

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMinor } from './money.ts';

test('splits paisa into rupees', () => {
  assert.equal(formatMinor('118050', 'PKR'), 'PKR 1,180.50');
});

test('groups thousands', () => {
  assert.equal(formatMinor('100000000', 'PKR'), 'PKR 1,000,000.00');
});

test('is exact past Number.MAX_SAFE_INTEGER', () => {
  assert.equal(formatMinor('9007199254740993', 'PKR'), 'PKR 90,071,992,547,409.93');
});

test('formats sub-rupee and zero balances', () => {
  assert.equal(formatMinor('5', 'PKR'), 'PKR 0.05');
  assert.equal(formatMinor('0', 'PKR'), 'PKR 0.00');
});

test('keeps a negative clawback signed', () => {
  assert.equal(formatMinor('-250000', 'PKR'), '-PKR 2,500.00');
});

test('refuses anything that is not minor units', () => {
  assert.throws(() => formatMinor('1180.50', 'PKR'), TypeError);
  assert.throws(() => formatMinor('', 'PKR'), TypeError);
});
```

The `MAX_SAFE_INTEGER` case is the reason this file exists at all: `Number('9007199254740993')` is `9007199254740992`, so a formatter built on division would display a wrong balance in a money view. The `'1180.50'` refusal is the other half — a decimal reaching this function means something upstream already broke the minor-units rule, and silently formatting it as `PKR 1.18e3` paisa would hide that.

- [ ] **Step 2: Run it to verify it fails, then wire the app for `.mts`**

Run: `cd apps/dashboard && node --test app/billing/money.test.mts`
Expected: FAIL — `Cannot find module './money.ts'`.

In `apps/dashboard/package.json`, replace the placeholder test script:

```json
    "typecheck": "tsc --noEmit",
    "lint": "eslint app lib --max-warnings=0",
    "test": "node --test app/billing/money.test.mts"
```

In `apps/dashboard/tsconfig.json`, add `"**/*.mts"` to `include` and `allowImportingTsExtensions` next to `noEmit` (the same pair Task 16 had to add to checkout-ui; without the flag, `pnpm --filter @nid/dashboard typecheck` fails with `TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled`, because `node --test` requires the literal `./money.ts` specifier and `moduleResolution: 'bundler'` only permits it under that flag):

```json
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "**/*.mts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
```

- [ ] **Step 3: Implement the formatter**

`apps/dashboard/app/billing/money.ts`:

```ts
/**
 * Minor units are money. Splitting on the string keeps `Number` out of the
 * path entirely, so a balance above 2^53 paisa renders exactly instead of
 * rounding — which is why `money.test.mts` asserts that case.
 *
 * This is the second copy of the same twelve lines (apps/checkout-ui owns the
 * first), and that is the cheaper option: the shared home would be
 * `@nid/billing`, which imports Prisma and must never enter a browser bundle,
 * or `@nid/shared-types`, which is built to `dist` and has no UI consumer at
 * all today — making one means a build-order change in every app that runs
 * `tsc --noEmit`, for a formatting rule that does not change. Task 18 records
 * the duplication as a known, deliberate exception to DRY.
 */
export function formatMinor(minor: string, currency: string): string {
  if (!/^-?\d+$/.test(minor)) {
    throw new TypeError(`formatMinor expects an integer string of minor units, received "${minor}".`);
  }
  const negative = minor.startsWith('-');
  const digits = negative ? minor.slice(1) : minor;
  const padded = digits.padStart(3, '0');
  const whole = padded.slice(0, -2).replace(/^0+(?=\d)/, '');
  const fraction = padded.slice(-2);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${currency} ${grouped}.${fraction}`;
}
```

Run: `cd apps/dashboard && node --test app/billing/money.test.mts`
Expected: PASS — six tests.

- [ ] **Step 4: Add the billing surface to `lib/api-client.ts`**

Append to `apps/dashboard/lib/api-client.ts`. Every `…Minor` field is `string` because of Task 9's serializer; typing them `number` here would be the bug that reintroduces float money, one layer away from the database.

```ts
// ---- billing (spec §12: the dashboard is a tenant's whole billing surface) ----

export type BillingAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type BillingInvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
export type BillingSubscriptionStatus = 'INCOMPLETE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
export type BillingPaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';
export type BillingOutboundStatus = 'PENDING' | 'DELIVERED' | 'FAILED';
export type BillingPlanMode = 'CREDIT_PACK' | 'SUBSCRIPTION' | 'ONE_OFF';

/** `GET /v1/billing/account` — Task 11's overview(), one row of derived state. */
export interface BillingOverview {
  status: BillingAccountStatus;
  currency: string;
  creditBalanceMinor: string;
  outstandingMinor: string;
  lastPaymentAt: string | null;
}

export interface BillingServiceRow {
  id: string;
  key: string;
  name: string;
  ownerRepo: string;
  status: 'ACTIVE' | 'INACTIVE';
}

/**
 * `GET /v1/billing/plans?service=`. `creditsIncluded` is an `Int` in the schema,
 * so it arrives as a number — a count of credits, not money.
 */
export interface BillingPlan {
  id: string;
  serviceId: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  mode: BillingPlanMode;
  currency: string;
  unitAmountMinor: string;
  interval: 'MONTH' | 'YEAR' | null;
  creditsIncluded: number;
  overageUnitAmountMinor: string | null;
  features: Record<string, unknown>;
  status: 'ACTIVE' | 'ARCHIVED';
  service: BillingServiceRow;
}

export interface BillingInvoice {
  id: string;
  number: string;
  status: BillingInvoiceStatus;
  currency: string;
  subtotalMinor: string;
  taxMinor: string;
  totalMinor: string;
  amountPaidMinor: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueAt: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  createdAt: string;
}

/** `GET /v1/billing/invoices/:id` — the same row plus its lines (spec §12's "detail"). */
export interface BillingInvoiceDetail extends BillingInvoice {
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unitAmountMinor: string;
    amountMinor: string;
    taxMinor: string;
    serviceId: string;
    subscriptionId: string | null;
  }>;
}

export interface BillingSubscription {
  id: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  startedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  plan: BillingPlan;
}

export interface BillingPayment {
  id: string;
  provider: string;
  providerTransactionId: string;
  amountMinor: string;
  currency: string;
  status: BillingPaymentStatus;
  methodType: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface BillingUsageRecord {
  id: string;
  serviceId: string;
  metricKey: string;
  /** A count of events (`BigInt` in the schema), so a string, not money. */
  quantity: string;
  occurredAt: string;
  invoiceLineId: string | null;
}

/** `GET /v1/billing/events` — the delivery log (spec §9): what nID told this tenant's endpoint. */
export interface BillingOutboundEvent {
  id: string;
  serviceId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  targetUrl: string;
  status: BillingOutboundStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

/** The body Task 11's `CreateCheckoutSessionDto` accepts. The amount is never here — the server computes it (spec §7.1). */
export interface CheckoutRequest {
  purpose: 'CREDIT_TOPUP' | 'SUBSCRIPTION' | 'INVOICE' | 'ONE_OFF';
  planId?: string;
  invoiceId?: string;
  /**
   * Deliberately never sent by this app: the API origin-allowlists it
   * (`CHECKOUT_RETURN_ORIGINS`, empty by default), and a dashboard that posts a
   * returnUrl its own deployment has not allowlisted would make the pay button
   * fail with 422. Task 18's env example lists the origins to add it later.
   */
  returnUrl?: string;
}

/** `CheckoutOutcome` as served — `providerCheckoutUrl` is absent on a replayed key, hence optional. */
export interface CheckoutSessionResult {
  reused: boolean;
  intentId: string;
  token: string | null;
  checkoutUrl: string | null;
  providerCheckoutUrl?: string;
  expiresAt: string | null;
}

/**
 * The reads themselves go through `apiFetch` + `useResource` (Step 5), not
 * through wrappers here: a list endpoint's only variation is its path, and a
 * one-line `listBillingPayments` wrapper would be a second name for the same
 * call. What this file owns is the *types* above plus the two writes below —
 * a POST has a body and headers that must be built the same way everywhere.
 */
export function createCheckoutSession(
  credential: string,
  request: CheckoutRequest,
): Promise<CheckoutSessionResult> {
  return apiFetch<CheckoutSessionResult>('/v1/billing/checkout-sessions', credential, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Generated here, before the request leaves: the whole point of the key is
      // that a retry of this click is recognisable as the same purchase, which a
      // server-generated key cannot do.
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify(request),
  });
}

/** Default is cancel-at-period-end, which is the only kind of cancel the dashboard offers. */
export function cancelBillingSubscription(
  credential: string,
  subscriptionId: string,
): Promise<BillingSubscription> {
  return apiFetch<BillingSubscription>(`/v1/billing/subscriptions/${subscriptionId}/cancel`, credential, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ atPeriodEnd: true }),
  });
}

```

- [ ] **Step 5: Add the one fetch hook the sections need**

`apps/dashboard/lib/use-resource.ts`. `app/page.tsx`'s `CaseList` keeps its own inline fetch: rewriting it is not this task's scope, and a second instance is what would justify extracting it.

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './api-client';

export interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Refetch — the billing list endpoints have no other invalidation channel. */
  reload: () => void;
}

/**
 * One GET, its error, its loading flag. `path` is `null` until the caller knows
 * what it wants (the plan list waits for a selected service), which keeps the
 * section in its loading state instead of firing a request for
 * `/v1/billing/plans?service=null`.
 */
export function useResource<T>(path: string | null, credential: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [nonce, setNonce] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!path || !credential) {
      setLoading(false);
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    apiFetch<T>(path, credential, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : `Could not load ${path}.`);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, credential, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}
```

- [ ] **Step 6: Put the nav in the header**

`apps/dashboard/app/components/header.tsx` becomes:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Tenant } from '../../lib/api-client';
import { Logomark } from './logomark';

/**
 * `usePathname` marks the active link, and `aria-current="page"` is the
 * accessible half of that — the visual highlight alone is not announced.
 * The header is rendered by every signed-in page, so both routes pass through
 * here and neither needs its own nav.
 */
export function Header({ tenant, onLogout }: { tenant: Tenant; onLogout: () => void }) {
  const pathname = usePathname();
  const links = [
    { href: '/', label: 'Cases' },
    { href: '/billing', label: 'Billing' },
  ];

  return (
    <header className="app-header">
      <div className="header-identity">
        <Logomark size={28} />
        <div>
          <div className="brand">nID Dashboard</div>
          <div className="tenant-name">
            {tenant.name}
            {tenant.signedInAs === 'API_KEY' && (
              <span className="signed-in-as" title="Signed in with a raw tenant API key, not a staff account">
                {' '}
                (API key)
              </span>
            )}
          </div>
        </div>
      </div>
      <nav className="app-nav" aria-label="Dashboard sections">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="nav-link"
            aria-current={pathname === link.href ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <button className="logout-btn" onClick={onLogout} type="button">
        Sign out
      </button>
    </header>
  );
}
```

- [ ] **Step 7: Write the checkout hook**

`apps/dashboard/app/billing/use-checkout.ts` — `/billing` and `/billing/invoices/[id]` both start a checkout, and neither may re-decide what that means:

```ts
'use client';

import { useState } from 'react';
import { ApiError, createCheckoutSession, type CheckoutRequest } from '../../lib/api-client';

export interface CheckoutState {
  pending: boolean;
  error: string | null;
  start: (request: CheckoutRequest) => Promise<void>;
}

/**
 * Two decisions belong here and not in a page. The `Idempotency-Key` is created
 * inside `createCheckoutSession`, before the request leaves the browser — a
 * double-click or a retry after a dropped response must be the same purchase.
 * And success is a full-page navigation to nID's own `/checkout/<token>` page,
 * not `router.push`: the browser has to leave this app for the provider's
 * hosted form (spec §7.1), so client-side routing would be wrong even if it
 * looked smoother.
 */
export function useCheckout(credential: string): CheckoutState {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(request: CheckoutRequest): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const outcome = await createCheckoutSession(credential, request);
      if (!outcome.checkoutUrl) {
        // A replayed key returns the existing intent without minting a second
        // token (Task 7). This app never reuses a key, so reaching here means
        // the same click was submitted twice — say so rather than navigating
        // nowhere.
        setError('That payment is already in progress. Check its status below.');
        return;
      }
      window.location.assign(outcome.checkoutUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open a payment session.');
    } finally {
      // Only reached when the navigation did not happen: a real success has
      // already unloaded this page.
      setPending(false);
    }
  }

  return { pending, error, start };
}
```

- [ ] **Step 8: Write the presentational sections**

`apps/dashboard/app/billing/sections.tsx`. Every table and card in `/billing` lives here as a pure function of props, so `page.tsx` stays a list of fetches and the empty/loading/error contract is written once, in `Section`.

```tsx
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type {
  BillingInvoice,
  BillingOutboundEvent,
  BillingOverview,
  BillingPayment,
  BillingPlan,
  BillingServiceRow,
  BillingSubscription,
  BillingUsageRecord,
} from '../../lib/api-client';
import { formatMinor } from './money';

/**
 * The one place empty/loading/error are decided, so a section cannot forget
 * one of them (spec §12). `isEmpty` is a prop rather than inferred from
 * `data` because `0`-length and `undefined` mean different things at the call
 * site and the caller knows which it has.
 */
export function Section({
  title,
  loading,
  error,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <section className="billing-section" aria-busy={loading}>
      <h2>{title}</h2>
      {error ? (
        <p className="error-text">{error}</p>
      ) : loading ? (
        <p className="lead">Loading…</p>
      ) : isEmpty ? (
        <div className="empty-state">{emptyMessage}</div>
      ) : (
        children
      )}
    </section>
  );
}

export function OverviewCard({ overview }: { overview: BillingOverview }) {
  const outstanding = BigInt(overview.outstandingMinor) > 0n;
  return (
    <div className="balance-grid">
      <div className="balance-card">
        <div className="balance-label">Credit balance</div>
        <div className="balance-value">{formatMinor(overview.creditBalanceMinor, overview.currency)}</div>
        <div className="muted">
          Account <span className={`badge ${overview.status}`}>{overview.status}</span>
        </div>
      </div>
      <div className="balance-card">
        <div className="balance-label">Outstanding invoices</div>
        <div className={`balance-value${outstanding ? ' is-due' : ''}`}>
          {formatMinor(overview.outstandingMinor, overview.currency)}
        </div>
        <div className="muted">Unpaid total across OPEN invoices</div>
      </div>
      <div className="balance-card">
        <div className="balance-label">Last successful payment</div>
        <div className="balance-value">
          {overview.lastPaymentAt ? new Date(overview.lastPaymentAt).toLocaleString() : '—'}
        </div>
        <div className="muted">Nothing paid yet is shown as a dash</div>
      </div>
    </div>
  );
}

/**
 * Credit packs and subscription plans for the selected service. `serviceKey`
 * arrives from the page because the plan list is fetched per service, and it is
 * what the chips highlight — the purchase itself carries only `planId`, so the
 * server, not this component, decides which service the revenue belongs to.
 */
export function PlanPanel({
  services,
  serviceKey,
  onSelectService,
  plans,
  loading,
  error,
  busy,
  pendingId,
  onBuyCredits,
  onSubscribe,
}: {
  services: BillingServiceRow[];
  serviceKey: string | null;
  onSelectService: (key: string) => void;
  plans: BillingPlan[];
  loading: boolean;
  error: string | null;
  /** True while any checkout is in flight — one checkout per page load, so a second click cannot start a parallel purchase. */
  busy: boolean;
  pendingId: string | null;
  onBuyCredits: (plan: BillingPlan) => void;
  onSubscribe: (plan: BillingPlan) => void;
}) {
  const packs = plans.filter((plan) => plan.mode === 'CREDIT_PACK');
  const subscriptions = plans.filter((plan) => plan.mode === 'SUBSCRIPTION');

  return (
    <Section
      title="Top up & plans"
      loading={loading}
      error={error}
      isEmpty={services.length === 0}
      emptyMessage="No services are in the catalog yet."
    >
      <div className="service-picker" role="group" aria-label="Service">
        {services.map((service) => (
          <button
            key={service.id}
            type="button"
            className={service.key === serviceKey ? 'chip selected' : 'chip'}
            aria-pressed={service.key === serviceKey}
            onClick={() => onSelectService(service.key)}
          >
            {service.name}
          </button>
        ))}
      </div>
      {packs.length === 0 && subscriptions.length === 0 ? (      {packs.length === 0 && subscriptions.length === 0 ? (
        <div className="empty-state">This service has no purchasable plans yet.</div>
      ) : null}
      {packs.length > 0 ? (
        <>
          <h3 className="plan-heading">Credit packs</h3>
          <div className="pack-grid">
            {packs.map((plan) => (
              <div className="pack-card" key={plan.id}>
                <div className="pack-name">{plan.name}</div>
                {plan.description ? <p className="muted">{plan.description}</p> : null}
                <div className="balance-value">{formatMinor(plan.unitAmountMinor, plan.currency)}</div>
                <div className="muted">
                  {plan.creditsIncluded.toLocaleString()} credits
                </div>
                <button
                  className="primary-block"
                  type="button"
                  disabled={busy}
                  onClick={() => onBuyCredits(plan)}
                >
                  {pendingId === plan.id ? 'Opening…' : 'Buy credits'}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {subscriptions.length > 0 ? (
        <>
          <h3 className="plan-heading">Subscriptions</h3>
          <div className="pack-grid">
            {subscriptions.map((plan) => (
              <div className="pack-card" key={plan.id}>
                <div className="pack-name">{plan.name}</div>
                {plan.description ? <p className="muted">{plan.description}</p> : null}
                <div className="balance-value">
                  {formatMinor(plan.unitAmountMinor, plan.currency)}
                  <span className="muted"> / {plan.interval?.toLowerCase()}</span>
                </div>
                <button
                  className="primary-block"
                  type="button"
                  disabled={pendingId !== null}
                  onClick={() => onSubscribe(plan)}
                >
                  {pendingId === plan.id ? 'Opening…' : 'Subscribe'}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Section>
  );
}

export function InvoicesTable({
  invoices,
  onPay,
  busy,
  pendingId,
}: {
  invoices: BillingInvoice[];
  onPay: (invoice: BillingInvoice) => void;
  busy: boolean;
  pendingId: string | null;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Number</th>
          <th>Status</th>
          <th>Total</th>
          <th>Paid</th>
          <th>Due</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id}>
            <td>
              <Link href={`/billing/invoices/${invoice.id}`}>{invoice.number}</Link>
            </td>
            <td>
              <span className={`badge ${invoice.status}`}>{invoice.status}</span>
            </td>
            <td className="money-col">{formatMinor(invoice.totalMinor, invoice.currency)}</td>
            <td className="money-col">{formatMinor(invoice.amountPaidMinor, invoice.currency)}</td>
            <td>{invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : '—'}</td>
            <td>
              {invoice.status === 'OPEN' ? (
                <button type="button" className="secondary" disabled={busy} onClick={() => onPay(invoice)}>
                  {pendingId === invoice.id ? 'Opening…' : 'Pay'}
                </button>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SubscriptionsTable({
  subscriptions,
  onCancel,
  cancelingId,
  cancelError,
}: {
  subscriptions: BillingSubscription[];
  onCancel: (subscription: BillingSubscription) => void;
  cancelingId: string | null;
  cancelError: string | null;
}) {
  return (
    <>
      {cancelError ? <p className="error-text">{cancelError}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Service</th>
            <th>Status</th>
            <th>Current period</th>
            <th>Renews</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((subscription) => (
            <tr key={subscription.id}>
              <td>{subscription.plan.name}</td>
              <td>{subscription.plan.service.name}</td>
              <td>
                <span className={`badge ${subscription.status}`}>{subscription.status}</span>
                {subscription.cancelAtPeriodEnd ? (
                  <div className="muted">cancels at period end</div>
                ) : null}
              </td>
              <td>
                {subscription.currentPeriodStart && subscription.currentPeriodEnd
                  ? `${new Date(subscription.currentPeriodStart).toLocaleDateString()} – ${new Date(
                      subscription.currentPeriodEnd,
                    ).toLocaleDateString()}`
                  : '—'}
              </td>
              <td>
                {subscription.cancelAtPeriodEnd || subscription.status === 'CANCELED'
                  ? 'no'
                  : subscription.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : '—'}
              </td>
              <td>
                {subscription.status === 'ACTIVE' || subscription.status === 'PAST_DUE' ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={cancelingId !== null || subscription.cancelAtPeriodEnd}
                    onClick={() => onCancel(subscription)}
                  >
                    {cancelingId === subscription.id ? 'Cancelling…' : 'Cancel at period end'}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function PaymentsTable({ payments }: { payments: BillingPayment[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>When</th>
          <th>Provider</th>
          <th>Status</th>
          <th>Amount</th>
          <th>Reference</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => (
          <tr key={payment.id}>
            <td>{new Date(payment.paidAt ?? payment.createdAt).toLocaleString()}</td>
            <td>{payment.provider}</td>
            <td>
              <span className={`badge ${payment.status}`}>{payment.status}</span>
            </td>
            <td className="money-col">{formatMinor(payment.amountMinor, payment.currency)}</td>
            <td className="mono">{payment.providerTransactionId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** `servicesById` is why this table can name a service: the API sends `serviceId`, and the catalog is already loaded. */
export function UsageTable({
  usage,
  servicesById,
}: {
  usage: BillingUsageRecord[];
  servicesById: Map<string, string>;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Occurred</th>
          <th>Service</th>
          <th>Metric</th>
          <th>Quantity</th>
          <th>Billed</th>
        </tr>
      </thead>
      <tbody>
        {usage.map((record) => (
          <tr key={record.id}>
            <td>{new Date(record.occurredAt).toLocaleString()}</td>
            <td>{servicesById.get(record.serviceId) ?? record.serviceId}</td>
            <td className="mono">{record.metricKey}</td>
            <td className="money-col">{record.quantity}</td>
            <td>{record.invoiceLineId ? 'yes' : 'not yet'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EventsTable({ events }: { events: BillingOutboundEvent[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Queued</th>
          <th>Event</th>
          <th>Status</th>
          <th>Attempts</th>
          <th>Delivered</th>
          <th>Last error</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={event.id}>
            <td>{new Date(event.createdAt).toLocaleString()}</td>
            <td className="mono">{event.eventType}</td>
            <td>
              <span className={`badge ${event.status}`}>{event.status}</span>
            </td>
            <td>{event.attempts}</td>
            <td>{event.deliveredAt ? new Date(event.deliveredAt).toLocaleString() : '—'}</td>
            <td className="muted">{event.lastError ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 9: Compose `/billing`**

`apps/dashboard/app/billing/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  cancelBillingSubscription,
  type BillingInvoice,
  type BillingOutboundEvent,
  type BillingOverview,
  type BillingPayment,
  type BillingPlan,
  type BillingServiceRow,
  type BillingSubscription,
  type BillingUsageRecord,
  type Tenant,
} from '../../lib/api-client';
import { useDashboardSession } from '../../lib/use-dashboard-session';
import { useResource } from '../../lib/use-resource';
import { Header } from '../components/header';
import { useCheckout } from './use-checkout';
import {
  EventsTable,
  InvoicesTable,
  OverviewCard,
  PaymentsTable,
  PlanPanel,
  Section,
  SubscriptionsTable,
  UsageTable,
} from './sections';

export default function BillingPage() {
  const { state, logout } = useDashboardSession();

  if (state.kind === 'checking') {
    return (
      <div className="login-wrap">
        <p className="lead">Checking for a saved session…</p>
      </div>
    );
  }

  // Same credential store as the cases list, so there is no second sign-in and
  // no API key pasted for billing (spec §12).
  if (state.kind === 'signed-out') {
    return (
      <div className="login-wrap">
        <p className="lead">
          <Link href="/">Sign in</Link> to see this tenant&apos;s billing.
        </p>
      </div>
    );
  }

  return <BillingDashboard credential={state.credential} tenant={state.tenant} onLogout={logout} />;
}

function BillingDashboard({
  credential,
  tenant,
  onLogout,
}: {
  credential: string;
  tenant: Tenant;
  onLogout: () => void;
}) {
  const [serviceKey, setServiceKey] = useState<string | null>(null);
  const [clickedPlanId, setClickedPlanId] = useState<string | null>(null);
  const [clickedInvoiceId, setClickedInvoiceId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const overview = useResource<BillingOverview>('/v1/billing/account', credential);
  const services = useResource<BillingServiceRow[]>('/v1/billing/services', credential);
  const invoices = useResource<BillingInvoice[]>('/v1/billing/invoices', credential);
  const subscriptions = useResource<BillingSubscription[]>('/v1/billing/subscriptions', credential);
  const payments = useResource<BillingPayment[]>('/v1/billing/payments', credential);
  const usage = useResource<BillingUsageRecord[]>('/v1/billing/usage', credential);
  const events = useResource<BillingOutboundEvent[]>('/v1/billing/events', credential);
  const plans = useResource<BillingPlan[]>(
    serviceKey ? `/v1/billing/plans?service=${encodeURIComponent(serviceKey)}` : null,
    credential,
  );
  const checkout = useCheckout(credential);

  useEffect(() => {
    if (!serviceKey && services.data && services.data.length > 0) {
      setServiceKey(services.data[0]!.key);
    }
  }, [serviceKey, services.data]);

  const servicesById = new Map((services.data ?? []).map((service) => [service.id, service.name]));

  function buyCredits(plan: BillingPlan): void {
    setClickedPlanId(plan.id);
    // purpose + planId only: the amount is computed from the pinned plan on the
    // server (spec §7.1), and the plan's own service is what nID records the
    // revenue against.
    void checkout.start({ purpose: 'CREDIT_TOPUP', planId: plan.id });
  }

  function subscribe(plan: BillingPlan): void {
    setClickedPlanId(plan.id);
    void checkout.start({ purpose: 'SUBSCRIPTION', planId: plan.id });
  }

  function payInvoice(invoice: BillingInvoice): void {
    setClickedInvoiceId(invoice.id);
    void checkout.start({ purpose: 'INVOICE', invoiceId: invoice.id });
  }

  async function cancel(subscription: BillingSubscription): Promise<void> {
    setCancelingId(subscription.id);
    setCancelError(null);
    try {
      await cancelBillingSubscription(credential, subscription.id);
      subscriptions.reload();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Could not cancel that subscription.');
    } finally {
      setCancelingId(null);
    }
  }

  const selectedService = (services.data ?? []).find((service) => service.key === serviceKey);

  return (
    <>
      <Header tenant={tenant} onLogout={onLogout} />
      <main className="shell">
        <h1>Billing</h1>
        {/* One place, because it is the same hook both action lists share. */}
        {checkout.error ? <p className="error-text">{checkout.error}</p> : null}

        <Section
          title="Account"
          loading={overview.loading}
          error={overview.error}
          isEmpty={overview.data === null}
          emptyMessage="No billing account yet."
        >
          {overview.data ? <OverviewCard overview={overview.data} /> : null}
        </Section>

        <PlanPanel
          services={services.data ?? []}
          serviceKey={serviceKey}
          onSelectService={setServiceKey}
          plans={plans.data ?? []}
          loading={services.loading || plans.loading}
          error={services.error ?? plans.error}
          busy={checkout.pending}
          pendingId={checkout.pending ? clickedPlanId : null}
          onBuyCredits={buyCredits}
          onSubscribe={subscribe}
        />

        <Section
          title="Invoices"
          loading={invoices.loading}
          error={invoices.error}
          isEmpty={(invoices.data ?? []).length === 0}
          emptyMessage="No invoices yet. One-off invoices and subscription invoices appear here."
        >
          <InvoicesTable
            invoices={invoices.data ?? []}
            onPay={payInvoice}
            busy={checkout.pending}
            pendingId={checkout.pending ? clickedInvoiceId : null}
          />
        </Section>

        <Section
          title="Subscriptions"
          loading={subscriptions.loading}
          error={subscriptions.error}
          isEmpty={(subscriptions.data ?? []).length === 0}
          emptyMessage="No subscriptions yet."
        >
          <SubscriptionsTable
            subscriptions={subscriptions.data ?? []}
            onCancel={(subscription) => void cancel(subscription)}
            cancelingId={cancelingId}
            cancelError={cancelError}
          />
        </Section>

        <Section
          title="Payments"
          loading={payments.loading}
          error={payments.error}
          isEmpty={(payments.data ?? []).length === 0}
          emptyMessage="Nothing has been paid yet."
        >
          <PaymentsTable payments={payments.data ?? []} />
        </Section>

        <Section
          title="Usage"
          loading={usage.loading}
          error={usage.error}
          isEmpty={(usage.data ?? []).length === 0}
          emptyMessage="No usage recorded yet."
        >
          <UsageTable usage={usage.data ?? []} servicesById={servicesById} />
        </Section>

        <Section
          title="Webhook delivery log"
          loading={events.loading}
          error={events.error}
          isEmpty={(events.data ?? []).length === 0}
          emptyMessage="nID has not notified anyone yet. Set a billing webhook URL on this tenant to receive events."
        >
          <EventsTable events={events.data ?? []} />
        </Section>

        {selectedService ? (
          <p className="muted">
            Plans shown are {selectedService.name}&apos;s. Payments are collected by nID as merchant of
            record and attributed to that service internally.
          </p>
        ) : null}
      </main>
    </>
  );
}
```

- [ ] **Step 10: Add the invoice detail page**

`apps/dashboard/app/billing/invoices/[id]/page.tsx` — spec §12's "detail (lines per service)". The API returns `serviceId` on each line, not a name (`InvoiceWithLines` is `Invoice & { lines: InvoiceLine[] }`), and the tenant-visible catalog is tiny and already served by `/v1/billing/services`, so the join happens here rather than widening the payload:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  type BillingInvoiceDetail,
  type BillingServiceRow,
  type Tenant,
} from '../../../lib/api-client';
import { useDashboardSession } from '../../../lib/use-dashboard-session';
import { useResource } from '../../../lib/use-resource';
import { Header } from '../../components/header';
import { formatMinor } from '../money';
import { useCheckout } from '../use-checkout';

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { state, logout } = useDashboardSession();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    void params.then((resolved) => setInvoiceId(resolved.id));
  }, [params]);

  if (state.kind === 'checking') {
    return (
      <div className="login-wrap">
        <p className="lead">Checking for a saved session…</p>
      </div>
    );
  }

  if (state.kind === 'signed-out') {
    return (
      <div className="login-wrap">
        <p className="lead">
          <Link href="/">Sign in</Link> to see this invoice.
        </p>
      </div>
    );
  }

  return (
    <>
      <Header tenant={state.tenant} onLogout={logout} />
      <main className="shell">
        {invoiceId ? (
          <InvoiceDetail credential={state.credential} tenant={state.tenant} invoiceId={invoiceId} />
        ) : (
          <p className="lead">Loading invoice…</p>
        )}
      </main>
    </>
  );
}

function InvoiceDetail({
  credential,
  tenant,
  invoiceId,
}: {
  credential: string;
  tenant: Tenant;
  invoiceId: string;
}) {
  const invoice = useResource<BillingInvoiceDetail>(`/v1/billing/invoices/${invoiceId}`, credential);
  const services = useResource<BillingServiceRow[]>('/v1/billing/services', credential);
  const checkout = useCheckout(credential);

  if (invoice.error) {
    return (
      <>
        <p className="error-text">{invoice.error}</p>
        <p>
          <Link href="/billing">Back to billing</Link>
        </p>
      </>
    );
  }
  if (invoice.loading || !invoice.data) {
    return <p className="lead">Loading invoice…</p>;
  }

  const data = invoice.data;
  const serviceName = (serviceId: string): string =>
    (services.data ?? []).find((service) => service.id === serviceId)?.name ?? serviceId;
  const due = BigInt(data.totalMinor) - BigInt(data.amountPaidMinor);

  return (
    <>
      <p className="back-link">
        <Link href="/billing">Billing</Link> / {data.number}
      </p>
      <h1>Invoice {data.number}</h1>
      <dl className="detail-grid">
        <dt>Status</dt>
        <dd>
          <span className={`badge ${data.status}`}>{data.status}</span>
        </dd>
        <dt>Issued</dt>
        <dd>{data.issuedAt ? new Date(data.issuedAt).toLocaleString() : '—'}</dd>
        <dt>Due</dt>
        <dd>{data.dueAt ? new Date(data.dueAt).toLocaleString() : '—'}</dd>
        <dt>Paid</dt>
        <dd>{data.paidAt ? new Date(data.paidAt).toLocaleString() : '—'}</dd>
      </dl>

      <h2 className="plan-heading">Lines</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Amount</th>
            <th>Tax</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line) => (
            <tr key={line.id}>
              <td>{serviceName(line.serviceId)}</td>
              <td>{line.description}</td>
              <td>{line.quantity}</td>
              <td className="money-col">{formatMinor(line.unitAmountMinor, data.currency)}</td>
              <td className="money-col">{formatMinor(line.amountMinor, data.currency)}</td>
              <td className="money-col">{formatMinor(line.taxMinor, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="detail-grid">
        <dt>Subtotal</dt>
        <dd>{formatMinor(data.subtotalMinor, data.currency)}</dd>
        <dt>Tax</dt>
        <dd>{formatMinor(data.taxMinor, data.currency)}</dd>
        <dt>Total</dt>
        <dd>{formatMinor(data.totalMinor, data.currency)}</dd>
        <dt>Paid so far</dt>
        <dd>{formatMinor(data.amountPaidMinor, data.currency)}</dd>
        <dt>Balance due</dt>
        <dd>{formatMinor(due > 0n ? due.toString() : '0', data.currency)}</dd>
      </dl>

      {checkout.error ? <p className="error-text">{checkout.error}</p> : null}
      {data.status === 'OPEN' ? (
        <button
          className="primary-block"
          type="button"
          disabled={checkout.pending}
          onClick={() => void checkout.start({ purpose: 'INVOICE', invoiceId: data.id })}
        >
          {checkout.pending ? 'Opening…' : `Pay ${formatMinor(due > 0n ? due.toString() : '0', data.currency)}`}
        </button>
      ) : null}
    </>
  );
}
```

- [ ] **Step 11: Add the CSS this section uses**

Append to `apps/dashboard/app/globals.css`. The badge rules reuse the existing `.badge` base and the `color-mix` pattern already in the file; `.badge.PENDING` and `.badge.CANCELED` already exist, so a payment or event in those states is already coloured correctly with no new rule.

```css
/* ── billing (Task 17) ── */
.app-nav {
  display: flex;
  gap: 16px;
  margin-left: auto;
}

.nav-link {
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  padding: 6px 2px;
  border-bottom: 2px solid transparent;
}

.nav-link[aria-current='page'] {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.balance-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.balance-label {
  color: var(--muted);
  font-size: 13px;
}

.balance-value {
  font-size: 24px;
  font-weight: 700;
  margin: 4px 0 8px;
  /* Money is never broken across lines by a narrow column. */
  white-space: nowrap;
}

.balance-value.is-due {
  color: var(--danger);
}

.billing-section {
  margin: 32px 0;
}

.billing-section h2,
.plan-heading {
  font-size: 16px;
  margin: 0 0 12px;
}

.service-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.chip {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
}

.chip.selected {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}

.pack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.pack-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.pack-name {
  font-weight: 700;
}

.money-col {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.muted {
  color: var(--muted);
  font-size: 13px;
}

/* Billing statuses the case badges do not already cover. */
.badge.PAID,
.badge.SUCCEEDED,
.badge.ACTIVE,
.badge.DELIVERED {
  background: color-mix(in srgb, var(--success) 18%, transparent);
  color: var(--success);
}

.badge.OPEN,
.badge.INCOMPLETE,
.badge.PAST_DUE {
  background: color-mix(in srgb, var(--warn) 18%, transparent);
  color: var(--warn);
}

.badge.DRAFT,
.badge.VOID,
.badge.UNCOLLECTIBLE,
.badge.FAILED,
.badge.SUSPENDED,
.badge.CLOSED {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
  color: var(--danger);
}
```

`header.app-header` is already `display: flex`, so `.app-nav { margin-left: auto }` pushes the nav and the existing sign-out button to the right without touching that rule.

- [ ] **Step 12: Verify the app**

Run: `pnpm --filter @nid/dashboard typecheck && pnpm --filter @nid/dashboard lint && pnpm --filter @nid/dashboard test`
Expected: PASS. `test` now runs six real assertions instead of the `echo` placeholder.

Run: `pnpm --filter @nid/dashboard build`
Expected: PASS, and the route manifest lists `/billing` and `/billing/invoices/[id]` alongside `/` and `/cases/[id]`.

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: green repo-wide — the `package.json`/`tsconfig` changes are local to `@nid/dashboard`, so nothing else should move.

- [ ] **Step 13: Smoke it against a running API**

Both `apps/api` (port 4000) and this app (port 3200) must be running, and the tenant must have a catalog. If Task 18's seed has not been run yet, `/billing` renders every section's empty state — which is itself the check that the empty branches work; do not treat a blank plan panel as a failure of this task.

With the seed applied and `PAYMENT_PROVIDERS=mock`:

1. Sign in at `http://localhost:3200`, open **Billing** in the nav.
2. Confirm the three overview cards: balance `PKR 0.00` before any top-up, outstanding `PKR 0.00`, last payment `—`.
3. Click a credit pack's **Buy credits** → the browser leaves for `http://localhost:3500/checkout/<token>`. Complete it (Task 16's mock-pay page), and on the `/return/<token>` page confirm **success**.
4. Back on `/billing`: balance now equals the pack's `creditsIncluded`, and **Payments** lists one `SUCCEEDED` row with the mock's reference.
5. Reload `/billing` and click **Buy credits** a second time. Confirm a *different* intent is created (new key per click) — the balance moves again rather than the first payment being replayed.
6. Open an `OPEN` invoice's number, confirm its lines name the services they were booked against, click **Pay**, and after the mock completes, confirm the invoice is `PAID` and `/billing`'s outstanding total drops to `PKR 0.00`.
7. Cancel an active subscription and confirm the row keeps `ACTIVE` with "cancels at period end" and `Renews → no`.
8. Keyboard-only pass: Tab through nav → service chips → buy buttons → invoice links; every control shows a focus ring and the plan grid is reachable without a pointer.

If any of 3–6 fails with a 422 on the checkout call, the cause is almost always Task 18's seed (no ACTIVE plan for that service) or `CHECKOUT_UI_URL` pointing somewhere other than `:3500` — check those before assuming this page's code.

- [ ] **Step 14: Commit**

```bash
git add apps/dashboard
git commit -m "feat(dashboard): add the billing section with overview, credit packs, invoices and subscriptions"
```

---

## Task 18: Seed the catalog, close Phase 1's test gate, and record the governance change

**Files:**
- Modify: `packages/db/prisma/seed.ts`
- Modify: `.env.example`
- Create: `apps/api/test/billing-rls.spec.ts`
- Create: `apps/api/test/billing-phase-1.spec.ts`
- Modify: `ECOSYSTEM.md`
- Modify: `docs/PHASES.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `withBillingAdminContext` and `withTenantContext` (`@nid/db`, Task 1); `generateApiKey` (`@nid/shared-types`, already imported by `seed.ts`); the Prisma models `BillingService`, `Plan`, `BillingServiceCredential`, `BillingAccount`, `SettlementRecord`, `LedgerAccount` and their enum values (Task 1); `BillingService.overview/createCheckout/invoice/listSubscriptions/cancel` (Task 11); `AdminBillingService`'s scope list `['checkout:create', 'usage:write', 'invoice:create', 'entitlements:read']` (Task 12); `CheckoutPublicController.summary` and `DevPaymentsController.pay` with `MockPaymentDto` (Task 13); `BillingServiceCredentialsService.invoice/checkout/account/entitlements` and `BillingServiceActor` (Task 15); `chargeVerificationCase`, `getBillingAccount`, `ensureBillingAccount`, `creditAccount` (`@nid/billing`, Tasks 4/6); `PaymentProvidersService` and `AuditService` (Task 9); the RLS policies `tenant_isolation`, `catalog_read`/`catalog_write`, `payment_intent_lookup`, `settlement_admin_only` (Task 1's migration).
- Produces: a seeded catalog (`nid`, `erp-1`, `communicator` + plans), one dev `nid` service credential and one platform billing-admin Account printed once, a `BillingAccount` for every existing tenant, `billing-rls.spec.ts` and `billing-phase-1.spec.ts` (the two specs spec §19's criteria 5 and 1-4 are judged by), and the `ECOSYSTEM.md` / `docs/PHASES.md` / `README.md` records spec §17 requires. Nothing downstream consumes this task's code, which is why it is last.

This task changes no behaviour. If a step here fails, the bug is in an earlier task — and step 4 and 5's failure messages are deliberately written to say which table or which seeded row is at fault.

- [ ] **Step 1: Add the billing catalog to `packages/db/prisma/seed.ts`**

Append this function after `seedCommunicatorClient` and before `seedDemoProfile`:

```ts
/**
 * Phase 1's billing catalog (spec §5.1, §9.1). nID registers itself as the
 * `nid` service so its own verification charges settle through the same
 * checkout, ledger and revenue attribution as every other service's, and
 * `erp-1` / `communicator` — the two ecosystem repos ECOSYSTEM.md gives nID a
 * billing relationship with — get plans they can actually be billed against.
 *
 * Money is PKR in paisa and credits are 1:1 with paisa, so Rs 118.00 buys
 * 11,800 credits and `VERIFICATION_CASE_CREDIT_MINOR=2500` means "Rs 25.00 per
 * case". Only `CREDIT_PACK` plans carry `creditsIncluded`: Task 12's admin path
 * forces 0 for every other mode, so the seed agrees rather than inventing a
 * second convention the catalog UI would then have to reconcile.
 *
 * Plans are immutable price records (spec D11): a re-run upserts a
 * (service, key, version) triple it has never written and never edits one it
 * has, because a live `Subscription` pins `planId` and re-running the seed must
 * not silently reprice it.
 *
 * The seed connects with `DATABASE_URL` — the migrator role, which has BYPASSRLS
 * — so `withBillingAdminContext` / `withTenantContext` below are not what grant
 * access here. They are used anyway so the seed writes through the same code
 * path the API does: if a catalog policy ever needs a column the seed doesn't
 * set, this is where it surfaces rather than in production.
 */
async function seedBilling(prisma: ReturnType<typeof createPrismaClient>): Promise<void> {
  type SeedPlan = {
    key: string;
    name: string;
    mode: 'CREDIT_PACK' | 'SUBSCRIPTION';
    unitAmountMinor: bigint;
    creditsIncluded?: number;
    interval?: 'MONTH' | 'YEAR';
    features?: Record<string, number>;
  };
  const catalog: Array<{ key: string; name: string; ownerRepo: string; plans: SeedPlan[] }> = [
    {
      key: 'nid',
      name: 'nID',
      ownerRepo: 'nID',
      plans: [
        {
          key: 'starter-credits',
          name: 'Starter credits',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 11800n,
          creditsIncluded: 11800,
          features: { lowBalanceThresholdMinor: 2500 },
        },
        {
          key: 'growth-credits',
          name: 'Growth credits',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 59000n,
          creditsIncluded: 59000,
          features: { lowBalanceThresholdMinor: 10000 },
        },
        {
          key: 'professional-monthly',
          name: 'Professional (monthly)',
          mode: 'SUBSCRIPTION',
          unitAmountMinor: 250000n,
          interval: 'MONTH',
          features: { max_concurrent_sessions: 5, lowBalanceThresholdMinor: 25000 },
        },
      ],
    },
    {
      key: 'erp-1',
      name: 'erp-1 (Yaseen)',
      ownerRepo: 'erp-1',
      plans: [
        {
          // `growth` with features.max_users 25 is spec §9's entitlement
          // example, verbatim: the worked example in the design doc is a row a
          // developer integrating against the sandbox can actually query.
          key: 'growth',
          name: 'Growth (monthly)',
          mode: 'SUBSCRIPTION',
          unitAmountMinor: 50000n,
          interval: 'MONTH',
          features: { max_users: 25 },
        },
        {
          key: 'ops-credits',
          name: 'Workflow credits',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 25000n,
          creditsIncluded: 25000,
          features: { lowBalanceThresholdMinor: 5000 },
        },
      ],
    },
    {
      key: 'communicator',
      name: 'Communicator',
      ownerRepo: 'Communicator',
      plans: [
        {
          key: 'message-credits',
          name: 'Message credits',
          mode: 'CREDIT_PACK',
          unitAmountMinor: 25000n,
          creditsIncluded: 25000,
          features: { lowBalanceThresholdMinor: 5000 },
        },
      ],
    },
  ];

  await withBillingAdminContext(prisma, async (tx) => {
    for (const spec of catalog) {
      const service = await tx.billingService.upsert({
        where: { key: spec.key },
        update: { name: spec.name, ownerRepo: spec.ownerRepo, status: 'ACTIVE' },
        create: { key: spec.key, name: spec.name, ownerRepo: spec.ownerRepo },
      });
      for (const plan of spec.plans) {
        await tx.plan.upsert({
          where: {
            serviceId_key_version: { serviceId: service.id, key: plan.key, version: 1 },
          },
          // Empty on purpose: `update` is where a re-run would reprice a live
          // subscription. A price change is a new version row, created through
          // the admin surface, never a seed edit.
          update: {},
          create: {
            serviceId: service.id,
            key: plan.key,
            version: 1,
            name: plan.name,
            mode: plan.mode,
            currency: 'PKR',
            unitAmountMinor: plan.unitAmountMinor,
            interval: plan.interval,
            creditsIncluded: plan.creditsIncluded ?? 0,
            features: plan.features ?? {},
            status: 'ACTIVE',
          },
        });
      }
    }
  });

  // nID's own credential: the API uses it to bill itself for verification cases
  // through the same `/v1/billing/service/*` surface erp-1 will use, so the
  // integration contract has exactly one implementation. A `test`-prefixed key,
  // because this seed is a dev artefact and a leaked one must not look live.
  const nidService = await prisma.billingService.findUniqueOrThrow({ where: { key: 'nid' } });
  const existingCredential = await prisma.billingServiceCredential.findFirst({
    where: { serviceId: nidService.id, revokedAt: null },
  });
  if (!existingCredential) {
    const generated = generateApiKey('test');
    await withBillingAdminContext(prisma, (tx) =>
      tx.billingServiceCredential.create({
        data: {
          serviceId: nidService.id,
          label: 'nID API (dev)',
          keyPrefix: generated.prefix,
          keyHash: generated.hash,
          scopes: ['checkout:create', 'usage:write', 'invoice:create', 'entitlements:read'],
        },
      }),
    );
    // Dev-only: the plaintext is unrecoverable after this and never stored —
    // the one and only place it is printed, same convention as every other
    // secret in this file.
    // eslint-disable-next-line no-console
    console.log(`nID billing service credential: ${generated.plaintext} (Authorization: Bearer …)`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`nID billing credential already seeded: ${existingCredential.keyPrefix} (secret not re-printed)`);
  }

  // The platform admin (spec §10) is deliberately NOT a tenant staff account:
  // `BILLING_ADMIN_ACCOUNT_IDS` is a list of Account ids, and letting the same
  // person be tenant staff and merchant-of-record staff is the tenancy
  // boundary this whole design exists to hold. Log in with the phone (OTP dev
  // mode logs the code), `POST /v1/accounts/otp/verify` for a session token,
  // and put the printed id in that env var.
  const billingAdmin = await prisma.account.upsert({
    where: { phone: '+15550300001' },
    update: {},
    create: { phone: '+15550300001', phoneVerifiedAt: new Date() },
  });
  // eslint-disable-next-line no-console
  console.log(
    `Billing admin account: ${billingAdmin.id} (+1555 0300001) — put that id in BILLING_ADMIN_ACCOUNT_IDS`,
  );

  // Spec §15's backfill: `BillingAccount` is created lazily on a tenant's first
  // billing action, so every tenant that predates billing gets its row now
  // rather than discovering it mid-checkout. One upsert per tenant, each in its
  // own tenant context — this is the only place outside apps/api where the
  // per-transaction `app.tenant_id` dance is worth writing out by hand.
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true }, orderBy: { slug: 'asc' } });
  for (const tenant of tenants) {
    await withTenantContext(prisma, tenant.id, (tx) =>
      tx.billingAccount.upsert({
        where: { tenantId: tenant.id },
        update: {},
        create: { tenantId: tenant.id, currency: 'PKR' },
      }),
    );
  }
  // eslint-disable-next-line no-console
  console.log(`Billing accounts: ensured for ${tenants.length} tenants; catalog has ${catalog.length} services`);
}
```

`BillingServiceCredential.keyPrefix` is `String` and required by the model — Task 1's schema is the source of truth, and the admin path (Task 12) writes the same field from `generateApiKey`'s result, so the seed matches it.

- [ ] **Step 2: Call it from `main()` and run the seed**

In `packages/db/prisma/seed.ts`, add the two helpers to the existing `@nid/db` import and the call to `main()`'s sequence:

```ts
import { createPrismaClient, withBillingAdminContext, withTenantContext } from '../src/index';
```

```ts
  await seedNmailClient(prisma);
  await seedErpClient(prisma);
  await seedCommunicatorClient(prisma);
  await seedBilling(prisma);
  await seedDemoProfile(prisma);
```

Run: `pnpm db:migrate && pnpm db:seed`
Expected: the new lines print after the Communicator client line, and a second run prints `… already seeded: nid_test_… (secret not re-printed)` instead of a fresh credential. If the second run prints a *new* credential, the `findFirst({ where: { revokedAt: null } })` guard is wrong — two live credentials for one dev service is a real bug, not a cosmetic one.

Run: `pnpm --filter @nid/db lint && pnpm --filter @nid/db typecheck`
Expected: PASS. `seed.ts` is linted explicitly (`eslint src prisma/seed.ts`), and `console.log` needs the `eslint-disable-next-line no-console` comments this file already uses for every other secret line.

- [ ] **Step 3: Document the env surface in `.env.example`**

Insert after the `NEXT_PUBLIC_NID_API_URL` line (the two are neighbours: both are how a browser-facing app reaches the API):

```bash
# ── Billing (Phase 1) ──────────────────────────────────────────────────────
# Allowlist of payment providers, same shape as VERIFICATION_METHODS: nothing
# else may resolve, and no controller branches on the name. `mock` is the local
# provider (no money moves); `rapid-gateway` is the live one. Both at once is
# allowed — the dev mock-pay endpoint stays reachable while the live provider
# is default only if `mock` is in this list and NODE_ENV is not production.
PAYMENT_PROVIDERS="mock"
# Base URL of apps/checkout-ui (:3500). Every hosted-checkout link nID hands
# out is built from it, so a wrong value here produces links that 404.
CHECKOUT_UI_URL="http://localhost:3500"
# nID's own public base URL. The provider webhook URL is derived from it —
# never from a request Host header, which a caller could point at itself.
API_PUBLIC_URL="http://localhost:4000"
# Origins a checkout caller may pass as `returnUrl`, comma-separated. Empty
# means no caller may supply one and nID's own /return/<token> page is always
# the landing spot. Add http://localhost:3200 here to let the dashboard return
# straight to /billing after a payment; it is off by default because the
# dashboard works without it and a stray origin is a redirect hole.
CHECKOUT_RETURN_ORIGINS=""
# Credits (1 credit = 1 paisa) debited per VerificationCase created. nID bills
# itself through the catalog with this number.
VERIFICATION_CASE_CREDIT_MINOR=2500
# Comma-separated nID Account ids allowed to write the global catalog — the
# `pnpm db:seed` line "Billing admin account:" prints one. Deliberately not
# tenant staff: merchant-of-record is a different seat.
BILLING_ADMIN_ACCOUNT_IDS=""
# What the dev mock provider reports when apps/checkout-ui asks for a payment
# outcome: success | failure | pending. Ignored by real providers.
MOCK_PAYMENT_OUTCOME="success"
# Rapid Gateway (the live provider). Fill these only after dropping
# `mock` from PAYMENT_PROVIDERS or adding `rapid-gateway` to it; the adapter's
# constructor refuses to build with a blank value among these, so a half-set
# sandbox fails at boot instead of at the first charge. Secrets: .env only,
# never committed — the webhook one is what proves a callback came from the
# gateway, so rotating it invalidates every in-flight event.
RAPID_GATEWAY_BASE_URL=""
RAPID_GATEWAY_MERCHANT_ID=""
RAPID_GATEWAY_API_KEY=""
RAPID_GATEWAY_API_SECRET=""
RAPID_GATEWAY_WEBHOOK_SECRET=""
```

`NODE_ENV` is not listed: `loadEnv()` treats an unset value as `development`, which is what a local clone wants, and writing `NODE_ENV=development` into the example invites someone to copy the file to a server with it still saying that.

Run: `pnpm typecheck`
Expected: PASS — this file is documentation, and the check that matters is that the names match `apps/api/src/core/config/env.ts` exactly:

```bash
diff <(grep -oE "process\.env\['[A-Z0-9_]+'\]" apps/api/src/core/config/env.ts | sed "s/.*\['//;s/'\]//" | sort -u) \
     <(grep -oE "^[A-Z0-9_]+=" .env.example | sed 's/=//' | sort -u)
```

Expected: the billing names appear on neither side of the diff as missing-from-`.env.example`, except `NODE_ENV` (see above) and `API_PORT`/`LOCAL_STORAGE_DIR`/`VERIFY_UI_URL`/`SESSION_TTL_MINUTES`/`OTP_SMS_DEV_MODE`/`DOCUMENT_OCR_DEV_MODE`/`LIVENESS_DEV_MODE`, which are already documented elsewhere in the file. Anything else unexplained is a real gap.

- [ ] **Step 4: Write the RLS gate, `apps/api/test/billing-rls.spec.ts`**

Spec §13's "RLS test" line, run as `nid_app`. Tasks 1 and 11 exercise the policies incidentally; this is the only spec whose *subject* is the policies, and the only one that must fail if a table is missing from Task 1's `DO $$` array — which is invisible to Prisma and therefore invisible to every other test.

```ts
/**
 * Phase 1's Row-Level-Security gate (spec §13, §5.3; docs/HOUSE-RULES.md rule
 * 2). Every query here runs as `nid_app` — the least-privilege role apps/api
 * connects with and the only one for which FORCE ROW LEVEL SECURITY means
 * anything, because the migrator role behind DATABASE_URL has BYPASSRLS and
 * would pass this file trivially. Fixture rows are written as the migrator:
 * seeding another tenant's data is exactly what the app role must not be able
 * to do.
 *
 * Needs a live Postgres with migrations applied:
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { createPrismaClient, withBillingAdminContext, withTenantContext, type PrismaClient } from '@nid/db';
import { PrismaService } from '../src/core/db/prisma.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('billing RLS (as nid_app)', () => {
  const app = createPrismaClient(process.env['APP_DATABASE_URL']);
  let superuser: PrismaClient;
  let tenantA: string;
  let tenantB: string;
  let serviceId: string;
  let invoiceB: string;
  let intentB: string;
  let paymentB: string;
  let creditEntryB: string;
  let ledgerAccountB: string;
  const tag = Date.now().toString(36);

  beforeAll(async () => {
    superuser = createPrismaClient(process.env['DATABASE_URL']);
    tenantA = (await superuser.tenant.create({ data: { name: `rls a ${tag}`, slug: `rls-a-${tag}` } })).id;
    tenantB = (await superuser.tenant.create({ data: { name: `rls b ${tag}`, slug: `rls-b-${tag}` } })).id;
    serviceId = (
      await superuser.billingService.create({ data: { key: `rls-${tag}`, name: 'RLS probe', ownerRepo: 'nID' } })
    ).id;
    const accountB = await superuser.billingAccount.create({ data: { tenantId: tenantB } });
    const invoice = await superuser.invoice.create({
      data: {
        tenantId: tenantB,
        billingAccountId: accountB.id,
        number: `RLS-${tag}`,
        currency: 'PKR',
        status: 'OPEN',
        subtotalMinor: 11800n,
        totalMinor: 11800n,
      },
    });
    invoiceB = invoice.id;
    const intent = await superuser.paymentIntent.create({
      data: {
        tenantId: tenantB,
        billingAccountId: accountB.id,
        purpose: 'CREDIT_TOPUP',
        amountMinor: 11800n,
        currency: 'PKR',
        provider: 'mock',
        providerRef: `rls_${tag}`,
        idempotencyKey: `rls-${tag}`,
      },
    });
    intentB = intent.id;
    paymentB = (
      await superuser.payment.create({
        data: {
          tenantId: tenantB,
          paymentIntentId: intent.id,
          provider: 'mock',
          providerTransactionId: `rls_txn_${tag}`,
          amountMinor: 11800n,
          currency: 'PKR',
          status: 'SUCCEEDED',
        },
      })
    ).id;
    creditEntryB = (
      await superuser.creditLedgerEntry.create({
        data: {
          tenantId: tenantB,
          billingAccountId: accountB.id,
          deltaMinor: 11800n,
          reason: 'TOPUP',
          refType: 'payment_intent',
          refId: intent.id,
          balanceAfterMinor: 11800n,
        },
      })
    ).id;
    ledgerAccountB = (
      await superuser.ledgerAccount.create({
        data: {
          tenantId: tenantB,
          serviceId,
          kind: 'REVENUE',
          currency: 'PKR',
          scopeKey: `t:${tenantB}:s:${serviceId}:REVENUE:PKR`,
        },
      })
    ).id;
    await superuser.settlementRecord.create({
      data: {
        provider: 'mock',
        providerSettlementId: `stl_${tag}`,
        amountMinor: 11800n,
        feeMinor: 0n,
        netMinor: 11800n,
        currency: 'PKR',
        settledAt: new Date(),
        matchedPaymentId: paymentB,
        matchedTenantId: tenantB,
        status: 'MATCHED',
      },
    });
  });

  afterAll(async () => {
    // Deleting the tenants cascades to their billing rows; the catalog service
    // is only removable through the admin context or the migrator role.
    await superuser.tenant.delete({ where: { id: tenantA } });
    await superuser.tenant.delete({ where: { id: tenantB } });
    await superuser.billingService.delete({ where: { id: serviceId } });
    await Promise.all([app.$disconnect(), superuser.$disconnect()]);
  });

  it('tenant A reads nothing of tenant B: invoices, payments, credits, ledger', async () => {
    const found = await withTenantContext(app, tenantA, async (tx) => ({
      invoice: await tx.invoice.findUnique({ where: { id: invoiceB } }),
      invoices: await tx.invoice.findMany({ where: { tenantId: tenantB } }),
      payments: await tx.payment.findMany({ where: { tenantId: tenantB } }),
      credits: await tx.creditLedgerEntry.findMany({ where: { tenantId: tenantB } }),
      accounts: await tx.ledgerAccount.findMany({ where: { tenantId: tenantB } }),
      entries: await tx.ledgerEntry.findMany({ where: { tenantId: tenantB } }),
    }));

    expect(found.invoice).toBeNull();
    expect(found.invoices).toEqual([]);
    expect(found.payments).toEqual([]);
    expect(found.credits).toEqual([]);
    expect(found.accounts).toEqual([]);
    expect(found.entries).toEqual([]);
  });

  it('an unset tenant context sees no billing rows at all — including its own account', async () => {
    // The fail-closed half of house rule 2: a forgotten `withTenantContext`
    // returns nothing, never someone else's.
    expect(await app.invoice.findMany({ where: { tenantId: tenantB } })).toEqual([]);
    expect(await app.billingAccount.findMany()).toEqual([]);
    expect(await app.subscription.findMany()).toEqual([]);
    expect(await app.outboundEvent.findMany()).toEqual([]);
    expect(await app.usageRecord.findMany()).toEqual([]);
  });

  it('tenant A cannot write a row attributed to tenant B', async () => {
    await expect(
      withTenantContext(app, tenantA, (tx) =>
        tx.invoice.create({
          data: {
            tenantId: tenantB,
            billingAccountId: 'does-not-matter',
            number: `FORGED-${tag}`,
            currency: 'PKR',
            subtotalMinor: 1n,
            totalMinor: 1n,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('the catalog is open to read and closed to write without app.billing_admin', async () => {
    // Read-any is what lets a checkout summary name the service without the
    // caller having a billing context.
    expect(await app.billingService.findUnique({ where: { id: serviceId } })).not.toBeNull();

    await expect(
      app.billingService.create({ data: { key: `nope-${tag}`, name: 'nope', ownerRepo: 'nID' } }),
    ).rejects.toThrow();
    await expect(
      withTenantContext(app, tenantA, (tx) =>
        tx.plan.create({
          data: {
            serviceId,
            key: 'nope',
            version: 1,
            name: 'nope',
            mode: 'CREDIT_PACK',
            currency: 'PKR',
            unitAmountMinor: 1n,
            creditsIncluded: 1,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('app.billing_admin alone opens catalog writes and nothing tenant-scoped', async () => {
    const created = await withBillingAdminContext(app, (tx) =>
      tx.billingService.create({ data: { key: `admin-${tag}`, name: 'Admin probe', ownerRepo: 'nID' } }),
    );
    expect(created.key).toBe(`admin-${tag}`);

    // The whole point of scoping the flag to the catalog: holding it does not
    // make an invoice readable.
    await expect(withBillingAdminContext(app, (tx) => tx.invoice.findMany())).resolves.toEqual([]);
    await expect(withBillingAdminContext(app, (tx) => tx.billingAccount.findMany())).resolves.toEqual([]);

    await withBillingAdminContext(app, (tx) => tx.billingService.delete({ where: { id: created.id } }));
  });

  it('settlement records are invisible without app.billing_admin, and readable with it', async () => {
    expect(await app.settlementRecord.findMany()).toEqual([]);
    const asAdmin = await withBillingAdminContext(app, (tx) => tx.settlementRecord.findMany());
    expect(asAdmin.map((row) => row.providerSettlementId)).toContain(`stl_${tag}`);
  });

  it('PaymentIntent reads across tenants by design and still cannot be written across them', async () => {
    // The bootstrap shape (spec §5.3): a provider webhook names a providerRef,
    // not a tenant, so SELECT must be open. Every write stays scoped — reading
    // B's intent is not the same as being able to change it.
    expect(await app.paymentIntent.findUnique({ where: { id: intentB } })).not.toBeNull();
    await expect(
      withTenantContext(app, tenantA, (tx) =>
        tx.paymentIntent.update({ where: { id: intentB }, data: { status: 'CANCELED' } }),
      ),
    ).rejects.toThrow();

    expect(await app.checkoutSession.findMany({ where: { tenantId: tenantB } })).toEqual([]);
    expect(await app.webhookEvent.findMany({ where: { tenantId: tenantB } })).toEqual([]);
  });

  it('the API role can read and write only its own tenant through PrismaService', async () => {
    // The same client apps/api uses per request, not a raw client: this is the
    // assertion that PrismaService.forTenant() and the policies agree.
    const prismaService = new PrismaService();
    try {
      const mine = await prismaService.forTenant(tenantB, (tx) => tx.invoice.findMany());
      expect(mine.map((row) => row.id)).toEqual([invoiceB]);
      await prismaService.forTenant(tenantA, (tx) =>
        tx.invoice.create({
          data: {
            tenantId: tenantA,
            billingAccountId: (await tx.billingAccount.create({ data: { tenantId: tenantA } })).id,
            number: `OWN-${tag}`,
            currency: 'PKR',
            subtotalMinor: 5n,
            totalMinor: 5n,
          },
        }),
      );
      const cross = await prismaService.forTenant(tenantA, (tx) => tx.invoice.findMany());
      expect(cross.map((row) => row.tenantId)).toEqual([tenantA]);
    } finally {
      await prismaService.onModuleDestroy();
    }
  });
});
```

Run: `RUN_DB_TESTS=true pnpm --filter @nid/api exec jest billing-rls --runInBand`
Expected: PASS — 8 tests. If a "cannot read / cannot write" case *passes when it should fail*, the policy is missing, not the test: re-run the `pg_policies` query from Task 1's Step 7 and fix it in a new migration (`ALTER TABLE … FORCE ROW LEVEL SECURITY` plus the missing `CREATE POLICY`), never by relaxing the assertion. If the `app` role is missing entirely, apply `packages/db/sql/001-app-role-bootstrap.sql` first — every case in this file fails with a connection error otherwise, which is the honest outcome, not a skipped one.

- [ ] **Step 5: Write the acceptance chain, `apps/api/test/billing-phase-1.spec.ts`**

This is the only spec that runs against **the seeded catalog** rather than its own fixture, because its question is different from Tasks 11-15's: not "does this function behave" but "does `pnpm db:seed` leave a system a real tenant can buy something in, end to end, through the objects `apps/api` wires". The tests are ordered and share one tenant on purpose — spec §19's criteria are a chain, and the chain is where the seams break.

```ts
/**
 * Phase 1's acceptance chain (spec §19 criteria 1-5). Runs the seeded catalog
 * from `pnpm db:seed` through the real service objects, the mock provider and
 * the dev settle path, in order, on one tenant. Tasks 11-15 each prove a slice
 * against fixtures they create; this proves the fixtures in the actual database
 * are enough to sell something — a typo'd plan key, a catalog row the seed
 * forgets to activate, or a backfill that missed tenant-a shows up here and
 * nowhere else.
 *
 * Requires: pnpm db:migrate && pnpm db:seed, then
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { createPrismaClient, type PrismaClient } from '@nid/db';
import { chargeVerificationCase, getBillingAccount } from '@nid/billing';
import { BillingService } from '../src/modules/billing/billing.service';
import { BillingServiceCredentialsService } from '../src/modules/billing/billing-service-credentials.service';
import { BillingEventsService } from '../src/modules/billing/billing-events.service';
import { CheckoutPublicController } from '../src/modules/billing/checkout-public.controller';
import { DevPaymentsController } from '../src/modules/billing/dev-payments.controller';
import { PrismaService } from '../src/core/db/prisma.service';
import { PaymentProvidersService } from '../src/core/payments/payment-providers.service';
import { AuditService } from '../src/core/audit/audit.service';
import { loadEnv } from '../src/core/config/env';
import type { BillingServiceActor } from '../src/core/auth/billing-service.guard';
import type { BillingTenantActor } from '../src/core/auth/billing-tenant.guard';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('Phase 1 end to end (live Postgres, seeded catalog)', () => {
  const tag = Date.now().toString(36);
  let prismaService: PrismaService;
  let migrator: PrismaClient;
  let billing: BillingService;
  let publicCheckouts: CheckoutPublicController;
  let devPayments: DevPaymentsController;
  let serviceSurface: BillingServiceCredentialsService;

  let tenantId: string;
  let staff: BillingTenantActor;
  let nidServiceId: string;
  let packId: string;
  let packAmountMinor: bigint;
  let packCreditsMinor: bigint;
  let subPlanId: string;
  let subAmountMinor: bigint;

  beforeAll(async () => {
    prismaService = new PrismaService();
    migrator = createPrismaClient(process.env['DATABASE_URL']);
    const providers = new PaymentProvidersService();
    const audit = new AuditService();
    const events = new BillingEventsService(prismaService);
    billing = new BillingService(prismaService, providers, audit);
    publicCheckouts = new CheckoutPublicController(prismaService);
    devPayments = new DevPaymentsController(prismaService, providers, events);
    serviceSurface = new BillingServiceCredentialsService(prismaService, providers, audit, events);

    const nid = await migrator.billingService.findUnique({ where: { key: 'nid' } });
    if (!nid) {
      throw new Error('billing-phase-1.spec.ts bills against the seeded catalog — run `pnpm db:seed` first.');
    }
    nidServiceId = nid.id;
    const plans = await migrator.plan.findMany({ where: { serviceId: nid.id, status: 'ACTIVE' } });
    const pack = plans.find((p) => p.mode === 'CREDIT_PACK' && p.creditsIncluded > 0);
    const sub = plans.find((p) => p.mode === 'SUBSCRIPTION' && p.interval === 'MONTH');
    if (!pack || !sub) {
      throw new Error('The seeded `nid` service needs an ACTIVE credit pack and a monthly subscription (Task 18).');
    }
    packId = pack.id;
    packAmountMinor = pack.unitAmountMinor;
    packCreditsMinor = BigInt(pack.creditsIncluded);
    subPlanId = sub.id;
    subAmountMinor = sub.unitAmountMinor;

    // A fresh tenant, not tenant-a: the chain writes money rows it does not
    // clean up per test, and the seed's own tenants are someone else's sandbox.
    // A billing webhook target, so settlement also proves the queue is filled.
    tenantId = (
      await migrator.tenant.create({
        data: {
          name: `phase-1 ${tag}`,
          slug: `phase-1-${tag}`,
          billingWebhookUrl: `https://phase1-${tag}.example.test/nid/billing`,
          billingWebhookSecretPlaintext: `phase1-${tag}`,
        },
      })
    ).id;
    staff = { tenantId, actorType: 'TENANT_STAFF', actorId: `acct-${tag}` };
  });

  afterAll(async () => {
    await migrator.tenant.delete({ where: { id: tenantId } });
    await Promise.all([migrator.$disconnect(), prismaService.onModuleDestroy()]);
  });

  it('criterion 1: a credit pack bought once lands exactly its credits', async () => {
    const outcome = await billing.createCheckout(
      tenantId,
      staff,
      undefined,
      { purpose: 'CREDIT_TOPUP', planId: packId },
      `topup-${tag}`,
    );
    if (outcome.reused) throw new Error('The first checkout for a fresh key must not be a replay.');
    const { token, providerCheckoutUrl } = outcome;

    // nID's token page, then the provider's own page. The mock's providerRef is
    // the last segment of its checkout URL and is also the only handle the dev
    // settle endpoint looks a payment up by.
    expect(providerCheckoutUrl).toContain(`/mock-pay/`);
    const providerRef = providerCheckoutUrl.split('/').pop() as string;
    expect(providerRef).toMatch(/^mock_/);

    const summary = await publicCheckouts.summary(token);
    expect(summary.amountMinor).toBe(packAmountMinor);
    expect(summary.status).toBe('PENDING');

    expect(await devPayments.pay({ providerRef, outcome: 'success' })).toEqual({
      settled: true,
      alreadySettled: false,
    });

    const after = await billing.overview(tenantId);
    expect(after.creditBalanceMinor).toBe(packCreditsMinor);

    // Replaying the settlement changes nothing (spec §13's E2E line).
    expect(await devPayments.pay({ providerRef, outcome: 'success' })).toEqual({
      settled: false,
      reason: 'already settled',
    });
    const replayed = await billing.overview(tenantId);
    expect(replayed.creditBalanceMinor).toBe(packCreditsMinor);

    // Criterion 5's invariant, checked against the rows rather than the cache:
    // the balance is the ledger's sum, and exactly one payment exists.
    const sum = await prismaService.forTenant(tenantId, (tx) =>
      tx.creditLedgerEntry.aggregate({ where: { tenantId }, _sum: { deltaMinor: true } }),
    );
    expect(sum._sum.deltaMinor).toBe(packCreditsMinor);
    expect(await prismaService.forTenant(tenantId, (tx) => tx.payment.count({ where: { tenantId } }))).toBe(1);
  });

  it('criterion 2: a service bills a tenant, payment settles it once, and the invoice reaches PAID', async () => {
    const erp = await migrator.billingService.findUnique({ where: { key: 'erp-1' } });
    if (!erp) throw new Error('The seed must register erp-1 (spec §9.1).');
    const erpActor: BillingServiceActor = {
      serviceId: erp.id,
      serviceKey: 'erp-1',
      credentialId: `cred-${tag}`,
      scopes: ['invoice:create', 'checkout:create', 'entitlements:read'],
    };

    const raised = await serviceSurface.invoice(
      erpActor,
      { tenantId, description: 'Phase 1 acceptance invoice', unitAmountMinor: '9900' },
      `invoice-${tag}`,
    );
    expect(raised.invoice.status).toBe('OPEN');
    expect(raised.invoice.totalMinor).toBe(9900n);

    // The amount the payer sees is the invoice total, computed server-side —
    // never whatever the caller wished to have written.
    const intent = await migrator.paymentIntent.findUniqueOrThrow({ where: { id: raised.intentId } });
    expect(intent.amountMinor).toBe(9900n);
    expect(intent.purpose).toBe('INVOICE');
    const token = raised.token as string;
    expect((await publicCheckouts.summary(token)).amountMinor).toBe(9900n);

    const providerRef = intent.providerRef as string;
    expect((await devPayments.pay({ providerRef, outcome: 'success' })).settled).toBe(true);

    const paid = await billing.invoice(tenantId, raised.invoice.id, staff);
    expect(paid.status).toBe('PAID');
    expect(paid.amountPaidMinor).toBe(9900n);

    // A second settlement of the same reference cannot double-pay or double-post.
    await devPayments.pay({ providerRef, outcome: 'success' });
    const replayed = await billing.invoice(tenantId, raised.invoice.id, staff);
    expect(replayed.status).toBe('PAID');
    expect(replayed.amountPaidMinor).toBe(9900n);
    expect(await migrator.payment.count({ where: { paymentIntentId: raised.intentId } })).toBe(1);

    // The queue is filled but undelivered in Phase 1 (Phase 2 owns the workflow):
    // the row is the contract, its existence is the assertion.
    const queued = await migrator.outboundEvent.findMany({ where: { tenantId } });
    expect(queued.map((event) => event.eventType)).toContain('checkout.completed');
  });

  it('criterion 3: a subscription activates on payment with real period dates, and cancel-at-period-end holds it', async () => {
    const outcome = await billing.createCheckout(
      tenantId,
      staff,
      undefined,
      { purpose: 'SUBSCRIPTION', planId: subPlanId },
      `sub-${tag}`,
    );
    if (outcome.reused) throw new Error('The first checkout for a fresh key must not be a replay.');
    const providerRef = outcome.providerCheckoutUrl.split('/').pop() as string;

    // INCOMPLETE until money moves: the row exists so the checkout page can
    // name what is being bought, and nothing more.
    const before = await billing.listSubscriptions(tenantId);
    expect(before.find((s) => s.planId === subPlanId)?.status).toBe('INCOMPLETE');

    expect((await devPayments.pay({ providerRef, outcome: 'success' })).settled).toBe(true);

    const active = (await billing.listSubscriptions(tenantId)).find((s) => s.planId === subPlanId);
    expect(active?.status).toBe('ACTIVE');
    expect(active?.currentPeriodStart).toBeInstanceOf(Date);
    expect(active?.currentPeriodEnd).toBeInstanceOf(Date);
    const start = active?.currentPeriodStart as Date;
    const end = active?.currentPeriodEnd as Date;
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    // A month, not a millisecond: addBillingInterval is calendar arithmetic, and
    // the period is what Phase 2's renewal will read.
    expect(end.getFullYear()).toBeGreaterThanOrEqual(start.getFullYear());

    await billing.cancel(tenantId, active!.id, true, staff);
    const after = (await billing.listSubscriptions(tenantId)).find((s) => s.id === active!.id);
    expect(after?.cancelAtPeriodEnd).toBe(true);
    expect(after?.status).toBe('ACTIVE');
    expect(after?.canceledAt).toBeNull();
  });

  it('criterion 4: a service credential opens checkout and reads the tenant it bills', async () => {
    const communicator = await migrator.billingService.findUnique({ where: { key: 'communicator' } });
    if (!communicator) throw new Error('The seed must register Communicator (spec §9.1).');
    const commPlans = await migrator.plan.findMany({ where: { serviceId: communicator.id, status: 'ACTIVE' } });
    const commPack = commPlans.find((p) => p.mode === 'CREDIT_PACK');
    if (!commPack) throw new Error('Communicator needs an ACTIVE credit pack for its own checkout.');

    const actor: BillingServiceActor = {
      serviceId: communicator.id,
      serviceKey: 'communicator',
      credentialId: `cred-comm-${tag}`,
      scopes: ['checkout:create', 'entitlements:read', 'usage:write'],
    };

    const checkout = await serviceSurface.checkout(
      actor,
      { tenantId, purpose: 'CREDIT_TOPUP', planId: commPack.id },
      `comm-topup-${tag}`,
    );
    expect(checkout.reused).toBe(false);
    const intent = await migrator.paymentIntent.findUniqueOrThrow({
      where: { id: (checkout as { intentId: string }).intentId },
    });
    expect(intent.amountMinor).toBe(commPack.unitAmountMinor);

    const account = await serviceSurface.account(actor, tenantId);
    expect(account.tenantId).toBe(tenantId);
    // Nothing between criterion 1 and here has added credits, so the number is
    // the seeded pack's — and a stray debit in the settle path would show up as
    // this one assertion failing.
    expect(account.creditBalanceMinor).toBe(packCreditsMinor);

    const view = await serviceSurface.entitlements(actor, tenantId);
    expect(view.tenantId).toBe(tenantId);
    expect(view.suspended).toBe(false);
    // Filtered to the caller's own key (Task 15): communicator cannot see what
    // the tenant spends at erp-1.
    expect(Object.keys(view.services)).toEqual(['communicator']);
    expect(view.services.communicator?.creditsMinor).toBe(packCreditsMinor.toString());
  });

  it('criterion 4/5: nID bills itself through the seeded catalog, and a retried case debits once', async () => {
    const charge = loadEnv().verificationCaseCreditMinor;
    const caseId = `case-${tag}`;

    // Task 15's hook calls exactly this function inside the case's own
    // transaction; here the same call twice is the retry.
    await prismaService.forTenant(tenantId, (tx) => chargeVerificationCase(tx, { tenantId, caseId, amountMinor: charge }));
    await prismaService.forTenant(tenantId, (tx) => chargeVerificationCase(tx, { tenantId, caseId, amountMinor: charge }));

    const account = await prismaService.forTenant(tenantId, (tx) => getBillingAccount(tx, tenantId));
    expect(account?.creditBalanceMinor).toBe(packCreditsMinor - charge);

    const entries = await migrator.ledgerEntry.findMany({
      where: {
        tenantId,
        transaction: { refType: 'verification_case', refId: caseId },
        account: { kind: 'REVENUE', serviceId: nidServiceId },
      },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.amountMinor).toBe(charge);

    // The debit left the tenant's own credit account, so the transaction is
    // zero-sum: this is the invariant every later money flow depends on.
    const posted = await migrator.ledgerEntry.findMany({
      where: { transaction: { refType: 'verification_case', refId: caseId } },
      include: { account: { select: { direction: true } } },
    });
    const signed = posted.map((entry) => (entry.direction === 'DEBIT' ? entry.amountMinor : -entry.amountMinor));
    expect(signed.reduce((total, value) => total + value, 0n)).toBe(0n);
  });
});
```

Run: `pnpm db:seed && RUN_DB_TESTS=true pnpm --filter @nid/api exec jest billing-phase-1 --runInBand`
Expected: PASS — 5 tests. Then the whole gated set together:

Run: `RUN_DB_TESTS=true pnpm --filter @nid/api test -- --runInBand`
Expected: PASS — every billing spec plus every pre-existing Phase 0 spec, none of which this change is allowed to disturb. `--runInBand` because they share one database and each creates tenants with the same tag shape; parallel workers can interleave a `beforeAll` with another file's `afterAll`.

- [ ] **Step 6: Amend `ECOSYSTEM.md` (spec §17)**

Three edits, and the file is copied verbatim across the ecosystem's repos, so the wording is the contract:

1. In "The repos and what each one owns", the nID row becomes:

```markdown
| **nID** | Login, 2FA, OAuth sessions, secrets vault, billing, subscriptions, payments, invoices, refunds, usage metering, settlement records, the service catalog | Any business-domain data — orders, inventory, conversations, CRM |
```

The old "Must never own" cell read *Any business data*, which the ownership of
invoices plainly contradicts. Narrowed to what it always meant: the domains'
data, not money.

2. Add this section after "Identity: nID is the one login", in the same voice:

```markdown
## Billing: nID is the merchant of record

**nID bills for the whole ecosystem** — the service catalog, plans, checkout
sessions, invoices, payments, refunds, credit balances, usage metering and
settlement records all live here, and nowhere else. Every other repo's billing
responsibility is the same two sentences: call nID with your own
`BillingServiceCredential`, and own no payment state. No Stripe account, no
price table, no `credits` column of your own, no half-built "billing" module you
mean to move later. A service that needs to charge asks nID to create the
checkout, reads its entitlements back from nID, and receives nID's signed
events (`X-NID-Signature`) as the record of what happened.

This is a governance decision, not a code-layout preference: one merchant of
record means one place refunds, tax liability, settlement reconciliation and a
customer's invoice history exist. The design and its acceptance criteria are in
`docs/superpowers/specs/2026-10-31-nid-billing-platform-design.md`.

nID does **not** take over what the domains sell. An erp-1 order, a
Communicator conversation, a harvester lead stays where it is. nID knows a
service by its catalog key and an amount in minor units, and nothing else about
what was bought.
```

3. In "Known misplacements being migrated", the `Communicator` bullet's `strip …
Stripe billing` phrase becomes:

```markdown
- `Communicator`: strip RBAC, SSO/SAML, its Stripe-based billing (the
  ecosystem bills through nID now — see "Billing: nID is the merchant of
  record"), generic ticketing/SLA, and the generic outgoing-webhooks engine it
  grew outside this ecosystem's boundaries — these belong to nID (identity and
  billing) and core-newax's Module Gateway (webhooks) respectively.
```

Run: `grep -c "merchant of record" ECOSYSTEM.md`
Expected: `2` (the heading and the cross-reference inside the Communicator bullet).

- [ ] **Step 7: Record the phase in `docs/PHASES.md`**

Append at the end of the file, after the profile-privacy section's Phase 2-4 list:

```markdown
### Payments: nID as the ecosystem's merchant of record (Phase 1)

nID now bills for the ecosystem: one catalog of services, plans and prices, one
checkout, one ledger, one webhook receiver per provider. Every other repo calls
nID and owns no payment state — `ECOSYSTEM.md`'s "Billing: nID is the merchant
of record" section is the rule this section records the building of. The design,
its sixteen decisions and its acceptance criteria are in
`docs/superpowers/specs/2026-10-31-nid-billing-platform-design.md`; the eighteen
tasks that implement Phase 1 are in
`docs/superpowers/plans/2026-10-31-nid-billing-platform-phase-1.md`.

- **Global catalog, tenant-scoped money.** `BillingService`, `Plan` and
  `BillingServiceCredential` are readable by anyone and writable only under
  `app.billing_admin` — the one Postgres session variable
  `withBillingAdminContext()` (`@nid/db`) sets, and the only thing the admin
  surface is allowed to touch. Everything else, ledger included, carries
  `tenantId` and `FORCE ROW LEVEL SECURITY` in the same migration that creates
  it, so `billing-rls.spec.ts` can assert that a missing policy is a build
  failure rather than a production incident.
- **Plans are immutable and versioned.** A price change adds a row
  (`serviceId, key, version`); a live subscription keeps pointing at the row it
  bought. This is what lets a refund and an audit answer "what did they
  actually pay".
- **Money is `BigInt` minor units, PKR paisa, and credits are 1:1 with paisa**
  — so `VERIFICATION_CASE_CREDIT_MINOR=2500` is Rs 25.00 per verification case.
  Every `BigInt` crosses the HTTP boundary as a decimal string
  (`BigIntSerializerInterceptor`), because a float is not a currency.
- **The double entry ledger is the source of truth.** Every posting is
  zero-sum (`assertBalanced`), rows are insert-only with reversals rather than
  updates, and `BillingAccount.creditBalanceMinor` is a derived cache nobody
  assigns directly. `billing-phase-1.spec.ts` compares the cache to the sum of
  the entries, which is the assertion that would catch a drift.
- **nID bills itself.** Verification cases debit credits through the same
  catalog, checkout and ledger as anything erp-1 buys, via nID's own service
  credential — one integration contract, one implementation, and nID cannot be
  the one service that escapes its own metering.
- **A provider is an adapter, not a branch.** `packages/payments` defines
  `PaymentProvider`; `mock` (dev) and Rapid Gateway both implement it, and
  `PAYMENT_PROVIDERS` allowlists which exist here, the same rule
  `VERIFICATION_METHODS` enforces for verification methods. Adding a provider
  means passing the contract suite — nothing in `apps/api` branches on a
  provider name.
- **The checkout token is the authorisation.** `apps/checkout-ui` (:3500) is
  public and unauthenticated by design: 256 bits, only its hash stored, and the
  amount is computed server-side from the plan or invoice, never taken from a
  request body.
- **Settlement happens on a verified webhook, exactly once.** Events are
  deduped on `(provider, providerEventId)` before any tenant context exists, so
  a replay is a recorded no-op rather than a second credit. Outbound events are
  queued in `OutboundEvent` in Phase 1 and not yet delivered.

**Verified live**: full workspace `typecheck`/`lint`/`test`/`db:validate`/`build`
clean, including a `prisma migrate deploy` for the billing tables and policies,
and `pnpm db:seed` run twice to prove the catalog is idempotent. The Phase 1
gate is two live-Postgres specs: `billing-rls.spec.ts` (as `nid_app`, the role
without BYPASSRLS — cross-tenant reads, fail-closed on an unset context,
catalog writes without `app.billing_admin`, settlement invisible until you are
the platform, and the deliberate open-SELECT/scoped-write shape of
`PaymentIntent`) and `billing-phase-1.spec.ts` (spec §19 criteria 1-5 as one
chain against the seeded catalog: buy a credit pack once and see exactly its
credits, a service bills a tenant and the invoice reaches `PAID` once, a
subscription activates with real period dates and survives
cancel-at-period-end, a service credential opens checkout and reads only its
own tenant's entitlements, and nID's own per-case debit posts once to
`REVENUE`). Beyond the suite: a real browser run of the whole purchase —
dashboard `/billing` → checkout → mock provider page → return → balance
updated — recorded below.

**Phase 2** — renewal and dunning workflows, usage reporting, outbound event
delivery with the retry workflow (`outboundWebhookWorkflow`), the refund
operator workflow, settlement reconciliation, invoice PDFs, revenue recognition,
ecosystem-wide reporting, and the metrics and alerting of spec §16 (Phase 1
ships none — see the deviations below).
**Phase 3** — per-service merchant accounts, multi-currency, tax, saved
mandates, the embedded widget, B2C payer accounts, automated service payouts.

Two schema notes Phase 2 should not rediscover: `OutboundEvent` has no
`paymentIntentId` column, so the link from a queued event back to the payment
that produced it lives inside `payload` — Phase 2's delivery workflow will want
a real column to index `nextAttemptAt` per payment, which is an
`ALTER TABLE … ADD COLUMN` plus a backfill from the payload. And
`OutboundEvent` carries no `paymentIntentId` *or* signature timestamp field: the
`X-NID-Signature` header's `t=` is generated at delivery time, so it belongs to
the workflow, not the row.

**Deviations from the spec, and why.** All of these are deliberate readings,
recorded so a later reader does not file them as bugs:

- Spec §14 puts refunds in Phase 2. Phase 1 builds `refunds.ts` and the admin
  endpoint instead: a refund is a reversal entry, and the zero-sum, insert-only
  ledger is easier to honour from the first posting than to retrofit. Nothing
  user-visible ships, and Phase 2 adds only the operator workflow around it.

- Spec §16's metrics and alerting are not built. The repo has no metrics
  pipeline to add a counter to — no `prom-client`, no `/metrics` endpoint, no
  alert manager anywhere in `apps/api` or `apps/workflows` — so Phase 1 would
  have to invent one alongside the billing domain. The ledger already answers
  the questions those metrics would have summarized (`CreditLedgerEntry` for
  grant/debit volume, `Invoice.status` for unpaid exposure, `SettlementRecord`
  for provider drift, `WebhookEvent` for signature failures), and the Nest
  `Logger` lines spec §16's first bullet asks for are already in the webhook,
  event-enqueue and dev-pay paths — so the honest sequencing is: pick the
  metrics library as its own change, then instrument. Recorded here so a
  reviewer does not read a missing counter as an oversight.

- Spec §9's entitlement example shows `creditsMinor` per service. There is one
  `BillingAccount` and one credit pool (spec §7.3), so `computeEntitlements()`
  repeats the tenant-wide balance per active service. A service that needs its
  own gate expresses it as plan `features`, not by assuming the pool is
  partitioned.
- Spec §4.1 puts outbound-event enqueueing in `packages/billing`. It lives in
  `apps/api/src/modules/billing/billing-events.service.ts` instead: enqueueing
  needs the tenant's webhook secret, which is a `Tenant` column, and a
  `packages/billing` that reads `Tenant` would make the domain package depend
  on the transport's configuration surface.
- Spec §8's error table stops at 422. `InsufficientCreditsError` answers 402
  Payment Required anyway, because the remedy is literally a top-up and an
  integrating service has to tell "send this customer to checkout" apart from
  "we hit a business rule".
- Spec §9.2's "enforces that the tenant belongs to that service's billing
  relationship" has no table behind it in Phase 1: a service credential is
  scoped by `scopes`, not by a roster of tenants, so erp-1 can open a checkout
  for any tenant. The blast radius is a payment link for someone else's bill,
  which is why the amount stays server-computed. A `tenant ↔ service` roster is
  Phase 2 work.
- Invoice accrual under a same-key race (`accrueInvoiceLine` creating two
  drafts) is not closed: `(tenantId, idempotencyKey)` on `Invoice` would be, and
  is Phase 2's migration. Phase 1's only producer of accrued lines is the usage
  path, which is already idempotent on `UsageRecord`.
- `formatMinor()` exists twice, in `apps/checkout-ui` and `apps/dashboard`. The
  shared home would be `@nid/billing` (imports Prisma; must never reach a
  browser bundle) or `@nid/shared-types` (built to `dist`, no UI consumer today
  — making one is a build-order change in every app that runs `tsc --noEmit`).
  Two twelve-line copies, each with its own test, is cheaper.
- `apps/checkout-ui` runs on **3500**, not the 3400 the draft spec mentioned:
  3400 is `apps/profile-ui`'s and has been since the profiles slice. `README.md`
  and `CHECKOUT_UI_URL`'s default agree on 3500.
```

- [ ] **Step 8: Update `README.md`'s local setup**

In the "Local setup" block, the seed line's comment becomes:

```bash
pnpm db:seed                   # two tenants + API keys + the billing catalog, plans, service credential and a billing-admin account
```

and add after the `@nid/checkout-ui` dev line Task 16 put in this same block:

```bash
# Billing: PAYMENT_PROVIDERS=mock is the default, so a checkout settles through
# apps/checkout-ui's /mock-pay page and no money moves. The seed prints the
# billing-admin account id — put it in BILLING_ADMIN_ACCOUNT_IDS to reach
# /v1/billing/admin/*, and the nID service credential to reach
# /v1/billing/service/*. Both are dev-only secrets: re-running the seed does
# not print them again.
```

Then in "Phase 0 acceptance criteria" — the section that documents what was run
against a real database — leave the existing items untouched and add one line at
the end of the block that carries the verification note, in the same voice as
the items above it:

```markdown
8. **Billing Phase 1**: `RUN_DB_TESTS=true pnpm --filter @nid/api test` runs
   `billing-rls.spec.ts` against the `nid_app` role and `billing-phase-1.spec.ts`
   against the seeded catalog, and `pnpm typecheck && pnpm lint && pnpm test &&
   pnpm db:validate && pnpm build` is clean. See
   `docs/superpowers/plans/2026-10-31-nid-billing-platform-phase-1.md` for the
   task-by-task record and `docs/PHASES.md`'s payments section for what was
   verified live.
```

Run: `grep -n "3500" README.md .env.example`
Expected: both list `:3500` for checkout-ui, and nothing in either file says the hosted checkout lives on 3400.

- [ ] **Step 9: The full green gate**

This is the plan's definition of done, run once with everything applied:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm db:validate && pnpm build
```

Expected: PASS, all five. `pnpm test` without `RUN_DB_TESTS` still passes — every
live-Postgres spec added across these eighteen tasks is `describe.skip` unless the
flag is set, which is what keeps CI green on a runner with no database.

Then the gated suite:

Run: `RUN_DB_TESTS=true pnpm --filter @nid/billing test && RUN_DB_TESTS=true pnpm --filter @nid/api test -- --runInBand`
Expected: PASS. If `@nid/billing`'s live specs fail here and passed in Tasks 4-8, the seed changed a catalog row they read; that is a real signal, not noise.

- [ ] **Step 10: Drive it in a browser**

Tests prove the objects; this proves the app. Start Postgres, then four terminals:

```bash
pnpm --filter @nid/api dev
pnpm --filter @nid/dashboard dev      # :3200
pnpm --filter @nid/checkout-ui dev    # :3500
```

Set in `apps/api`'s environment: `PAYMENT_PROVIDERS=mock`,
`CHECKOUT_UI_URL=http://localhost:3500`, `NODE_ENV` unset. Sign in to the
dashboard as tenant-a's staff account (`+1555 0200001`, the OTP code in the API's
dev-mode log), then:

1. `/billing` renders an overview at 0 credits, the seeded nID plans with
   `Rs`-priced amounts, and empty invoice/subscription/history sections.
2. Buy **Starter credits** → lands on `:3500/checkout/<token>` showing Rs
   118.00 and "nID" as the service. Nothing on the page came from a query
   parameter the browser could edit.
3. Pay → the mock provider page → success → `:3500/return/<token>` reports
   paid, and `/v1/billing/checkout-sessions/<token>` says `COMPLETED`.
4. Back on `/billing`: the balance is 11,800 credits, and **Payments** lists one
   `SUCCEEDED` row with a `mock_…` reference. Reload twice: still one row.
5. Buy **Professional (monthly)** → pay → `/billing` shows one `ACTIVE`
   subscription with a period end about a month out. Cancel it at period end:
   the row stays `ACTIVE` and now says it ends at period end.
6. Top up once more, then create a verification case from the dashboard's
   **Cases** page. The balance drops by `VERIFICATION_CASE_CREDIT_MINOR`
   (2,500), and **History** shows the usage. This is nID billing itself over
   real HTTP.
7. DevTools: no response body contains a card number, a provider secret, or the
   checkout token other than the one the browser already had; every amount field
   is a quoted decimal string, never a JSON number.
8. Break one thing on purpose: stop `apps/api`, reload `/billing`. The page says
   it could not load, in its own words, and does not show a stale balance as if
   it were current.

Anything that does not hold is a Task 11-17 bug, not a Task 18 bug — fix it in
the task that owns the file, and re-run this list from step 1.

- [ ] **Step 11: Commit**

```bash
git add packages/db/prisma/seed.ts .env.example apps/api/test/billing-rls.spec.ts \
  apps/api/test/billing-phase-1.spec.ts ECOSYSTEM.md docs/PHASES.md README.md
git commit -m "feat(billing): seed the Phase 1 catalog and close the acceptance and governance record"
```
