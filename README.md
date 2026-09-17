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
- Root `eslint.config.mjs`, wired into every package's `pnpm lint`.

`apps/api` runs on `ts-node-dev`, not `tsx` — NestJS's DI needs real
TypeScript-compiler decorator metadata, which esbuild-based tools don't emit
correctly (silently, with no type error). See `docs/HOUSE-RULES.md` rule 7 if
you're tempted to switch it for a faster dev loop.

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

> **What's actually been run, and where it was verified.** The sandbox this
> scaffold was built in has no Docker daemon and its egress policy blocks pulling
> images from Docker Hub's CDN — so `docker compose up` itself was never run
> there. What *was* verified live, using a plain `apt-get install postgresql`
> instead of the Docker Compose Postgres (same schema, same migration, same
> RLS): `prisma migrate deploy` applying `000_init` cleanly on a fresh database,
> `pnpm db:seed`, the full `tenant-isolation.spec.ts` and
> `otp-sms.activity.spec.ts` suites (`RUN_DB_TESTS=true`), and the real `apps/api`
> HTTP surface end to end via curl — including a live cross-tenant request
> returning a clean 404, not leaked data. **Not verified live:** anything through
> an actual Temporal server — this sandbox's egress policy also blocks
> `temporal.download` and GitHub release downloads outside its two allowed
> repos, so there was no way to get a Temporal server running here at all
> (Docker or otherwise). The workflow/activity *logic* is still proven for
> real: `otp-sms.activity.spec.ts` calls `sendOtpActivity`/`verifyOtpActivity`/
> `expireOtpActivity` directly against live Postgres — everything Temporal
> would otherwise orchestrate, minus the orchestration layer itself (signals,
> retries, the `condition()` timeout). Running `docker compose up` in an
> environment that isn't sandboxed this way, then Phase 0 acceptance criterion
> 3 below, is the one remaining unverified step.

## Phase 0 acceptance criteria

1. `docker compose up` brings up Postgres + Temporal; `pnpm db:seed` creates two
   tenants, each with an API key. **Verified** (Postgres side, via a non-Docker
   local install — see note above).
2. **RLS isolation**: a request authenticated as Tenant A's API key returns zero
   rows for Tenant B's `Subject`/`VerificationCase` data, even against a
   deliberately unscoped query — proven at the database, not just in application
   code. See `apps/api/test/tenant-isolation.spec.ts`. **Verified live**, both as
   a Jest suite and via real HTTP requests against a running `apps/api`.
3. **End-to-end OTP case, through a real Temporal server**: `POST
   /v1/verification-cases` with `{ subjectId, policyName: "standard", phone }`
   starts the `otpVerificationWorkflow` (`policyName` must reference a
   `VerificationPolicy` whose `methods` is exactly `["otp_sms"]` — Phase 0 has
   only the one provider), the dev-mode `otp_sms` provider logs the code
   instead of sending a real SMS, `POST .../otp/submit` with the correct code
   resolves the case to `PASSED` via `verifyOtpActivity`, and the tenant's
   webhook receiver gets an HMAC-signed callback verified with a constant-time
   comparison. **Not verified against an actual Temporal server** (see note
   above) — but every activity this workflow calls is proven directly by
   `apps/workflows/test/otp-sms.activity.spec.ts` (`RUN_DB_TESTS=true`),
   including the signed webhook delivery to a real HTTP receiver.
4. An `AuditLogEntry` row exists for the Subject-data read in step 3, not just the
   write. **Verified** — `otp-sms.activity.spec.ts` asserts the `SYSTEM`-actor
   audit row `resolveCase()` writes.

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
