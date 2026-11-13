# nID Billing Platform — Design

**Status:** Draft for review
**Date:** 2026-10-31
**Owner:** NEWAX Engineering
**Scope:** nID becomes the single billing system of record for the NEWAX ecosystem.

---

## 1. Context

The NEWAX ecosystem (nID, core-newax, erp-1, newcom, Communicator, harvester,
AegisDesk) currently has no shared billing system. Payments, if they exist at
all, are per-repo. The decision is to make **nID the one place that accepts
payments and stores subscriptions, invoices, payments, refunds, usage and
settlement records for every NEWAX service**.

The payment rail is **Rapid Gateway** (Pakistan): hosted checkout covering
cards (Visa/Mastercard), Raast QR, JazzCash/easypaisa wallets and bank
transfers through one merchant account. nID is the **merchant of record** and
attributes revenue to the owning ecosystem service in its ledger.

This is a deliberate amendment to `ECOSYSTEM.md`, which currently states nID
"must never own any business data". Billing moves into nID because the
requirement is one place for all subscription and payment records, and nID
already owns the tenant, identity, API-key and signed-webhook primitives the
billing system needs. The exception is recorded in §17.

### 1.1 Goals

- One hosted checkout for every NEWAX product, paid in PKR.
- Subscription plans, prepaid credits, and one-off invoices — all three.
- A double-entry ledger that is the authoritative record of money movement,
  with per-service revenue attribution.
- Service-to-service APIs so any NEWAX repo can bill a tenant without owning
  payment state.
- Signed outbound events so services react to payment outcomes.
- Tenant-facing billing UI and an internal admin surface for catalog/refunds.
- PCI scope limited to SAQ A: nID never touches card data.

### 1.2 Non-goals (Phase 1)

- Storing or transmitting card data. Hosted checkout only.
- Multi-currency. PKR only; every money row still carries a currency code.
- Tax calculation engine. Fields and ledger accounts exist; the amount is 0
  until tax treatment is confirmed.
- Automated bank payouts to ecosystem services. Revenue attribution is
  reported from the ledger; movement happens outside the system.
- Credit expiry, proration, coupons, trials, dunning email copy, invoice PDFs,
  embedded checkout widget, B2C payers (`Account` as billing account).
- Per-service merchant accounts. The ledger and provider config are modeled
  per service so this can be switched on later without a schema change.

---

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Modular monolith inside nID: `packages/payments`, `packages/billing`, new `apps/api` modules, `apps/checkout-ui`, billing pages in `apps/dashboard` | Matches the repo's modular-monolith-first architecture and reuses Tenant/RLS/API keys/webhooks/Temporal. No second deploy or auth path. |
| D2 | nID is merchant of record; one Rapid Gateway merchant account | Chosen by product. Ledger attributes revenue per service internally. |
| D3 | Billing account = `Tenant`; payer is a tenant staff member (`AccountSession` + `TenantStaffMembership`) | Every NEWAX product currently sells to organizations. B2C payer is deferred. |
| D4 | Double-entry, append-only ledger as the source of truth; no balance is ever updated in place except a derived cache | Financial records must reconcile. Corrections are reversing entries. |
| D5 | Hosted redirect checkout, no card data in nID | Keeps PCI scope at SAQ A. |
| D6 | Provider abstraction (`PaymentProvider`) with a Rapid Gateway adapter and a dev mock, selected by `PAYMENT_PROVIDERS` allowlist | Mirrors `VerificationMethodProvider`; the mock keeps the whole system testable without sandbox credentials. |
| D7 | Money stored as `BigInt` minor units + ISO currency; no floats | Correctness. |
| D8 | Temporal for renewal, dunning, reconciliation and outbound-webhook retries | Long-running flows are workflows, per house rule 5. |
| D9 | Catalog is global; only nID admin may write it (`app.billing_admin` RLS context + `BILLING_ADMIN_ACCOUNT_IDS` allowlist) | Tenants consume plans; they do not define them. |
| D10 | Service credentials are hashed keys with scopes, separate from `TenantApiKey` | Ecosystem services act on behalf of themselves, not as a tenant. |
| D11 | Plan rows are immutable and versioned; subscriptions pin `planId` | A price change must not rewrite existing subscriptions. |
| D12 | Entitlements are computed on read from active subscriptions + credit ledger | Same pattern as verification badges; no sync table to drift. |

---

## 3. Terminology

