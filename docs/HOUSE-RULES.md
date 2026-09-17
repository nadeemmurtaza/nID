# House rules

This is a KYC/identity product: the data is government ID documents, biometrics,
and PII. The rules below exist to keep tenant data isolated and every access
accountable. Read this before adding a module.

## 1. A verification method is a provider, not a branch

Every verification method (`otp_sms`, `document_ocr`, `liveness`, `sanctions_screen`,
a country's national-ID registry lookup, ...) implements
`VerificationMethodProvider` from `packages/verification-providers/src/types.ts`.
One file per provider, registered in
`packages/verification-providers/src/registry.ts` behind the `VERIFICATION_METHODS`
env allowlist. **Never branch on the method name inside a workflow or controller** —
add a provider instead. This mirrors `erp-1`'s `PaymentProvider` /
`StorageDriver` convention deliberately, because it is the right shape for
"anything with more than one implementation, selected by config."

## 2. Tenant isolation is enforced by the database, not application code

Every tenant-owned table carries `tenant_id` and a Postgres Row-Level Security
policy (`packages/db/prisma/migrations/000_init/migration.sql`). The API sets
`app.tenant_id` per request via `withTenantContext()`
(`packages/db/src/index.ts`, used from `apps/api/src/core/db/prisma.service.ts`),
from the authenticated API key — never from a client-supplied value. A Prisma
query that forgets a `where: { tenantId }` clause must still be unable to see
another tenant's rows. If you add a tenant-owned table, it needs an RLS
policy in the same migration that creates it — not a follow-up.

This only holds if `apps/api` connects as the `nid_app` role
(`APP_DATABASE_URL`), not the migration/seed role (`DATABASE_URL`, the
Postgres superuser, which bypasses RLS unconditionally). Four tables have a
deliberate, documented exception — open `SELECT` for bootstrap, scoped
writes — because each has to be resolved by an unscoped lookup before
`app.tenant_id` can be set: `TenantApiKey` (an API-key auth check),
`VerificationSession` (a subject-facing session token, for `apps/verify-ui`
— see `packages/db/prisma/migrations/001_verification_sessions`), and
`OAuthClient`/`OAuthLoginRequest` (resolving a "Login with nID" attempt by
its public `clientId` or `pollTokenHash`, for `apps/login-ui` — see
`.../migrations/20260917195555_accounts_and_oauth`). `Account`,
`AccountOtpCode`, and `AccountSession` are a different case again — no
tenantId at all, so no tenant RLS policy applies to them, full stop; see
`schema.prisma`'s comment on that section. Adding another table that needs
the bootstrap shape should reuse the open-SELECT pattern, not invent a new
one — see any of the migration files above for why it's safe.

## 3. Every read of Subject PII is audited, not just every write

`AuditLogEntry` rows are written on read paths that return a `Subject`,
`Organization`, `VerificationMethodAttempt`, or `DocumentAsset` — not only on
create/update. A dashboard view, an internal debugging query, and the public API
all go through the same audited path.

## 4. Inbound webhooks are verified in constant time; outbound webhooks are signed

Any callback nID receives from a verification vendor (document OCR, liveness,
sanctions screening) is verified with `timingSafeEqual`, exactly like `erp-1`'s
payment-gateway callbacks — a variable-time `===` comparison leaks the secret one
byte at a time. Any webhook nID sends to a tenant is HMAC-signed with a
timestamp, so the tenant's own verification is the same shape in reverse.

## 5. Long-running verification flows are Temporal workflows, not cron jobs or queues

A `VerificationCase` that spans multiple methods (OTP, then document, then
liveness, with retries and a possible human-review wait) is one Temporal
workflow per case, not a state column plus a poller. Each method is an
Activity. Escalation to human review is a workflow signal, not a separate table
a cron job scans.

## 6. Money and secrets rules carried over from erp-1, because they're just correct

- Secrets (vendor API keys, KMS key IDs, webhook signing secrets) are read from
  env vars behind `core/config`, never hardcoded, never logged.
- A client-submitted verification result or score is never trusted — every
  decision is computed server-side from the provider's raw response.
- `.env*` is gitignored; only `.env.example` (placeholder values) is committed.

## 7. apps/api runs through tsc/ts-node, never esbuild

NestJS's DI resolves constructor parameter types from
`emitDecoratorMetadata`-generated `design:paramtypes` — TypeScript compiler
output that esbuild-based tools (`tsx`, esbuild-register, SWC without its
Nest-specific plugin) do not emit correctly. The failure mode is silent: no
type error, no throw — every `@Injectable()` gets `undefined` for its
constructor params and crashes the first time a route touches one, e.g.
`Cannot read properties of undefined (reading 'unscoped')` in a guard. This
is why `apps/api`'s `dev` script is `ts-node-dev`, not `tsx watch`, unlike
`apps/workflows` (no NestJS DI, no decorators — `tsx` is fine there). If
`apps/api` ever moves off `ts-node-dev`, verify against a real request with
an authenticated route, not just `tsc --noEmit` — the type-checker sees
nothing wrong here, which is exactly what makes this bug easy to reintroduce.

## 8. Definition of done

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm db:validate     # prisma validate — schema is well-formed
```

Plus, every time:
- [ ] A new tenant-owned table has an RLS policy in the same migration.
- [ ] A new verification method is a provider behind the allowlist, not an `if`.
- [ ] A new read path over Subject/Organization/Attempt/DocumentAsset writes an
      `AuditLogEntry`.
- [ ] Inbound webhook handlers use `timingSafeEqual`; outbound ones sign with HMAC.
