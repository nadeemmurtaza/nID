# nID

Identity and profile verification platform — a system of record and verification
orchestrator for people, companies, organizations, and tenants. Sold to third
parties as an external product (Persona/Sumsub/oneID.uz-shaped), not just an
internal Newax tool. See `docs/HOUSE-RULES.md` for engineering conventions and
`docs/PHASES.md` for the delivery roadmap this scaffold implements Phase 0 of.

## What's here (Phase 0)

- `packages/db` — Prisma schema for the multi-tenant core (`Tenant`, `TenantApiKey`,
  `Subject`, `Organization`, `VerificationPolicy`, `VerificationCase`,
  `VerificationMethodAttempt`, `DocumentAsset`, `AuditLogEntry`), plus a hand-written
  Postgres Row-Level Security migration that scopes every tenant-owned table to the
  session's `app.tenant_id`.
- `packages/verification-providers` — the `VerificationMethodProvider` interface
  (mirrors the `PaymentProvider` pattern in Newax's `erp-1`) and one real
  implementation: `otp_sms`.
- `apps/api` — NestJS control-plane: tenant/subject/verification-case REST endpoints,
  API-key auth, and a Prisma service that sets the RLS session variable per request
  so tenant isolation is enforced by the database, not just application code.
- `apps/workflows` — a Temporal worker with one workflow (`otpVerificationWorkflow`)
  that runs the `otp_sms` activity. Later phases add more methods to the same
  workflow via policy composition, not more workflows.

## Local setup

```bash
cp .env.example .env
pnpm install
docker compose up -d          # postgres + temporal
pnpm db:migrate                # applies packages/db/prisma/migrations, including RLS
pnpm db:seed                   # creates two tenants + API keys, for isolation testing
pnpm --filter @nid/api dev
pnpm --filter @nid/workflows dev   # in a second terminal: starts the Temporal worker
```

> This sandbox has no Docker daemon, so `docker compose up` and any step that talks
> to a live Postgres/Temporal instance could not be executed while building this
> scaffold. `pnpm db:validate` (schema validation, no DB needed) and `pnpm typecheck`
> were run instead — see `docs/PHASES.md` Phase 0 acceptance criteria for what still
> needs to run against real infra before Phase 0 is actually done.

## Phase 0 acceptance criteria

1. `docker compose up` brings up Postgres + Temporal; `pnpm db:seed` creates two
   tenants, each with an API key.
2. **RLS isolation**: a request authenticated as Tenant A's API key returns zero
   rows for Tenant B's `Subject`/`VerificationCase` data, even against a
   deliberately unscoped query — proven at the database, not just in application
   code. See `apps/api/test/tenant-isolation.spec.ts`.
3. **End-to-end OTP case**: `POST /v1/verification-cases` with
   `{ policyMethods: ["otp_sms"] }` starts the `otpVerificationWorkflow`, the dev-mode
   `otp_sms` provider logs the code instead of sending a real SMS, submitting the
   correct code resolves the case to `PASSED`, and the tenant's webhook receiver gets
   an HMAC-signed callback verified with a constant-time comparison.
4. An `AuditLogEntry` row exists for the Subject-data read in step 3, not just the
   write.

## Repo layout

```
nID/
  apps/
    api/            NestJS control-plane: tenants, subjects, cases, webhooks
    workflows/      Temporal worker: workflows + verification-method-provider activities
  packages/
    db/             Prisma schema, RLS migration, seed script
    verification-providers/   one file per VerificationMethodProvider
    shared-types/
  docs/
    HOUSE-RULES.md
    PHASES.md
```