- **Service** — an ecosystem product that can bill (`erp-1`, `communicator`, …).
- **Plan** — a priced offer for one service: credit pack, subscription, or one-off.
- **Billing account** — the paying entity, 1:1 with a `Tenant`.
- **Entitlement** — what a tenant may use for a service: features, limits, credits.
- **Payment intent** — one attempt to collect a specific amount for a purpose.
- **Checkout session** — the hosted, token-addressed page wrapper around an intent.
- **Ledger transaction** — an atomic set of debit/credit lines that sums to zero.

---

## 4. Architecture

```
apps/checkout-ui (:3500)            apps/dashboard (billing pages)
        │ checkout token                 │ AccountSession + TenantStaffMembership
        ▼                                ▼
┌──────────────────────────────────────────────────────────────┐
│ apps/api  modules/billing/                                   │
│   catalog · checkout · invoices · subscriptions · credits    │
│   usage · entitlements · webhooks · refunds · admin          │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
       packages/billing                 packages/payments
   domain, invoice engine,          PaymentProvider interface,
   ledger, entitlement computation  RapidGatewayProvider, MockProvider,
               │                    registry (PAYMENT_PROVIDERS)
               │                               │
               └──────────────┬────────────────┘
                              ▼
                       packages/db (Prisma + RLS)

apps/workflows (Temporal): subscriptionBillingWorkflow,
dunningWorkflow, outboundWebhookWorkflow, reconciliationWorkflow
```

Dependency rules:

- `packages/payments` knows nothing about invoices or tenants; it accepts a
  charge request and returns provider state.
- `packages/billing` depends on `@nid/db`, `@nid/payments`,
  `@nid/shared-types`. It contains the domain and can be exercised by both
  `apps/api` and `apps/workflows`.
- `apps/api` contains transport only: validation, guards, mapping to domain calls.
- No controller branches on provider name; the registry resolves it.

### 4.1 Packages

**`packages/payments`**

- `types.ts` — `PaymentProvider`:
  - `createCheckout(input)` → `{ providerRef, checkoutUrl, expiresAt }`
  - `fetchPayment(providerRef)` → canonical status
  - `verifyWebhook(rawBody, headers)` → boolean
  - `parseWebhook(rawBody)` → `{ providerEventId, type, providerRef, status, paidAmountMinor, currency, methodType, raw }`
  - `refund(input)` → `{ providerRef, status }`
  - `createCheckout` never receives card data; only amount, currency,
    description, provider reference, return URL and webhook URL.
- `rapid-gateway.provider.ts` — adapter. Endpoint paths, payload shape and
  signature algorithm come from the Rapid Gateway docs (see §18). Until those
  exist, the class implements the interface against a documented mapping in
  `docs/vendors/rapid-gateway/` and is exercised by contract tests.
- `mock.provider.ts` — deterministic: `MOCK_PAYMENT_OUTCOME=success|failure|pending`
  and a dev-only page that posts a signed webhook.
- `registry.ts` — resolves provider from `PAYMENT_PROVIDERS`, throws on unknown.

**`packages/billing`**

- `money.ts` — minor-unit helpers, currency validation, no floats.
- `ledger.ts` — `postTransaction(tx, lines)`, zero-sum invariant, account lookup.
- `catalog.ts`, `accounts.ts`, `subscriptions.ts`, `invoices.ts`,
  `credits.ts`, `usage.ts`, `checkout.ts`, `entitlements.ts`, `events.ts`.
- Every state-changing operation runs inside a caller-supplied transaction so
  it can compose with RLS tenant context.

---

## 5. Domain model

All tenant-owned tables carry `tenantId` and get `ENABLE` + `FORCE ROW LEVEL
SECURITY` with a `tenant_isolation` policy in the same migration that creates
them (house rule 2). Bootstrap-lookup tables follow the documented
open-SELECT/scoped-write pattern (`TenantApiKey`, `VerificationSession`).

All amounts are `BigInt` minor units. All rows carry `currency` where money is
stored. Timestamps are UTC.

### 5.1 Global catalog (no tenant scope)

**BillingService**
`id`, `key` (unique, e.g. `erp-1`), `name`, `ownerRepo`, `status`
(`ACTIVE|INACTIVE`), `createdAt`, `updatedAt`.

**Plan** (immutable, versioned)
`id`, `serviceId`, `key`, `version`, `name`, `description`, `mode`
(`CREDIT_PACK|SUBSCRIPTION|ONE_OFF`), `currency`, `unitAmountMinor`,
`interval` (`MONTH|YEAR`, subscription only), `creditsIncluded`, 
`overageUnitAmountMinor`, `features` (JSON), `status` (`ACTIVE|ARCHIVED`),
`supersedesPlanId`, `createdAt`. Unique `(serviceId, key, version)`.

**BillingServiceCredential**
`id`, `serviceId`, `label`, `keyHash` (unique), `scopes` (`String[]`),
`lastUsedAt`, `revokedAt`, `createdAt`.

### 5.2 Tenant-owned

**BillingAccount** — `id`, `tenantId` (unique), `currency`, `status`
(`ACTIVE|SUSPENDED|CLOSED`), `creditBalanceMinor` (cache, derived from
`CreditLedgerEntry`), `createdAt`, `updatedAt`.

**Subscription** — `id`, `tenantId`, `billingAccountId`, `planId`, `status`,
`currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `startedAt`,
`canceledAt`, `providerTokenId` (only when the provider returns a reusable
token), `createdAt`, `updatedAt`.

**Invoice** — `id`, `tenantId`, `billingAccountId`, `number` (unique, e.g.
`NID-2026-000123`), `status`, `currency`, `subtotalMinor`, `taxMinor`,
`totalMinor`, `amountPaidMinor`, `periodStart`, `periodEnd`, `dueAt`,
`issuedAt`, `paidAt`, `voidedAt`, `createdAt`, `updatedAt`.

**InvoiceLine** — `id`, `invoiceId`, `serviceId`, `subscriptionId?`,
`description`, `quantity`, `unitAmountMinor`, `amountMinor`, `taxMinor`.

**PaymentIntent** — `id`, `tenantId`, `billingAccountId`, `purpose`
(`CREDIT_TOPUP|SUBSCRIPTION|INVOICE|ONE_OFF`), `amountMinor`, `currency`,
`status`, `provider`, `providerRef`, `checkoutUrl`, `idempotencyKey`,
`metadata` (JSON), `expiresAt`, `createdAt`, `updatedAt`.
Unique `(tenantId, idempotencyKey)`; unique `(provider, providerRef)` when set.

**Payment** — `id`, `tenantId`, `paymentIntentId`, `provider`,
`providerTransactionId`, `amountMinor`, `currency`, `status`
(`PENDING|SUCCEEDED|FAILED`), `methodType`, `paidAt`, `createdAt`.
Unique `(provider, providerTransactionId)`.

**Refund** — `id`, `tenantId`, `paymentId`, `amountMinor`, `status`
(`PENDING|SUCCEEDED|FAILED`), `reason`, `providerRef`, `createdAt`, `updatedAt`.

**CheckoutSession** — `id`, `tenantId`, `paymentIntentId`, `tokenHash`
(unique), `status` (`PENDING|COMPLETED|EXPIRED|CANCELED`), `returnUrl`
(optional caller-app URL after origin allowlist; nID's provider redirect is
built separately), `expiresAt`, `consumedAt`, `createdAt`. Bootstrap lookup
by token hash.

**UsageRecord** — `id`, `tenantId`, `serviceId`, `metricKey`, `quantity`
(BigInt), `occurredAt`, `idempotencyKey`, `invoiceLineId?`, `createdAt`.
Unique `(serviceId, idempotencyKey)`.

**CreditLedgerEntry** (append-only) — `id`, `tenantId`, `billingAccountId`,
`deltaMinor` (signed), `reason` (`TOPUP|USAGE|REFUND|ADJUSTMENT`), `refType`,
`refId`, `balanceAfterMinor`, `createdAt`.

**LedgerAccount** — `id`, `tenantId`, `serviceId?`, `kind`, `currency`,
`scopeKey` (unique).
Kinds: `PSP_CLEARING`, `PSP_FEES`, `REVENUE`, `TAX_PAYABLE`,
`DEFERRED_REVENUE`, `CUSTOMER_CREDITS`, `REFUNDS`, `ADJUSTMENTS`.
Every account is tenant-scoped so RLS applies uniformly; `scopeKey` encodes
`t:<tenantId>[:s:<serviceId>]:<kind>:<currency>` so a service's revenue
account is unique per tenant.

**LedgerTransaction** — `id`, `tenantId`, `type`
(`PAYMENT|CREDIT_TOPUP|CREDIT_USAGE|FEE|REFUND|RECOGNITION|ADJUSTMENT`),
`refType`, `refId`, `currency`, `occurredAt`, `createdAt`.

**LedgerEntry** — `id`, `tenantId`, `transactionId`, `accountId`, `direction`
(`DEBIT|CREDIT`), `amountMinor`.

**WebhookEvent** — `id`, `tenantId`, `provider`, `providerEventId`, `type`,
`payload` (JSON), `signatureValid`, `status`
(`RECEIVED|PROCESSED|IGNORED|FAILED`), `error`, `receivedAt`, `processedAt`.
Unique `(provider, providerEventId)`.

**SettlementRecord** (platform-level, admin-only; no tenant scope) — `id`,
`provider`, `providerSettlementId`, `amountMinor`, `feeMinor`, `netMinor`,
`currency`, `settledAt`, `matchedPaymentId?`, `matchedTenantId?`, `status`
(`MATCHED|DISCREPANCY`), `createdAt`.

**OutboundEvent** — `id`, `tenantId`, `serviceId?`, `eventType`,
`payload` (JSON), `targetUrl`, `status` (`PENDING|DELIVERED|FAILED`),
`attempts`, `nextAttemptAt`, `lastError`, `createdAt`, `deliveredAt`.

**Accounting invariants** (enforced in `packages/billing/ledger.ts` and tests):
1. Every `LedgerTransaction` has ≥2 lines and sums to zero.
2. `BillingAccount.creditBalanceMinor` equals the sum of its
   `CreditLedgerEntry.deltaMinor` rows after every committed operation.
3. Ledger rows are never updated or deleted; corrections are new transactions.
4. A payment settles at most one intent; an intent has at most one successful
   payment.

### 5.3 RLS

- All tenant-owned tables: standard `tenant_isolation` policy.
- Catalog tables: `catalog_read FOR SELECT USING (true)` and
  `catalog_write FOR ALL USING (current_setting('app.billing_admin', true) = 'on')`.
- `packages/db` adds `withBillingAdminContext(prisma, fn)` which sets
  `app.billing_admin='on'` for the transaction. Only the admin guard may use it.
- `CheckoutSession`: open SELECT (token lookup), scoped insert/update.
- `WebhookEvent`: open SELECT (dedupe before tenant context), scoped
  insert/update inside the resolved tenant transaction.
- `PaymentIntent`: open SELECT (resolve by `providerRef` on webhook), scoped writes.
- `BillingServiceCredential`: open SELECT (key auth), admin writes.
- `SettlementRecord`: no tenant policy; SELECT and writes require
  `app.billing_admin` (admin/reconciliation only).

Audit changes (additive): `AuditLogEntry` gains nullable `entityType` and
`entityId` plus an index on `(tenantId, entityType, entityId)`, and
`AuditActorType` gains `SERVICE` and `PLATFORM_ADMIN`. Billing actions use
`entityType` values `invoice`, `payment`, `payment_intent`, `refund`,
`subscription`, `account`, `plan`, `service`.

---

## 6. State machines

```
PaymentIntent: REQUIRES_CHECKOUT → PROCESSING → SUCCEEDED
                               └→ FAILED / EXPIRED / CANCELED

CheckoutSession: PENDING → COMPLETED | EXPIRED | CANCELED

Invoice: DRAFT → OPEN → PAID | VOID | UNCOLLECTIBLE
                (partial payments keep it OPEN with amountPaidMinor > 0)

Subscription: INCOMPLETE → ACTIVE → PAST_DUE → ACTIVE | CANCELED
                        └→ CANCELED          ACTIVE → CANCELED (at period end)

Refund: PENDING → SUCCEEDED | FAILED
```

Transitions are applied only from provider-confirmed state, never from a
browser return URL.

---

## 7. Money flows

### 7.1 Checkout (credits, invoice, subscription, one-off)

1. Caller (`TenantStaff` session or service credential) calls
   `POST /v1/billing/checkout-sessions` with `purpose`, exactly one of
   `planId` / `invoiceId`, an `Idempotency-Key` header, and an optional
   `returnUrl` used only for a "back to the app" link. `returnUrl` is
   rejected unless its origin is listed in `CHECKOUT_RETURN_ORIGINS`. The
   provider's redirect target is always nID's own
   `${CHECKOUT_UI_URL}/return/<token>`, built server-side.
2. Server resolves and **computes the amount server-side**. Client-supplied
   amounts are rejected.
3. Creates `PaymentIntent` (`REQUIRES_CHECKOUT`) and `CheckoutSession`
   (`PENDING`, 256-bit token, only its hash stored), returns
   `{ checkoutUrl, expiresAt }`.
4. `packages/payments` calls the provider with amount, currency, reference
   (`intent.id`), webhook URL and return URL. nID redirects the browser to
   the provider's hosted page.
5. Customer pays with card, Raast QR, wallet or bank transfer on the provider
   page.
6. Provider redirects to `checkout-ui /return/[token]` (cosmetic, untrusted)
   and posts a signed webhook.
7. Webhook handler (`POST /v1/billing/webhooks/rapid-gateway`):
   - verify signature in constant time using `timingSafeEqual`;
   - dedupe on `(provider, providerEventId)`;
   - resolve intent → tenant, open a tenant transaction;
   - record `Payment`;
   - settle the intent (activate subscription / add credits / mark invoice paid);
   - post ledger transaction(s);
   - mark webhook `PROCESSED`;
   - enqueue `OutboundEvent` rows after commit.
8. The return page polls `GET /v1/billing/checkout-sessions/:token` and shows
   the state. It never marks anything paid itself.
9. If no webhook arrives within the configured window, a scheduled activity
   calls `fetchPayment(providerRef)` and applies the same settlement path.
   Settlement is idempotent, so a late webhook is a no-op.

### 7.2 Ledger examples (PKR, paisa)

Credit-pack purchase of 11,800 (10,000 credits + 1,800 tax):

```
DEBIT  PSP_CLEARING        11,800
CREDIT CUSTOMER_CREDITS    10,000
CREDIT TAX_PAYABLE          1,800
```

Credits consumed by verification cases:

```
DEBIT  CUSTOMER_CREDITS     2,500
CREDIT REVENUE:<service>    2,500
```

Settlement with provider fee of 236:

```
DEBIT  PSP_FEES               236
CREDIT PSP_CLEARING           236
```

Refund of 2,500:

```
DEBIT  REFUNDS              2,500
CREDIT PSP_CLEARING         2,500
```

Subscription invoice payment (Phase 1 recognizes on payment; deferred-revenue
recognition entries are Phase 2):

```
DEBIT  PSP_CLEARING        11,800
CREDIT REVENUE:<service>   10,000
CREDIT TAX_PAYABLE          1,800
```

### 7.3 Credits

- Top-up: `CreditLedgerEntry(+amount, TOPUP)` plus ledger transaction, same
  DB transaction as payment settlement.
- Balance updates are atomic (`UPDATE ... SET "creditBalanceMinor" =
  "creditBalanceMinor" + $delta ... RETURNING`), reject a debit that would go
  negative, and write `balanceAfterMinor` from the returned row so concurrent
  debits cannot race.
- nID verification creation debits credits idempotently with
  `refType=verification_case, refId=<caseId>`. Other services call
  `POST /v1/billing/usage`; the record either draws credits or accrues to the
  next invoice, depending on the plan.
- `credits.low` fires when the balance crosses 10% of the last top-up
  (threshold stored on the plan as `features.lowBalanceThresholdMinor`);
  `credits.exhausted` fires at zero. Both are outbound events only.

### 7.4 Subscriptions

- First invoice is created when checkout starts; subscription becomes `ACTIVE`
  on payment.
- `subscriptionBillingWorkflow` (one per active subscription) sleeps to
  `currentPeriodEnd`, then:
  1. issues the next invoice (`DRAFT → OPEN`);
  2. auto-charges only if `providerTokenId` exists and the provider supports
     off-session charges; otherwise creates a checkout session and emits
     `invoice.payment_failed` with the payment link;
  3. runs retries on day 3, 5 and 7 (`dunningWorkflow`);
  4. marks `PAST_DUE`, then after the grace period (default 7 days) suspends
     entitlements (`BillingAccount.SUSPENDED`) and emits
     `subscription.past_due`;
  5. on payment, returns to `ACTIVE` and emits `subscription.renewed`.
- Cancel-at-period-end is honored by the same workflow; immediate cancel voids
  open invoices and emits `subscription.canceled`.

### 7.5 One-off invoices

A service credential creates an invoice with line items; nID issues it and
returns a hosted payment link. Payment follows the standard checkout path.

### 7.6 Refunds

Admin initiates full or partial refund against a `Payment`. nID calls the
provider refund API; on success it posts reversing ledger entries, adjusts
credits when the original purpose was a top-up, emits `refund.succeeded`, and
marks the payment/intent accordingly. Phase 1 requires manual initiation; no
self-serve refunds.

---

## 8. API surface

Controllers carry the `v1/...` prefix themselves (no global prefix in
`main.ts`), so billing controllers follow the same convention. All monetary and
state fields are read from the database, never from client input.

**Tenant (AccountSession + TenantStaffMembership)**
- `GET  /v1/billing/account`
- `GET  /v1/billing/services`
- `GET  /v1/billing/plans?service=<key>`
- `POST /v1/billing/checkout-sessions`
- `GET  /v1/billing/invoices?status=`
- `GET  /v1/billing/invoices/:id`
- `GET  /v1/billing/subscriptions`
- `POST /v1/billing/subscriptions/:id/cancel`
- `GET  /v1/billing/payments`
- `GET  /v1/billing/usage`
- `GET  /v1/billing/events` (delivery log)

**Checkout (capability token, no session)**
- `GET  /v1/billing/checkout-sessions/:token` → summary + status
- `GET  /v1/billing/checkout-sessions/:token/status` → poll

**Service (BillingServiceCredential)**
- `POST /v1/billing/service/checkout-sessions` (`tenantId` required)
- `POST /v1/billing/service/usage`
- `POST /v1/billing/service/invoices`
- `GET  /v1/billing/service/entitlements?tenantId=`
- `GET  /v1/billing/service/accounts/:tenantId`

**Admin (AccountSession + `BILLING_ADMIN_ACCOUNT_IDS`)**
- `POST/PATCH /v1/billing/admin/services`
- `POST/PATCH /v1/billing/admin/plans`
- `POST /v1/billing/admin/refunds`
- `GET  /v1/billing/admin/reconciliation`

**Provider webhooks (public, signature-verified)**
- `POST /v1/billing/webhooks/:provider`

**Cross-cutting**
- `Idempotency-Key` required on checkout creation and usage reporting.
- All mutations audited via `AuditService`; reads of invoices, payments and
  refunds also audited (house rule 3).
- Errors: 400 validation, 401/403 auth, 404 not visible in tenant scope,
  409 duplicate idempotency key or illegal transition, 422 business rule.

---

## 9. Ecosystem integration contract

1. nID admin registers a `BillingService` (key, owner repo), its plans, and a
   `BillingServiceCredential` per environment. nID itself is registered as the
   `nid` service so its verification plans use the same catalog and checkout.
2. The service calls nID with its credential; nID resolves the tenant and
   enforces that the tenant belongs to that service's billing relationship.
3. nID emits HMAC-signed events to the service's registered target URL:

```
X-NID-Signature: t=<timestampMs>,v1=<hex hmac-sha256 of "<t>.<rawBody>">
```

Reuses `signWebhookPayload` / `verifyWebhookSignature` from
`@nid/shared-types` so both sides cannot drift.

Events: `invoice.created`, `invoice.paid`, `invoice.payment_failed`,
`invoice.voided`, `subscription.activated`, `subscription.renewed`,
`subscription.past_due`, `subscription.canceled`, `payment.succeeded`,
`payment.failed`, `refund.succeeded`, `credits.low`, `credits.exhausted`,
`checkout.completed`.

Delivery: persisted `OutboundEvent` + `outboundWebhookWorkflow` retry with
exponential backoff (1m, 5m, 30m, 2h, 12h; max 7 days), delivery log visible to
the tenant and the service owner. Tenant billing events use a separate
`billingWebhookUrl`/secret on `Tenant` so existing verification webhooks are
not affected.

Entitlement response shape:

```json
{
  "tenantId": "...",
  "services": {
    "erp-1": {
      "status": "active",
      "features": { "max_users": 25 },
      "creditsMinor": 120000,
      "subscription": { "planKey": "growth", "periodEnd": "2026-11-30T00:00:00Z" }
    }
  }
}
```

Services may cache this for a short TTL but must treat `subscription.canceled`
and `credits.exhausted` as authoritative.

---

## 10. Authentication & authorization

- **Tenant billing UI** — existing `AccountSessionGuard` +
  `TenantStaffMembership`. No raw API-key paste for billing.
- **Services** — `BillingServiceCredential` key sent as `Authorization: Bearer`;
  hashed at rest, scopes (`checkout:create`, `usage:write`, `invoice:create`,
  `entitlements:read`), constant-time lookup. New guard mirrors
  `TenantApiKeyGuard`.
- **Checkout** — capability token in the URL, hashed at rest, single use,
  expires with the intent; exposes only amount, line description, service name
  and status.
- **Admin** — account session plus `BILLING_ADMIN_ACCOUNT_IDS` allowlist.
  Phase-1 shortcut; replaced by an internal-admin role in a later phase.
- **Provider webhooks** — public endpoint, signature verified before any read
  or write; replay window 5 minutes; unknown event types are stored as
  `IGNORED`, not dropped.

---

## 11. Security & compliance

- PCI DSS SAQ A: no cardholder data is stored, processed or transmitted by
  nID. Only the hosted redirect is used.
- Amounts are recomputed server-side from catalog/invoice rows.
- Idempotency: `(tenantId, idempotencyKey)` on intents, 
  `(provider, providerEventId)` on webhooks, `(serviceId, idempotencyKey)` on
  usage.
- Webhook signatures compared in constant time; raw body preserved.
- Secrets (provider key/secret, webhook signing secrets) read from
  `core/config` env, never logged, never returned by any endpoint.
- RLS on every tenant-owned table; catalog writes only under
  `app.billing_admin`.
- Audit reads and writes of financial records.
- Rate limit checkout creation and webhook ingestion.
- Provider responses that fail validation are stored as `FAILED` with the raw
  payload for reconciliation; they never partially apply.
- No `===` for any secret comparison; no PII in logs.

---

## 12. UI

**`apps/checkout-ui` (new, port 3500 — 3100/3200/3300 are taken by
verify-ui/dashboard/login-ui and 3400 by profile-ui)**
- `/checkout/[token]` — service name, line summary, amount, currency, pay
  button (redirect to provider); handles expired/used/unknown tokens.
- `/return/[token]` — polls status; states: processing, success, failed,
  expired; link back to the calling app.
- Server-rendered, no credentials, brand tokens from
  `@nadeemmurtaza/design-system` (same as login-ui), accessible form/button
  semantics, responsive.

**`apps/dashboard` (billing section)**
- Overview: credit balance, active subscriptions, last payment, outstanding
  invoices.
- Top up: choose a credit pack per service → hosted checkout.
- Invoices: list, detail (lines per service), pay.
- Subscriptions: plan, period, cancel-at-period-end.
- Usage and payment history; webhook delivery log.
- States for empty/loading/error; no API key paste for billing.

**Admin (Phase 1)**
- Catalog and refunds exposed via API and minimal dashboard admin pages
  gated by the allowlist. Seed data is the primary path for catalog creation.

---

## 13. Testing

- **Ledger properties:** zero-sum transactions; credit cache equals ledger sum;
  no updates/deletes; reversal correctness; settlement idempotency.
- **Provider contract suite** run against `MockProvider` and Rapid Gateway
  fixtures: create checkout, status mapping, signature accept/reject, refund.
  Adding a provider means passing this suite.
- **Webhook tests:** valid signature settles; tampered signature rejected;
  duplicate event is a no-op; replay outside window rejected; unknown type
  ignored; failure path leaves invoice open.
- **Checkout tests:** amount cannot be client-supplied; duplicate
  idempotency key returns the same intent; expired session refused.
- **RLS test:** tenant A cannot read tenant B's invoices/payments/ledger;
  unset `app.tenant_id` sees nothing; catalog write without
  `app.billing_admin` fails.
- **E2E (local):** top up with the mock, balance updates, duplicate webhook
  does not double-credit; buy subscription and see it `ACTIVE`; pay invoice
  and see `PAID`; outbound event signature verifies.
- **Definition of done:** `pnpm typecheck && pnpm lint && pnpm test &&
  pnpm db:validate` plus the checklist in `docs/HOUSE-RULES.md` §8.

---

## 14. Rollout

**Phase 1 — core**
schema + migrations + RLS; catalog seed; `packages/payments` with mock and
Rapid Gateway adapter; checkout sessions; webhook ingest; credits; invoices;
subscription creation; `checkout-ui`; dashboard read/top-up/pay.

**Phase 2 — operations**
renewal + dunning workflows; usage reporting; entitlements endpoint;
outbound events + retry workflow; refunds; settlement reconciliation; invoice
PDFs; revenue recognition.

**Phase 3 — expansion**
per-service merchant accounts; multi-currency; tax engine; saved mandates;
embedded widget; B2C payer accounts; automated service payouts.

Each phase ships behind the existing env allowlists
(`PAYMENT_PROVIDERS`, `BILLING_ADMIN_ACCOUNT_IDS`) and is off by default in
production until the sandbox flow is verified.

---

## 15. Migration & compatibility

- New Prisma migration(s) add all tables and policies; existing tables change
  only additively: `Tenant.billingWebhookUrl`/secret and
  `AuditLogEntry.entityType`/`entityId`, plus the two new `AuditActorType`
  values.
- The billing webhook secret follows the same at-rest treatment as
  `Tenant.webhookSecretPlaintext`; column encryption is the same tracked gap,
  not a new one.
- Existing verification webhooks keep using `Tenant.webhookUrl`; billing uses
  the new fields.
- `Tenant` gains a 1:1 `BillingAccount` created lazily on first billing action
  (and backfilled by seed for existing tenants).
- No existing API response changes shape.

---

## 16. Observability

- Structured logs with `intentId`, `invoiceId`, `providerRef`, `eventId`; no
  secrets, no card data.
- Metrics: checkout created/completed/failed, webhook latency and failures,
  dunning outcomes, ledger postings, outbound delivery success rate.
- Admin reconciliation view: unmatched settlement records and failed webhooks.
- Alerting: webhook signature failures spike, settlement discrepancy, stuck
  `PROCESSING` intents older than 15 minutes.

---

## 17. Governance change

`ECOSYSTEM.md` must be amended in this change:

- nID's "owns" column gains **billing, subscriptions, payments, invoices,
  refunds, usage metering, settlement records, and the service catalog**.
- The "must never own" line is narrowed to business-domain data — no orders,
  inventory, conversations or CRM.
- Every other repo's billing responsibility becomes "call nID; own no payment
  state".
- `docs/PHASES.md` gains the billing rollout above.

---

## 18. Open inputs & risks

| Item | Owner | Impact |
|---|---|---|
| Rapid Gateway API docs: checkout-init endpoint/payload, webhook signature header and algorithm, status enum, refund endpoint, settlement report format, sandbox base URL | Product | Blocks live adapter mapping; mock and contract tests unblock everything else. Place docs in `docs/vendors/rapid-gateway/`. |
| Sandbox merchant credentials | Product | `.env` only; `.env.example` gets placeholders. Never committed. |
| Currency confirmed PKR-only for Phase 1 | Product | Schema already carries currency; multi-currency deferred. |
| Tax treatment (provincial sales tax on SaaS) | Finance | `taxMinor` is 0 until confirmed; ledger accounts already exist. |
| Recurring mandates availability at Rapid Gateway | Provider | Determines auto-charge vs invoice-link renewals; the design supports both. |
| Staff login in dashboard already functional (`TenantStaffMembership`) | Engineering | Billing UI depends on it; verify before Phase 1 UI work. |
| nID as merchant of record: contracts, refunds and tax liability | Business | Legal decision already made; operational process still needed. |

---

## 19. Acceptance criteria

**Phase 1**
1. A tenant staff member can buy a credit pack through the hosted checkout and
   sees the balance increase from the ledger, exactly once.
2. Paying an invoice marks it `PAID` only via a verified webhook; replaying the
   webhook changes nothing.
3. Creating a subscription activates it on payment and sets the period dates;
   cancel-at-period-end is recorded and honored by the billing state.
4. A service credential can create a checkout for a tenant and read that
   tenant's billing summary; an nID verification case debits credits
   idempotently.
5. Ledger invariants and RLS isolation tests pass.
6. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm db:validate` pass.
7. `ECOSYSTEM.md` and `docs/PHASES.md` reflect the new ownership.

**Phase 2**
8. A renewal invoice is generated at period end in a time-accelerated test;
   dunning moves the subscription to `PAST_DUE` and suspends after grace.
9. Usage reporting is idempotent, and the entitlements endpoint returns
   feature, limit and credit state per service.
10. Signed outbound events are delivered, retried, and verifiable with
    `@nid/shared-types`.
11. A refund reverses the ledger and emits `refund.succeeded`.
12. Settlement reconciliation flags a deliberately mismatched record.
