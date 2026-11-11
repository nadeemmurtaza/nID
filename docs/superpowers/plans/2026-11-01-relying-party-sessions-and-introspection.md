# nID Relying-Party Sessions and Introspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give nID the relying-party credential its ecosystem apps actually need — a scoped, short-lived, revocable session minted at "Login with nID" token exchange, plus `introspect` and `revoke` — and bound the staff `role` string to a real enum.

**Architecture:** Everything lands inside nID's existing `apps/api/src/modules/oauth/` module. `OAuthService` gains a shared client-credential check and three operations (`exchangeToken` now also mints, `introspect`, `revoke`); a new `RelyingPartySession` table stores only the SHA-256 of a 192-bit token and carries the same bootstrap RLS shape (`open SELECT` + tenant-scoped writes) that `OAuthLoginRequest` already uses, because a token has to be resolved before `app.tenant_id` can be set. No new guards, no new packages, no permissions engine: nID answers "who is this account, which tenants is it staff on, with what role", and nothing more.

**Tech Stack:** NestJS 11 (Express adapter, `ts-node-dev`, no global prefix/guard/interceptor), Prisma 5.20 + PostgreSQL 16 with Row-Level Security, TypeScript 5.6 strict, Jest 29 + ts-jest, pnpm workspaces, `@nid/shared-types` for the token/hash primitives.

**Spec:** [docs/superpowers/specs/2026-11-01-tenancy-and-nid-identity-design.md](file:///C:/Users/nommi/Downloads/scraper/communicator/docs/superpowers/specs/2026-11-01-tenancy-and-nid-identity-design.md) — §4.1 items N1–N6 are this plan. Read §2 (decisions D3/D4/D5/D7) and §3 before starting: this plan is the "Project 0" half of a two-repo change, and §4.3 is the Communicator consumer that these endpoints exist to serve.

## Global Constraints

Every task below implicitly includes this section.

- Work happens in an isolated git worktree of the nID repo, branched from `main`. The primary checkout at `C:\Users\nommi\Downloads\scraper\nID` is on `feat/billing-phase-1` with **someone else's uncommitted work** in it (`apps/login-ui/**`, `packages/payments/**`) — never `git checkout`, `git switch`, `git stash` or `git clean` there.
- Every tenant-owned table carries `tenantId` and gets `ENABLE` + `FORCE ROW LEVEL SECURITY` plus policies **in the same migration that creates it** (`docs/HOUSE-RULES.md` rule 2). Bootstrap-lookup tables use the documented open-`SELECT` / scoped-write shape.
- `apps/api` connects with `APP_DATABASE_URL` (the least-privilege `nid_app` role), never `DATABASE_URL`, which is the migration/seed role and bypasses RLS. `PrismaService.forTenant(tenantId, fn)` is the only way request-scoped code touches a tenant-owned table; `prisma.unscoped` is legal only against tables with an open-SELECT policy or no tenant column at all.
- Every secret comparison uses `constantTimeEqualHex` from `@nid/shared-types` (rule 4). Never `===`, never a bare `timingSafeEqual` on unnormalized input.
- No new npm dependencies. `@nid/shared-types`, `@nid/db`, `class-validator`, `class-transformer` already cover everything this plan needs.
- Env access goes through `apps/api/src/core/config/env.ts`'s `loadEnv()`; nothing logs a token, a secret or a full amount-plus-token pair (rule 6).
- Route paths are literal strings on each `@Controller('v1/...')`. **There is no `setGlobalPrefix`** in `apps/api/src/main.ts` — do not "fix" that; a `/v1` prefix added here would break every existing client including Communicator's crypto-mesh ingress.
- There is **no rate limiter in nID** (`@nestjs/throttler` is not a dependency; there is no global guard, interceptor or exception filter — the only global construct is `ValidationPipe`). Spec §4.1 N4's earlier rate-limit promise was withdrawn in rev. 3; do not add a limiter as a side effect of this plan.
- Jest config is `apps/api/jest.config.js` (CommonJS `module.exports`). Its `testMatch` is `['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts']`, and `moduleNameMapper` maps `@nid/db` and `@nid/shared-types` to their `src/index.ts`, so specs run against TypeScript sources, not `dist`.
- DB-backed specs follow the house pattern: live Postgres, gated on `RUN_DB_TESTS=true` (`const describeIfDb = RUN_DB_TESTS ? describe : describe.skip`), services constructed directly (`new OAuthService(prismaService)`), no Nest DI bootstrap, no HTTP layer, no mocks.
- Definition of done for every task: `pnpm --filter @nid/api typecheck && pnpm --filter @nid/api lint && pnpm --filter @nid/api test && pnpm db:validate` pass, plus `docs/HOUSE-RULES.md` §8.
- Copy rules: sentence case, no emoji, no marketing voice. Comments explain a non-obvious WHY only, and this repo's comments are unusually good — match that density when justifying an RLS shape or a token lifetime.

## Environment reality — read before Step 1

Two things about this machine, established by direct inspection, that change how the verification steps must be read:

1. **`psql` is not on PATH and no Docker daemon is demonstrably running.** The DB-gated specs therefore *skip* rather than fail unless live Postgres is available. A skipped suite is not a passing suite: spec §8 acceptance criterion 10 requires `RUN_DB_TESTS=true` green against real Postgres, so if you cannot bring Postgres up (`docker compose up -d postgres` in the nID repo, which also runs `packages/db/sql/001-app-role-bootstrap.sql` as an initdb script to create `nid_app`), say so explicitly in your report instead of reporting green.
2. **`.env` files are gitignored and therefore absent from a fresh worktree.** Both the repo-root `.env` and `packages/db/.env` must be copied from the primary checkout before `prisma` or `apps/api` will boot: `loadEnv()` throws `Missing required env var APP_DATABASE_URL` (and `LOCAL_STORAGE_DIR`) — note it requires **both**, so a bare `pnpm --filter @nid/api test` with no env throws even for the specs that skip.

Commands below use Git Bash on Windows (`C:\Program Files\Git\bin\bash.exe`), with `/c/Users/...` paths.

## File Structure

```
packages/db/prisma/schema.prisma                                  # Modify: +RelyingPartySession, +OAuthClient fields, +back-relations, +StaffRole enum
packages/db/prisma/migrations/20261101120000_add_relying_party_sessions/migration.sql   # Create (Task 1)
packages/db/prisma/migrations/20261101121000_bind_staff_role_to_enum/migration.sql      # Create (Task 5)
packages/db/prisma/seed.ts                                        # Modify: communicator client scopes/TTL + redirect default (Task 6), role literal (Task 5)

apps/api/src/modules/oauth/oauth.service.ts                       # Modify: authenticateClient(), session mint, introspect(), revoke()
apps/api/src/modules/oauth/oauth.controller.ts                    # Modify: +POST introspect, +POST revoke, +no-store headers
apps/api/src/modules/oauth/dto/introspect.dto.ts                  # Create (Task 3)
apps/api/src/modules/oauth/dto/revoke.dto.ts                      # Create (Task 4)
apps/api/src/modules/oauth/dto/token-exchange.dto.ts              # unchanged — its four @IsString fields are already exactly right

apps/api/src/modules/tenant-staff/dto/invite-staff.dto.ts         # Modify: @IsEnum(StaffRole) (Task 5)
apps/api/src/modules/tenant-staff/tenant-staff.service.ts         # Modify: StaffRole.STAFF default (Task 5)
apps/api/src/modules/tenant-staff/dto/invite-staff.dto.spec.ts    # Create: no-DB DTO validation spec (Task 5)

apps/api/test/relying-party-sessions.spec.ts                      # Create: live-Postgres coverage for mint/introspect/revoke (Tasks 2-4)
apps/api/test/oauth.service.spec.ts                               # Modify: existing happy path now also asserts the minted session (Task 2)

docs/PHASES.md                                                    # Modify: one subsection recording what Project 0 added (Task 6)
```

Files deliberately **not** touched: `apps/api/src/core/db/prisma.service.ts` (its `forTenant`/`unscoped` contract already supports everything here), `apps/api/src/core/auth/*` (Communicator authenticates with the RP session over introspection, not with an nID guard), `apps/api/src/app.module.ts` (`OAuthModule` is already registered), `apps/login-ui/**` (this plan is server-side only; login-ui keeps driving `login-requests`/`approve`/`claim` exactly as today), `packages/shared-types/**` (`generateSessionToken` and `sha256Hex` are reused as-is).

---

### Task 1: `RelyingPartySession` table and `OAuthClient` scope/TTL columns

Creates the credential storage both N3 and N4 need, and the two `OAuthClient` columns that decide what a minted credential may say and how long it lives. Nothing can read or write a session until this exists, so it goes first and ships dark.

**Files:**
- Create: `packages/db/prisma/migrations/20261101120000_add_relying_party_sessions/migration.sql`
- Modify: `packages/db/prisma/schema.prisma` (the `model OAuthClient` block, the `model Account` block, and a new model immediately after `model OAuthLoginRequest`)
- Read-only reference: `packages/db/prisma/migrations/20260917195555_accounts_and_oauth/migration.sql:208-232` (the `oauth_client_*` and `login_request_*` policies being copied)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: Prisma models `relyingPartySession` with fields `{id, tenantId, accountId, clientId, tokenHash, scopes: string[], expiresAt: Date, revokedAt: Date | null, createdAt: Date}` and `oAuthClient` extended with `{scopes: string[], sessionTtlMinutes: number}`; the `StaffRole`-free baseline `role` column is still `String` at this point. Task 2 writes rows, Tasks 3–4 read them.

- [ ] **Step 1: Create the isolated worktree and its environment**

Run from anywhere (paths absolute):

```bash
cd /c/Users/nommi/Downloads/scraper/nID && git worktree add -b feat/relying-party-sessions ../nID-rp-sessions main
```

Expected: `Preparing worktree (new branch 'feat/relying-party-sessions')` and `HEAD is now at <sha> …`, and **no** error about the dirty working tree in the primary checkout — `git worktree add` reads from the object database and never touches uncommitted files. Then:

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && cp /c/Users/nommi/Downloads/scraper/nID/.env .env && cp /c/Users/nommi/Downloads/scraper/nID/packages/db/.env packages/db/.env && pnpm install --frozen-lockfile && pnpm --filter @nid/db generate
```

Expected: install finishes (it is slow — the workspace builds `@tensorflow/tfjs-node`, and `package.json`'s `pnpm.onlyBuiltDependencies` allowlists it, so allow it to run); `generate` prints `✔ Generated Prisma Client (…) to ..\packages\db\generated\client`.

**All later steps run in `/c/Users/nommi/Downloads/scraper/nID-rp-sessions`**, with the env loaded into the shell first:

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && pwd
```

Expected: `/c/Users/nommi/Downloads/scraper/nID-rp-sessions`. If a later `pnpm` command dies with `Missing required env var APP_DATABASE_URL`, this line was skipped.

- [ ] **Step 2: Write the migration SQL**

Create `packages/db/prisma/migrations/20261101120000_add_relying_party_sessions/migration.sql` with exactly:

```sql
-- Relying-party sessions: the credential a "Login with nID" relying party keeps
-- after it exchanges its one-time code, and the thing it presents to
-- POST /v1/oauth/introspect on every subsequent request. Distinct from
-- AccountSession (which is nID's OWN 30-day browser session for a person, has
-- no expiry bound a relying party can choose and no revocation column) —
-- see the relying-party-sessions plan, §4.1 N2, for why a delegating RP can't
-- just reuse it.
--
-- Only the SHA-256 of the token is stored, same as TenantApiKey,
-- VerificationSession and OAuthLoginRequest.pollTokenHash/codeHash already do:
-- this value passes through a relying party's logs and proxies, so plaintext
-- storage would leak it even though every honest caller hashes before lookup.
--
-- tenantId is the owning OAuthClient's tenant, denormalized in at mint time,
-- and this table gets OAuthLoginRequest's exact shape (this file's own
-- :219-232) rather than Account/AccountSession's policy-free shape (:195-199):
-- reading a session by tokenHash must work before app.tenant_id is known,
-- because deciding the tenant IS what this lookup is for — but a table whose
-- rows unlock tenant data does not get to have no isolation policy at all, so
-- SELECT is open and writes stay tenant-scoped.

ALTER TABLE "OAuthClient" ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY['identity:read', 'memberships:read']::TEXT[];
ALTER TABLE "OAuthClient" ADD COLUMN "sessionTtlMinutes" INTEGER NOT NULL DEFAULT 720;

CREATE TABLE "RelyingPartySession" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE,
    "clientId" TEXT NOT NULL REFERENCES "OAuthClient"("id") ON DELETE CASCADE,
    "tokenHash" TEXT NOT NULL UNIQUE,
    "scopes" TEXT[] NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "RelyingPartySession_accountId_idx" ON "RelyingPartySession"("accountId");
CREATE INDEX "RelyingPartySession_tenantId_idx" ON "RelyingPartySession"("tenantId");

ALTER TABLE "RelyingPartySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RelyingPartySession" FORCE ROW LEVEL SECURITY;
CREATE POLICY "rp_session_lookup" ON "RelyingPartySession" FOR SELECT USING (true);
CREATE POLICY "rp_session_insert_scoped" ON "RelyingPartySession" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "rp_session_update_scoped" ON "RelyingPartySession" FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "rp_session_delete_scoped" ON "RelyingPartySession" FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));
```

Note the deliberate absence of a `REFERENCES "Tenant"` constraint on `tenantId`: `OAuthLoginRequest` does the same thing (it indexes `tenantId` without constraining it), so a session outlives nothing and a tenant delete cascades through `OAuthClient` → `RelyingPartySession` by the `clientId` foreign key instead.

- [ ] **Step 3: Add the columns and the model to `schema.prisma`**

In `packages/db/prisma/schema.prisma`, find `model OAuthClient` and replace its field list with:

```prisma
model OAuthClient {
  id                String   @id @default(cuid())
  tenantId          String
  name              String
  clientId          String   @unique
  clientSecretHash  String
  redirectUris      String[]
  /// What a session minted for this client may ask for. Checked at exchange
  /// time and copied onto the RelyingPartySession, so later scope creep on
  /// this row never silently widens an already-issued credential.
  scopes            String[] @default(["identity:read", "memberships:read"])
  /// Lifetime of the RP-facing session, not nID's own AccountSession TTL
  /// (30 days, accounts.service.ts). 12h default: long enough for a working
  /// day in Communicator, short enough that a stolen bearer expires by itself.
  sessionTtlMinutes Int      @default(720)
  createdAt         DateTime @default(now())

  tenant        Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  loginRequests OAuthLoginRequest[]
  rpSessions    RelyingPartySession[]

  @@index([tenantId])
}
```

Then, immediately after the closing brace of `model OAuthLoginRequest`, add:

```prisma
/// A scoped, short-lived, revocable credential for one relying party — what
/// POST /v1/oauth/token mints and POST /v1/oauth/introspect reads. Not
/// AccountSession: that one is nID's own browser session for a person, is
/// deliberately tenant-less, runs 30 days, and has no revokedAt, so a relying
/// party could neither bound it nor log a person out of *its* app.
///
/// Carries the owning client's tenantId so it gets the same
/// open-SELECT/scoped-write RLS shape OAuthLoginRequest has (resolving a
/// tokenHash is how app.tenant_id gets decided, so the read can't itself
/// require it). It has a tenantId but NO Tenant relation, same as
/// OAuthLoginRequest, and for the same reason.
model RelyingPartySession {
  id        String    @id @default(cuid())
  tenantId  String
  accountId String
  clientId  String
  tokenHash String    @unique
  scopes    String[]
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  account Account     @relation(fields: [accountId], references: [id], onDelete: Cascade)
  client  OAuthClient @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([accountId])
  @@index([tenantId])
}
```

Then in `model Account`, add the back-relation next to the existing `loginRequests OAuthLoginRequest[]` line:

```prisma
  rpSessions         RelyingPartySession[]
```

- [ ] **Step 4: Validate the schema and regenerate the client**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && pnpm db:validate && pnpm --filter @nid/db generate
```

Expected: `pnpm db:validate` prints `The database at ... is not found ...` is NOT printed and instead `🍷 Valid schema packages\db\prisma\schema.prisma`; `generate` reprints the `✔ Generated Prisma Client` line. If validate complains about a missing relation, the back-relation field name in `model Account`/`model OAuthClient` is misspelled — fix it before continuing, don't delete the relation.

- [ ] **Step 5: Apply the migration against live Postgres**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && docker compose up -d postgres && pnpm db:migrate
```

Expected: `docker compose up -d postgres` prints `Container nID-postgres-1 Started` (container name prefix varies; a `Cannot connect to the Docker daemon` here is the environment reality from the note above — record it and continue, the rest of the plan still typechecks and lints). `pnpm db:migrate` prints `The following migration(s) have been applied:` followed by `20261101120000_add_relying_party_sessions` and `Prisma Migrate has successfully deployed all migrations`.

If it fails with `column "scopes" of relation "OAuthClient" already exists`, the worktree is pointed at a database a previous run already migrated — that is fine; skip the step and note which migrations are recorded as applied in `_prisma_migrations`.

- [ ] **Step 6: Prove the RLS shape actually holds**

Only meaningful with Postgres up. Create `packages/db/src/rp-session-rls.spec.ts` — `packages/db/jest.config.js` already exists and its `testMatch` covers `src/**/*.spec.ts`, following `billing-sequence.spec.ts`:

```ts
/**
 * RLS check for the new RelyingPartySession policies, as `nid_app` (the role
 * apps/api runs under, and the only role RLS actually constrains — the
 * DATABASE_URL role bypasses, which is why this connects with
 * APP_DATABASE_URL). Follows billing-sequence.spec.ts's approach of driving
 * raw SQL through a directly-constructed client rather than a Nest app.
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/db test
 */
import { PrismaClient } from '../generated/client';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('RelyingPartySession RLS (live Postgres, as nid_app)', () => {
  const marker = `rp-rls-${Date.now()}`;
  let app: PrismaClient;
  let tenantId: string;
  let clientId: string;
  let accountId: string;
  let sessionId: string;

  beforeAll(async () => {
    app = new PrismaClient({ datasourceUrl: process.env['APP_DATABASE_URL'] });
    const tenant = await app.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', 'unconfigured-test-tenant', true)`;
      // Creating the fixture rows themselves needs a real tenant context, so
      // do it through the bypassing role — the point of THIS test is only
      // what nid_app can then READ.
      return tx;
    });
    await tenant.$disconnect().catch(() => undefined);

    const migrator = new PrismaClient({ datasourceUrl: process.env['DATABASE_URL'] });
    const created = await migrator.tenant.create({
      data: { name: marker, slug: marker },
    });
    tenantId = created.id;
    const client = await migrator.oAuthClient.create({
      data: {
        tenantId,
        name: marker,
        clientId: `client_${marker}`,
        clientSecretHash: 'x'.repeat(64),
        redirectUris: ['http://localhost:5000/callback'],
      },
    });
    clientId = client.id;
    const account = await migrator.account.create({
      data: { phone: `+1555${String(Date.now()).slice(-7)}`, phoneVerifiedAt: new Date() },
    });
    accountId = account.id;
    await migrator.$disconnect();
  });

  afterAll(async () => {
    const migrator = new PrismaClient({ datasourceUrl: process.env['DATABASE_URL'] });
    // Accounts is cascaded from; deleting the tenant cascades OAuthClient and
    // (through it) the session, so order matters only for the account.
    await migrator.$executeRaw`DELETE FROM "RelyingPartySession" WHERE "clientId" = ${clientId}`;
    await migrator.oAuthClient.delete({ where: { id: clientId } }).catch(() => undefined);
    await migrator.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    await migrator.account.delete({ where: { id: accountId } }).catch(() => undefined);
    await migrator.$disconnect();
    await app.$disconnect();
  });

  it('lets nid_app SELECT a session row with no tenant context set (bootstrap read)', async () => {
    const migrator = new PrismaClient({ datasourceUrl: process.env['DATABASE_URL'] });
    await migrator.$executeRaw`SELECT 1`;
    await migrator.relyingPartySession.create({
      data: {
        id: marker,
        tenantId,
        accountId,
        clientId,
        tokenHash: marker,
        scopes: ['identity:read'],
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await migrator.$disconnect();

    const found = await app.relyingPartySession.findUnique({ where: { tokenHash: marker } });
    expect(found?.id).toBe(marker);
  });

  it('refuses to write a session for a tenant other than the one app.tenant_id names', async () => {
    await expect(
      app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', 'tenant-that-does-not-exist', true)`;
        await tx.relyingPartySession.create({
          data: {
            id: `${marker}-write`,
            tenantId,
            accountId,
            clientId,
            tokenHash: `${marker}-hash`,
            scopes: [],
            expiresAt: new Date(Date.now() + 60_000),
          },
        });
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Run it**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && RUN_DB_TESTS=true pnpm --filter @nid/db test -- rp-session-rls
```

Expected: two passing tests. `Tests: 2 passed` (or, with Postgres down, `RUN_DB_TESTS` unset by accident → `2 skipped`, which is not a pass: fix the env, don't move on).

- [ ] **Step 8: Typecheck, lint, commit**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && pnpm --filter @nid/db typecheck && pnpm --filter @nid/api typecheck && pnpm --filter @nid/db lint && pnpm --filter @nid/api lint && pnpm db:validate
```

Expected: all four silent (exit 0). Then:

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261101120000_add_relying_party_sessions/migration.sql packages/db/src/rp-session-rls.spec.ts && git commit -m "feat(db): add RelyingPartySession and OAuthClient scope/TTL columns"
```

Expected: `4 files changed` with no `Untracked working copy` warnings blocking it. `.env` and `packages/db/.env` must NOT appear in `git status` afterwards — they are gitignored; if they show up, the copy in Step 1 landed somewhere unexpected.

---

### Task 2: `POST /v1/oauth/token` mints a relying-party session (N3)

Turns the exchange from "hand back identity claims" into "hand back identity claims *and* the credential Communicator will spend on every later request." This is the task that makes Communicator's future `Authorization: Bearer <nid session>` meaningful.

**Files:**
- Modify: `apps/api/src/modules/oauth/oauth.service.ts` (the `exchangeToken` method, currently lines 115–157, plus two new imports at the top)
- Modify: `apps/api/test/oauth.service.spec.ts` (the happy-path test at lines 83–104)
- Create: `apps/api/test/relying-party-sessions.spec.ts`

**Interfaces:**
- Consumes: Task 1's `relyingPartySession` model, `oAuthClient.scopes: string[]`, `oAuthClient.sessionTtlMinutes: number`.
- Produces: `OAuthService.exchangeToken(code, clientId, clientSecret, redirectUri)` now resolves to `{account: Pick<Account, 'id'|'phone'|'email'|'phoneVerifiedAt'>, session: {token: string, expiresAt: Date, scopes: string[]}}`; a private `OAuthService.authenticateClient(clientId, clientSecret)` returning the full `OAuthClient` row, which Tasks 3 and 4 reuse; the shape `POST /v1/oauth/token` answers with, which is what Communicator's `nid_client.py::exchange_code` will parse.

- [ ] **Step 1: Write the failing spec for the minted session**

Create `apps/api/test/relying-party-sessions.spec.ts`:

```ts
/**
 * Live-Postgres coverage for the relying-party session half of "Login with
 * nID" — the credential an RP keeps after exchanging its code, what
 * introspects it, and what revokes it. Same approach as
 * oauth.service.spec.ts: real services constructed directly, real Postgres,
 * no mocks (a mocked Prisma would not exercise the RLS this depends on).
 *
 *   RUN_DB_TESTS=true pnpm --filter @nid/api test
 */
import { ForbiddenException } from '@nestjs/common';
import { createPrismaClient, type PrismaClient, type Account } from '@nid/db';
import { generateSessionToken, sha256Hex } from '@nid/shared-types';
import { OAuthService } from '../src/modules/oauth/oauth.service';
import { PrismaService } from '../src/core/db/prisma.service';

const RUN_DB_TESTS = process.env['RUN_DB_TESTS'] === 'true';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

const REDIRECT_URI = 'http://localhost:5000/callback';
const CLIENT_SECRET = 'rp-session-test-client-secret';
const SESSION_TTL_MINUTES = 30;

describeIfDb('RelyingPartySession (live Postgres)', () => {
  let prismaService: PrismaService;
  let migratorPrisma: PrismaClient;
  let oauth: OAuthService;
  let tenantId: string;
  let clientDbId: string;
  let clientId: string;
  let account: Account;

  beforeAll(async () => {
    prismaService = new PrismaService();
    migratorPrisma = createPrismaClient(process.env['DATABASE_URL']);
    oauth = new OAuthService(prismaService);

    const tenant = await migratorPrisma.tenant.upsert({
      where: { slug: 'rp-session-spec-tenant' },
      update: {},
      create: { name: 'RP Session Spec Tenant', slug: 'rp-session-spec-tenant' },
    });
    tenantId = tenant.id;

    const client = await migratorPrisma.oAuthClient.upsert({
      where: { clientId: `client_rp_session_${tenantId}` },
      update: { sessionTtlMinutes: SESSION_TTL_MINUTES, scopes: ['identity:read', 'memberships:read'] },
      create: {
        tenantId,
        name: 'RP Session Spec RP',
        clientId: `client_rp_session_${tenantId}`,
        clientSecretHash: sha256Hex(CLIENT_SECRET),
        redirectUris: [REDIRECT_URI],
        scopes: ['identity:read', 'memberships:read'],
        sessionTtlMinutes: SESSION_TTL_MINUTES,
      },
    });
    clientDbId = client.id;
    clientId = client.clientId;

    account = await migratorPrisma.account.upsert({
      where: { phone: '+15550007777' },
      update: {},
      create: { phone: '+15550007777', phoneVerifiedAt: new Date() },
    });
  });

  afterAll(async () => {
    await migratorPrisma.relyingPartySession.deleteMany({ where: { tenantId: { in: [tenantId] } } });
    await migratorPrisma.tenantStaffMembership.deleteMany({ where: { tenantId: { in: [tenantId] } } });
    await migratorPrisma.oAuthLoginRequest.deleteMany({ where: { tenantId: { in: [tenantId] } } });
    await migratorPrisma.oAuthClient.deleteMany({ where: { tenantId: { in: [tenantId] } } });
    await migratorPrisma.tenant.deleteMany({ where: { id: { in: [tenantId] } } });
    await migratorPrisma.$disconnect();
    await prismaService.onModuleDestroy();
  });

  /** Run the real flow up to (not including) the exchange, and hand back a fresh code. */
  async function freshCode(): Promise<string> {
    const created = await oauth.createLoginRequest(clientId, REDIRECT_URI, undefined);
    await oauth.approve(created.pollToken, account);
    const { code } = await oauth.claim(created.pollToken);
    return code;
  }

  it('exchangeToken mints a session whose plaintext is returned once and stored only hashed', async () => {
    const code = await freshCode();
    const before = await migratorPrisma.relyingPartySession.count({ where: { clientId: clientDbId } });

    const exchanged = await oauth.exchangeToken(code, clientId, CLIENT_SECRET, REDIRECT_URI);
    expect(exchanged.session.token.length).toBeGreaterThanOrEqual(32);
    expect(exchanged.account.id).toBe(account.id);

    const rows = await migratorPrisma.relyingPartySession.findMany({ where: { clientId: clientDbId } });
    expect(rows).toHaveLength(before + 1);
    const minted = rows.find((r) => r.tokenHash === sha256Hex(exchanged.session.token));
    expect(minted).toBeDefined();
    expect(minted!.revokedAt).toBeNull();
    expect(minted!.scopes).toEqual(['identity:read', 'memberships:read']);
  });

  it('the minted session honours OAuthClient.sessionTtlMinutes, not AccountSession 30 days', async () => {
    const code = await freshCode();
    const { session } = await oauth.exchangeToken(code, clientId, CLIENT_SECRET, REDIRECT_URI);

    const minutes = (session.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(SESSION_TTL_MINUTES - 2);
    expect(minutes).toBeLessThanOrEqual(SESSION_TTL_MINUTES + 1);
  });

  it('a second exchange of a different code mints a second, independent session', async () => {
    const first = await oauth.exchangeToken(await freshCode(), clientId, CLIENT_SECRET, REDIRECT_URI);
    const second = await oauth.exchangeToken(await freshCode(), clientId, CLIENT_SECRET, REDIRECT_URI);

    expect(second.session.token).not.toBe(first.session.token);
    const rows = await migratorPrisma.relyingPartySession.findMany({
      where: { clientId: clientDbId, tokenHash: { in: [sha256Hex(first.session.token), sha256Hex(second.session.token)] } },
    });
    expect(rows).toHaveLength(2);
  });

  it('a wrong client secret mints nothing', async () => {
    const code = await freshCode();
    const before = await migratorPrisma.relyingPartySession.count({ where: { clientId: clientDbId } });

    await expect(oauth.exchangeToken(code, clientId, 'wrong-secret', REDIRECT_URI)).rejects.toThrow(
      ForbiddenException,
    );
    const after = await migratorPrisma.relyingPartySession.count({ where: { clientId: clientDbId } });
    expect(after).toBe(before);
  });

  it('introspect returns the session plus every tenant the account staffs, with slug and name', async () => {
    const { session } = await oauth.exchangeToken(await freshCode(), clientId, CLIENT_SECRET, REDIRECT_URI);
    await migratorPrisma.tenantStaffMembership.upsert({
      where: { tenantId_accountId: { tenantId, accountId: account.id } },
      update: { role: 'STAFF' },
      create: { tenantId, accountId: account.id, role: 'STAFF' },
    });

    const result = await oauth.introspect(session.token, clientId, CLIENT_SECRET);
    expect(result.active).toBe(true);
    expect(result.accountId).toBe(account.id);
    expect(result.scopes).toEqual(['identity:read', 'memberships:read']);
    expect(result.memberships).toEqual([
      { tenantId, slug: 'rp-session-spec-tenant', name: 'RP Session Spec Tenant', role: 'STAFF' },
    ]);
  });

  it('introspect rejects another client secret', async () => {
    const { session } = await oauth.exchangeToken(await freshCode(), clientId, CLIENT_SECRET, REDIRECT_URI);
    await expect(oauth.introspect(session.token, clientId, 'not-the-secret')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('introspect says inactive for an expired session, not an error', async () => {
    const { session } = await oauth.exchangeToken(await freshCode(), clientId, CLIENT_SECRET, REDIRECT_URI);
    await migratorPrisma.relyingPartySession.update({
      where: { tokenHash: sha256Hex(session.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(oauth.introspect(session.token, clientId, CLIENT_SECRET)).resolves.toEqual({ active: false });
  });

  it('introspect says inactive for a token minted for a different client', async () => {
    const { session } = await oauth.exchangeToken(await freshCode(), clientId, CLIENT_SECRET, REDIRECT_URI);
    const other = await migratorPrisma.oAuthClient.create({
      data: {
        tenantId,
        name: 'Other RP',
        clientId: `client_other_${Date.now()}`,
        clientSecretHash: sha256Hex(CLIENT_SECRET),
        redirectUris: [REDIRECT_URI],
      },
    });

    // Same secret string, different client row — the session's clientId must
    // still tie it to the client that minted it.
    const result = await oauth.introspect(session.token, other.clientId, CLIENT_SECRET);
    expect(result).toEqual({ active: false });
  });

  it('revoke makes introspect say inactive, and is idempotent', async () => {
    const { session } = await oauth.exchangeToken(await freshCode(), clientId, CLIENT_SECRET, REDIRECT_URI);
    await oauth.introspect(session.token, clientId, CLIENT_SECRET).then((r) => expect(r.active).toBe(true));

    await expect(oauth.revoke(session.token, clientId, CLIENT_SECRET)).resolves.toEqual({ revoked: true });
    await expect(oauth.revoke(session.token, clientId, CLIENT_SECRET)).resolves.toEqual({ revoked: true });
    await expect(oauth.introspect(session.token, clientId, CLIENT_SECRET)).resolves.toEqual({ active: false });

    const stored = await migratorPrisma.relyingPartySession.findUnique({
      where: { tokenHash: sha256Hex(session.token) },
    });
    expect(stored!.revokedAt).not.toBeNull();
  });

  it('revoke refuses to act on a session belonging to another client', async () => {
    const { session } = await oauth.exchangeToken(await freshCode(), clientId, CLIENT_SECRET, REDIRECT_URI);
    const other = await migratorPrisma.oAuthClient.create({
      data: {
        tenantId,
        name: 'Other RP 2',
        clientId: `client_other2_${Date.now()}`,
        clientSecretHash: sha256Hex(CLIENT_SECRET),
        redirectUris: [REDIRECT_URI],
      },
    });

    await expect(oauth.revoke(session.token, other.clientId, CLIENT_SECRET)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(oauth.introspect(session.token, clientId, CLIENT_SECRET)).resolves
      .toMatchObject({ active: true });
  });

  it('introspect of an unknown token says inactive rather than leaking which hashes exist', async () => {
    await expect(oauth.introspect(generateSessionToken().plaintext, clientId, CLIENT_SECRET)).resolves.toEqual(
      { active: false },
    );
  });
});
```

- [ ] **Step 2: Run the spec to confirm it fails on the new methods**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && RUN_DB_TESTS=true pnpm --filter @nid/api test -- relying-party-sessions
```

Expected: a **compile** failure, not an assertion failure: `TS2339: Property 'introspect' does not exist on type 'OAuthService'` and the same for `revoke`, plus `Property 'session' does not exist on type '{ account: ... }'`. That is the failing state for this task; Steps 3–5 fix it, and Tasks 3–4 build the methods this file already tests. To get a green run out of Task 2 alone, comment nothing — instead do Task 2's implementation now and accept that two of these eleven tests still error until Task 3 exists; the commit at Step 6 therefore happens after Task 3's Step 4 the first time through. **Ordering note for the executor: Tasks 2 and 3 were sized this way on purpose (one spec file, one fixture set), so do Tasks 2 then 3 then 4 before running this file expecting a full pass.** Run it again after Task 4 Step 4 and expect all eleven green.

- [ ] **Step 3: Extract the client-credential check and mint in the same transaction as code consumption**

In `apps/api/src/modules/oauth/oauth.service.ts`, add `generateSessionToken` to the existing `@nid/shared-types` import on line 2 so it reads:

```ts
import { constantTimeEqualHex, generateSessionToken, sha256Hex } from '@nid/shared-types';
```

Add the credential helper as a private method (place it above `findByPollToken`):

```ts
  /**
   * The RP's own backend — never a browser — authenticates every
   * server-to-server call with the secret it was issued once at registration.
   * Shared by exchange, introspect and revoke so there is exactly one
   * comparison to get wrong.
   */
  private async authenticateClient(clientId: string, clientSecret: string) {
    const client = await this.prisma.unscoped.oAuthClient.findUnique({ where: { clientId } });
    if (!client || !constantTimeEqualHex(sha256Hex(clientSecret), client.clientSecretHash)) {
      throw new ForbiddenException('Invalid client credentials.');
    }
    return client;
  }
```

Then replace `exchangeToken`'s body. Keep its signature's four parameters and its JSDoc-free shape; change the return type and the last third of the method so the whole method reads:

```ts
  async exchangeToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<{
    account: Pick<Account, 'id' | 'phone' | 'email' | 'phoneVerifiedAt'>;
    session: { token: string; expiresAt: Date; scopes: string[] };
  }> {
    const client = await this.authenticateClient(clientId, clientSecret);

    const codeHash = sha256Hex(code);
    const request = await this.prisma.unscoped.oAuthLoginRequest.findUnique({ where: { codeHash } });

    if (
      !request ||
      request.clientId !== client.id ||
      request.redirectUri !== redirectUri ||
      request.codeConsumedAt !== null ||
      request.expiresAt.getTime() < Date.now() ||
      !request.accountId
    ) {
      throw new ForbiddenException('Invalid or already-used code.');
    }

    // One-time: consume the code and mint the session in the SAME
    // transaction. Either both happen or neither does — a consumed code whose
    // session insert then failed would leave the RP with no way to log in at
    // all (retrying the exchange hits the codeConsumedAt check above), and
    // that is the one failure mode an RP cannot recover from on its own.
    const minted = generateSessionToken();
    const expiresAt = new Date(Date.now() + client.sessionTtlMinutes * 60_000);
    await this.prisma.forTenant(client.tenantId, (tx) =>
      tx
        .oAuthLoginRequest.update({ where: { id: request.id }, data: { codeConsumedAt: new Date() } })
        .then(() =>
          tx.relyingPartySession.create({
            data: {
              tenantId: client.tenantId,
              accountId: request.accountId!,
              clientId: client.id,
              tokenHash: minted.hash,
              scopes: client.scopes,
              expiresAt,
            },
          }),
        ),
    );

    const account = await this.prisma.unscoped.account.findUniqueOrThrow({
      where: { id: request.accountId },
    });

    return {
      account: {
        id: account.id,
        phone: account.phone,
        email: account.email,
        phoneVerifiedAt: account.phoneVerifiedAt,
      },
      session: { token: minted.plaintext, expiresAt, scopes: client.scopes },
    };
  }
```

- [ ] **Step 4: Update the existing happy-path spec for the new return shape**

In `apps/api/test/oauth.service.spec.ts`, replace the last four lines of the `'the full happy path: create, poll PENDING, approve, poll APPROVED, claim, exchange'` test (lines 101–104) with:

```ts
    const exchanged = await oauth.exchangeToken(claimed.code, clientId, CLIENT_SECRET, REDIRECT_URI);
    expect(exchanged.account.id).toBe(account.id);
    expect(exchanged.account.phone).toBe(account.phone);
    // The RP-facing credential "Login with nID" exists to hand over — see
    // relying-party-sessions.spec.ts for what it can then be used for.
    expect(exchanged.session.token).toHaveLength(32);
    expect(exchanged.session.expiresAt.getTime()).toBeGreaterThan(Date.now());
```

`generateSessionToken`'s 24 random bytes as base64url is exactly 32 characters, so the length assertion is testing the primitive is the one being reused, not a home-grown token.

- [ ] **Step 5: Typecheck and lint**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && pnpm --filter @nid/api typecheck && pnpm --filter @nid/api lint
```

Expected: both silent. A `TS2551: Property 'relyingPartySession' does not exist` means `pnpm --filter @nid/db generate` was not re-run after Task 1 Step 3 — re-run it.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && git add apps/api/src/modules/oauth/oauth.service.ts apps/api/test/oauth.service.spec.ts apps/api/test/relying-party-sessions.spec.ts && git commit -m "feat(oauth): mint a scoped relying-party session at token exchange"
```

Expected: `3 files changed`. The spec file added here already calls `introspect`/`revoke`; it is committed alongside the code that makes its first five tests pass, and Tasks 3–4 make the rest pass. If a reviewer rejects committing a partly-red spec, split it: keep only the five session tests in this commit and move the introspect/revoke tests into Task 3's and Task 4's commits.

---

### Task 3: `POST /v1/oauth/introspect` (N4)

The one endpoint Communicator calls on every authenticated request, and the reason nID can be the authorization authority without Communicator keeping a copy of nID's identity data. Two properties the consumer depends on, both easy to lose: the answer for "not valid" is a `200 {active: false}`, and the response is `no-store` so a shared cache can't serve a stale membership.

**Files:**
- Create: `apps/api/src/modules/oauth/dto/introspect.dto.ts`
- Modify: `apps/api/src/modules/oauth/oauth.service.ts` (new public method, after `exchangeToken`)
- Modify: `apps/api/src/modules/oauth/oauth.controller.ts` (new route + import)

**Interfaces:**
- Consumes: Task 2's `authenticateClient()`, `relyingPartySession`, `tenantStaffMembership` (open SELECT), and `prismaService.forTenant` to read the `Tenant` row of each membership.
- Produces: `OAuthService.introspect(token, clientId, clientSecret): Promise<IntrospectionView>` where `IntrospectionView = {active: true; accountId: string; expiresAt: string; scopes: string[]; memberships: {tenantId: string; slug: string; name: string; role: string}[]} | {active: false}` and `POST /v1/oauth/introspect` accepting `{token, clientId, clientSecret}` — the exact contract Communicator's `nid_client.py::introspect` is written against in the Communicator plan.

- [ ] **Step 1: Write the failing unit test for the cross-tenant membership read**

The RLS trap this endpoint has is specific and worth pinning down with a test before writing the code: `Tenant`'s own policy is `USING ("id" = current_setting('app.tenant_id', true))` (`000_init/migration.sql:186-188`), so a `unscoped.tenant.findMany` for the memberships' tenants returns **zero rows**, not other tenants' data. A naive implementation therefore yields `slug: undefined` for every membership and Communicator shows org ids instead of names forever.

Append to `apps/api/test/relying-party-sessions.spec.ts`, inside the existing `describeIfDb` block (after the last `it`), a second tenant so there are two memberships to read across:

```ts
  it('introspect reads Tenant rows across every membership despite Tenant tenant_self RLS', async () => {
    // A second tenant this Account staffs, deliberately NOT the RP's own
    // tenant. Tenant has a tenant_self RLS policy, so this row is invisible
    // unless the read happens with app.tenant_id set to exactly it — the bug
    // this test exists to catch is an implementation that reads memberships
    // through and reaches for Tenant unscoped, which yields nulls.
    const otherSlug = `rp-session-spec-other-${Date.now()}`;
    const other = await migratorPrisma.tenant.create({
      data: { name: 'Other Spec Tenant', slug: otherSlug },
    });
    await migratorPrisma.tenantStaffMembership.create({
      data: { tenantId: other.id, accountId: account.id, role: 'ADMIN' },
    });

    const { session } = await oauth.exchangeToken(await freshCode(), clientId, CLIENT_SECRET, REDIRECT_URI);
    const result = await oauth.introspect(session.token, clientId, CLIENT_SECRET);

    expect(result.active && result.memberships).toEqual(
      expect.arrayContaining([
        { tenantId, slug: 'rp-session-spec-tenant', name: 'RP Session Spec Tenant', role: 'STAFF' },
        { tenantId: other.id, slug: otherSlug, name: 'Other Spec Tenant', role: 'ADMIN' },
      ]),
    );
    expect(result.active && result.memberships!.map((m) => m.slug)).not.toContain('');

    await migratorPrisma.tenantStaffMembership.deleteMany({ where: { tenantId: other.id } });
    await migratorPrisma.tenant.delete({ where: { id: other.id } });
  });
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && RUN_DB_TESTS=true pnpm --filter @nid/api test -- relying-party-sessions
```

Expected: `TS2339: Property 'introspect' does not exist on type 'OAuthService'` — the file still won't compile until this task's Step 3 lands, which is the failing state.

- [ ] **Step 3: Add the introspection method**

Create `apps/api/src/modules/oauth/dto/introspect.dto.ts`:

```ts
import { IsString } from 'class-validator';

/**
 * Introspection is server-to-server only, so it carries the client credential
 * rather than trusting the bearer of the token: this endpoint answers "which
 * tenants is this person staff on, and with what role", which is not
 * something a raw bearer should be able to ask.
 */
export class IntrospectDto {
  @IsString()
  token!: string;

  @IsString()
  clientId!: string;

  @IsString()
  clientSecret!: string;
}
```

In `oauth.service.ts`, add the exported view type above `@Injectable()` (next to the existing `LoginRequestStatusView`):

```ts
/**
 * What an RP learns about one of its own minted sessions. Deliberately not a
 * permission list: nID says who this account is, which tenants it staffs and
 * with what role, and each RP maps that onto its own capabilities — see the
 * relying-party-sessions spec's D7 for why nID does not become a policy
 * engine for someone else's product surface.
 */
export type IntrospectionView =
  | {
      active: true;
      accountId: string;
      expiresAt: string;
      scopes: string[];
      memberships: { tenantId: string; slug: string; name: string; role: string }[];
    }
  | { active: false };
```

Then add the method after `exchangeToken`:

```ts
  /**
   * RFC 7662 semantics: an unknown, expired or revoked token is a valid
   * answer (`{active: false}`), not an error — the caller asked whether this
   * credential still means something. A bad CLIENT credential is a 403,
   * because that caller isn't entitled to the answer.
   */
  async introspect(token: string, clientId: string, clientSecret: string): Promise<IntrospectionView> {
    const client = await this.authenticateClient(clientId, clientSecret);

    const session = await this.prisma.unscoped.relyingPartySession.findUnique({
      where: { tokenHash: sha256Hex(token) },
    });
    if (
      !session ||
      session.clientId !== client.id ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() < Date.now()
    ) {
      return { active: false };
    }

    const rows = await this.prisma.unscoped.tenantStaffMembership.findMany({
      where: { accountId: session.accountId },
      orderBy: { createdAt: 'asc' },
    });

    // One forTenant per membership, because Tenant's tenant_self policy makes
    // a cross-tenant read return nothing (see 000_init). An RP learns about
    // tenants this account staffs, so each read is scoped to exactly the
    // tenant it names — this never widens what nid_app can see.
    const memberships = await Promise.all(
      rows.map(async (row) => {
        const tenant = await this.prisma.forTenant(row.tenantId, (tx) =>
          tx.tenant.findUniqueOrThrow({
            where: { id: row.tenantId },
            select: { slug: true, name: true },
          }),
        );
        return { tenantId: row.tenantId, slug: tenant.slug, name: tenant.name, role: row.role };
      }),
    );

    return {
      active: true,
      accountId: session.accountId,
      expiresAt: session.expiresAt.toISOString(),
      scopes: session.scopes,
      memberships,
    };
  }
```

- [ ] **Step 4: Expose it on the controller with `no-store`**

In `apps/api/src/modules/oauth/oauth.controller.ts`, add `Header` to the `@nestjs/common` import and `IntrospectDto` to the DTO imports, then add the route after the existing `token` handler:

```ts
  /**
   * The relying party's backend asks "is this session still mine, and what
   * is it good for" — once per request, which is why the answer is
   * no-store: an intermediate cache holding a stale membership list is
   * exactly how a removed staff member keeps their access.
   */
  @Header('Cache-Control', 'no-store')
  @Post('introspect')
  introspect(@Body() dto: IntrospectDto) {
    return this.oauth.introspect(dto.token, dto.clientId, dto.clientSecret);
  }
```

- [ ] **Step 5: Run the introspect tests**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && RUN_DB_TESTS=true pnpm --filter @nid/api test -- relying-party-sessions -t "introspect"
```

Expected: the four `introspect` tests pass, `7 skipped` (the session/revoke tests, filtered out by `-t`). A `TypeError: oauth_1.OAuthService(...).introspect is not a function` means the controller was edited and the service wasn't.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && pnpm --filter @nid/api typecheck && pnpm --filter @nid/api lint && git add apps/api/src/modules/oauth/dto/introspect.dto.ts apps/api/src/modules/oauth/oauth.service.ts apps/api/src/modules/oauth/oauth.controller.ts apps/api/test/relying-party-sessions.spec.ts && git commit -m "feat(oauth): add client-authenticated session introspection"
```

Expected: `4 files changed`, both gates silent.

---

### Task 4: `POST /v1/oauth/revoke` (N5)

The endpoint that makes Communicator's logout button real. Without it, logging out of the SPA means deleting a string from `localStorage` while the credential that unlocked every tenant's data stays valid for its full 12 hours.

**Files:**
- Create: `apps/api/src/modules/oauth/dto/revoke.dto.ts`
- Modify: `apps/api/src/modules/oauth/oauth.service.ts` (new method after `introspect`)
- Modify: `apps/api/src/modules/oauth/oauth.controller.ts` (new route)
- Test: `apps/api/test/relying-party-sessions.spec.ts` (the two `revoke` tests already written in Task 2 Step 1)

**Interfaces:**
- Consumes: Task 2's `authenticateClient()`, Task 1's `revokedAt` column and `rp_session_update_scoped` policy.
- Produces: `OAuthService.revoke(token, clientId, clientSecret): Promise<{revoked: true}>` and `POST /v1/oauth/revoke` accepting `{token, clientId, clientSecret}` — what Communicator's logout route calls.

- [ ] **Step 1: Run the two revoke tests to confirm they fail**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && RUN_DB_TESTS=true pnpm --filter @nid/api test -- relying-party-sessions -t "revoke"
```

Expected: compile error `TS2339: Property 'revoke' does not exist on type 'OAuthService'`.

- [ ] **Step 2: Add the DTO**

Create `apps/api/src/modules/oauth/dto/revoke.dto.ts`:

```ts
import { IsString } from 'class-validator';

/**
 * Same credential pair as introspect: revoking someone else's session by
 * guessing token hashes is the worst thing this endpoint could allow, so the
 * caller proves it is the client that minted the session first.
 */
export class RevokeDto {
  @IsString()
  token!: string;

  @IsString()
  clientId!: string;

  @IsString()
  clientSecret!: string;
}
```

- [ ] **Step 3: Add the service method**

```ts
  /**
   * Idempotent by design: Communicator's logout calls this and must not show
   * the user an error because a session was already revoked (double-click,
   * a retry after a dropped response, or a second browser tab signing out the
   * same token). Revoking an unknown token, or one this client did not mint,
   * is 403 — the answer an RP needs is "that is not yours to revoke".
   */
  async revoke(token: string, clientId: string, clientSecret: string): Promise<{ revoked: true }> {
    const client = await this.authenticateClient(clientId, clientSecret);

    const session = await this.prisma.unscoped.relyingPartySession.findUnique({
      where: { tokenHash: sha256Hex(token) },
    });
    if (!session || session.clientId !== client.id) {
      throw new ForbiddenException('This session does not belong to that client.');
    }

    if (session.revokedAt === null) {
      await this.prisma.forTenant(session.tenantId, (tx) =>
        tx.relyingPartySession.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
      );
    }
    return { revoked: true };
  }
```

- [ ] **Step 4: Add the route and run the whole file**

In `oauth.controller.ts`, import `RevokeDto` and add after `introspect`:

```ts
  /** The relying party's backend calls this on logout — never the browser. */
  @Header('Cache-Control', 'no-store')
  @Post('revoke')
  revoke(@Body() dto: RevokeDto) {
    return this.oauth.revoke(dto.token, dto.clientId, dto.clientSecret);
  }
```

Then run every test in the file:

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && RUN_DB_TESTS=true pnpm --filter @nid/api test -- relying-party-sessions
```

Expected: `Tests: 12 passed, 0 failed`. If Postgres is unavailable this prints `12 skipped` — which does **not** satisfy this step; state plainly in your report that the live-DB tests could not run.

- [ ] **Step 5: Prove no-store actually ships, at the HTTP layer**

A unit test on the service cannot see the header. Boot the real API once and check it:

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && pnpm --filter @nid/api dev &
sleep 15 && curl -s -D - -o /dev/null -X POST http://localhost:4000/v1/oauth/introspect -H 'Content-Type: application/json' -d '{"token":"probe","clientId":"nope","clientSecret":"nope"}' | grep -iE "cache-control|HTTP/|\"message\""
```

Expected: `HTTP/1.1 403 Forbidden` (unknown client — the credential check runs before anything else), then `Cache-Control: no-store`. Note that `@nestjs/common`'s `@Header` sets it on the response the handler returns, so a 403 thrown from the service still carries it. Then kill the dev server: `kill %1`.

- [ ] **Step 6: Typecheck, lint, full test run, commit**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && pnpm --filter @nid/api typecheck && pnpm --filter @nid/api lint && pnpm --filter @nid/api test && git add apps/api/src/modules/oauth/dto/revoke.dto.ts apps/api/src/modules/oauth/oauth.service.ts apps/api/src/modules/oauth/oauth.controller.ts && git commit -m "feat(oauth): add idempotent session revocation"
```

Expected: `pnpm --filter @nid/api test` prints `Test Suites: … passed` and `Tests: … passed` (or the DB-gated suites skipping, which to report honestly per the environment note above).

---

### Task 5: bind the staff `role` to a `StaffRole` enum (N6)

Today `InviteStaffDto.role` is `@IsString()` and `tenant-staff.service.ts:33-34` defaults to `'STAFF'`, so `role: 'billing_overlord'` is accepted, stored and handed straight back by introspection. Communicator maps that string onto capabilities, which means one typo permanently and silently grants or denies — the boundary this task closes is nID's, and it is the last thing that lets `memberships:read` be trustworthy.

**Files:**
- Create: `packages/db/prisma/migrations/20261101121000_bind_staff_role_to_enum/migration.sql`
- Modify: `packages/db/prisma/schema.prisma` (new `enum StaffRole`, `TenantStaffMembership.role`)
- Modify: `apps/api/src/modules/tenant-staff/dto/invite-staff.dto.ts`
- Modify: `apps/api/src/modules/tenant-staff/tenant-staff.service.ts:33-34`
- Create: `apps/api/src/modules/tenant-staff/dto/invite-staff.dto.spec.ts`
- Test: `apps/api/test/tenant-staff.spec.ts` (assert the enum rejects a bogus role at the DTO boundary)

**Interfaces:**
- Consumes: nothing from Tasks 1–4.
- Produces: `StaffRole` (exported from `@nid/db` via `export * from '../generated/client'`), `InviteStaffDto.role?: StaffRole`, and introspection's `memberships[].role` values now drawn from a closed set — which is what Communicator's role→capability map in `rbac_service` switches on.

- [ ] **Step 1: Write the failing DTO validation spec**

Create `apps/api/src/modules/tenant-staff/dto/invite-staff.dto.spec.ts`. This one needs **no** database, so it runs in the default `pnpm test` gate — unlike the live-Postgres suites:

```ts
import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { InviteStaffDto } from './invite-staff.dto';

/**
 * The staff role is the value nID hands to every relying party's
 * authorization layer (POST /v1/oauth/introspect), so an unbounded string
 * here is a silent grant forever: Communicator maps 'OWNER' and
 * 'billing_overlord' to the same "nothing" while a typo'd 'admIn' quietly
 * stops matching. Validation lives in the DTO because the global
 * ValidationPipe is what actually enforces it on a request — the service
 * cannot see the difference between an absent role and a garbage one once
 * it has been defaulted, which is exactly why the default must be applied
 * where the value is known to be absent.
 */
function errorsFor(input: Record<string, unknown>): string[] {
  const instance = Object.assign(new InviteStaffDto(), input);
  return validateSync(instance, { whitelist: true }).map((e) =>
    Object.values(e.constraints ?? {}).join('; '),
  );
}

describe('InviteStaffDto', () => {
  it('accepts every role in the enum', () => {
    for (const role of ['OWNER', 'ADMIN', 'AGENT', 'VIEWER', 'STAFF']) {
      expect(errorsFor({ phone: '+15550001111', role })).toEqual([]);
    }
  });

  it('accepts an absent role, which the service then defaults to STAFF', () => {
    expect(errorsFor({ phone: '+15550001111' })).toEqual([]);
  });

  it('rejects a role outside the enum, in any casing', () => {
    expect(errorsFor({ phone: '+15550001111', role: 'super_admin' })).toHaveLength(1);
    expect(errorsFor({ phone: '+15550001111', role: 'owner' })).toHaveLength(1);
    expect(errorsFor({ phone: '+15550001111', role: 'BILLING_OVERLORD' })).toHaveLength(1);
  });

  it('still rejects a malformed phone alongside a valid role', () => {
    expect(errorsFor({ phone: 'short', role: 'ADMIN' })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && pnpm --filter @nid/api test -- invite-staff.dto
```

Expected: FAIL — the first three tests pass and `rejects a role outside the enum, in any casing` reports `Expected: 1, Received: 0`, because `@IsString()` accepts `'super_admin'`.

- [ ] **Step 3: Add the enum and the column type**

Create `packages/db/prisma/migrations/20261101121000_bind_staff_role_to_enum/migration.sql`:

```sql
-- TenantStaffMembership.role stops being free text. It was always meant to be
-- one of a handful of values (the column defaults to 'STAFF', and
-- InviteStaffDto's own comment describes a bounded set), but nothing enforced
-- it — so an API key holder could write role: 'whatever' and every consumer
-- of that membership, including a relying party's authorization layer, has to
-- guess what it means.
--
-- Any value outside the new enum aborts this migration rather than being
-- silently coerced or dropped: on a database with such a row, an operator has
-- to decide what that person actually was, and Postgres telling them so is
-- the correct outcome, not a failed deploy to route around.

CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'ADMIN', 'AGENT', 'VIEWER', 'STAFF');

ALTER TABLE "TenantStaffMembership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "TenantStaffMembership"
  ALTER COLUMN "role" TYPE "StaffRole" USING ("role"::"StaffRole");
ALTER TABLE "TenantStaffMembership"
  ALTER COLUMN "role" SET DEFAULT 'STAFF'::"StaffRole";
```

The `DROP DEFAULT` first is not decoration: the existing `'STAFF'` default is typed `text`, and Postgres refuses a `TYPE` change on a column whose default can't be implicitly cast to the new type.

In `schema.prisma`, add the enum next to `model TenantStaffMembership`:

```prisma
/// The closed set of staff roles a Tenant may grant. Bounded deliberately:
/// a relying party maps each one onto its own capabilities, so a value that
/// is not in this list is not "a role we haven't got to yet" — it is a row
/// nothing knows how to authorize.
enum StaffRole {
  OWNER
  ADMIN
  AGENT
  VIEWER
  STAFF
}
```

and change the model's field from `role String @default("STAFF")` to:

```prisma
  role      StaffRole @default(STAFF)
```

- [ ] **Step 4: Enforce it at the DTO and stop the service inventing strings**

Replace `apps/api/src/modules/tenant-staff/dto/invite-staff.dto.ts` with:

```ts
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { StaffRole } from '@nid/db';

/**
 * Adds an existing Account as staff for this tenant. Deliberately requires
 * the phone to already have a real, verified Account (no "pending invite"
 * placeholder state) — same honesty standard as the rest of this codebase:
 * ask the person to sign in once at apps/login-ui or apps/profile-ui
 * first, then invite them, rather than inventing an unverified stand-in
 * identity.
 */
export class InviteStaffDto {
  @IsString()
  @Length(6, 32)
  phone!: string;

  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;
}
```

In `tenant-staff.service.ts`, add `import { StaffRole } from '@nid/db';` and change both defaults (lines 33–34) so they read:

```ts
        update: { role: dto.role ?? StaffRole.STAFF },
        create: { tenantId, accountId: account.id, role: dto.role ?? StaffRole.STAFF },
```

- [ ] **Step 5: Run the DTO spec and the live staff spec**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && pnpm --filter @nid/db generate && pnpm --filter @nid/api test -- invite-staff.dto
```

Expected: `Tests: 4 passed`. Then, with Postgres up:

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && pnpm db:migrate && RUN_DB_TESTS=true pnpm --filter @nid/api test -- tenant-staff
```

Expected: `pnpm db:migrate` applies `20261101121000_bind_staff_role_to_enum`; the staff suite prints `Tests: … passed` — its existing assertions (`result.role).toBe('STAFF')`, `second.role).toBe('ADMIN')`) still hold, because both values are in the enum and Prisma hands enum members back as their string names.

- [ ] **Step 6: Typecheck the whole workspace and commit**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && pnpm typecheck && pnpm --filter @nid/api lint && pnpm db:validate && git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261101121000_bind_staff_role_to_enum/migration.sql apps/api/src/modules/tenant-staff && git commit -m "feat(tenant-staff): bound staff roles to a StaffRole enum"
```

`pnpm typecheck` (workspace-wide) rather than only `@nid/api` because a column type change is exactly the kind of edit that surfaces in another package: expect it silent. If it reports an error inside `apps/dashboard` or `apps/workflows` touching `membership.role`, fix that call site in this commit — do not widen the enum to make a broken call compile.

Expected: `5 files changed` (schema, migration, dto, service, new spec).

---

### Task 6: register Communicator as a scoped client, and record Project 0

`packages/db/prisma/seed.ts` already creates a Communicator RP client (`seedCommunicatorClient`, called at `:329`) with a default `redirectUri` of `http://localhost:8001/api/v1/auth/nid/callback`. That default is the reason nobody has ever completed a live nID login into Communicator: `8001` is not the port the API serves on (`frontend/vite.config.ts` proxies `/api` to `8000`), and `/api/v1/auth/nid/callback` is a JSON endpoint, not the browser landing page nID must redirect to. Fix the default and set the scopes/TTL that the Communicator plan's `introspect` calls assume, then write down what this plan added.

**Files:**
- Modify: `packages/db/prisma/seed.ts` (the `seedCommunicatorClient` function, and its doc comment)
- Modify: `docs/PHASES.md` (one new subsection under the "Login with nID" material)

**Interfaces:**
- Consumes: Task 1's `scopes`/`sessionTtlMinutes`, Task 5's `StaffRole` (seed's `role: 'STAFF'` literal at `:50` still typechecks).
- Produces: the `NID_CLIENT_ID`/`NID_CLIENT_SECRET` pair and the exact registered `redirect_uri` string that Communicator's `.env` must use — the deliverable the user has been waiting on to finish login.

- [ ] **Step 1: Update the seed's client row**

In `packages/db/prisma/seed.ts`, change `seedCommunicatorClient`'s redirect default and `create` call so they read:

```ts
  // The SPA route that finishes sign-in, NOT the backend's JSON callback:
  // nID redirects the browser here and apps/communicator's React app reads
  // ?code&state off it, then POSTs to /api/v1/auth/nid/callback itself. A
  // redirect_uri aimed at the API endpoint strands the code in a JSON
  // response nobody navigates. Vite's dev server has no explicit port in
  // frontend/vite.config.ts, so 5173 is the address this must name locally.
  const redirectUri =
    process.env.COMMUNICATOR_OAUTH_REDIRECT_URI ?? 'http://localhost:5173/auth/nid/callback';
  const clientId = `client_comm_${randomBytes(8).toString('hex')}`;
  const secret = generateSessionToken();
  await prisma.oAuthClient.create({
    data: {
      tenantId: tenant.id,
      name: 'Communicator',
      clientId,
      clientSecretHash: sha256Hex(secret.plaintext),
      redirectUris: [redirectUri],
      scopes: ['identity:read', 'memberships:read'],
      sessionTtlMinutes: 720,
    },
  });
  // eslint-disable-next-line no-console
  console.log(`Communicator OAuth client: ${clientId} / ${secret.plaintext} (redirect: ${redirectUri})`);
```

Then extend that function's doc comment by one paragraph, after its existing text:

```
 * Communicator authenticates every request to nID with the session this
 * client's token exchange mints (POST /v1/oauth/introspect), so its
 * scopes are identity:read + memberships:read and its sessionTtlMinutes is
 * 12 hours — a working day, and the reason a leaked bearer from this app
 * expires instead of living for nID's own 30-day AccountSession.
```

- [ ] **Step 2: Re-run the seed and capture the credential**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && pnpm db:seed 2>&1 | grep -i "communicator oauth"
```

Expected: `Communicator OAuth client: client_comm_xxxxxxxx /<32-char secret> (redirect: http://localhost:5173/auth/nid/callback)`. If instead it prints `Communicator OAuth client already seeded: client_comm_…`, the local database already has a row from an earlier run — the printed `clientId` is the live one, its secret is not recoverable, and the redirect URI on it is the old `8001` one. Rotate deliberately rather than quietly:

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && set -a && . ./.env && set +a && node -e "
const {PrismaClient}=require('./packages/db/generated/client');
const p=new PrismaClient();
p.oAuthClient.findMany({where:{tenant:{slug:'communicator'}},select:{clientId:true,redirectUris:true,scopes:true,sessionTtlMinutes:true}})
 .then(r=>{console.log(JSON.stringify(r,null,2));return p.\$disconnect()}).catch(e=>{console.error(String(e));process.exit(1)})
"
```

Expected: the current rows, so you can report exactly what needs rotating. **Do not delete a client row to make the seed re-print a secret without asking** — a relying party already configured with that `clientId`/secret pair loses its ability to log anyone in, and that is a shared-state change. If the row must be rotated, say so in your report and let the human decide.

- [ ] **Step 3: Verify the pair actually works end to end against the running API**

With the API up (`pnpm --filter @nid/api dev` in one shell) and login-ui up (`pnpm --filter @nid/login-ui dev`):

```bash
curl -s -X POST http://localhost:4000/v1/oauth/login-requests -H 'Content-Type: application/json' \
  -d '{"clientId":"client_comm_REPLACE_ME","redirectUri":"http://localhost:5173/auth/nid/callback"}'
```

Expected: `{"pollToken":"…","expiresAt":"…"}` — this is the call that today returns `Cannot POST /v1/oauth/login-requests` or a 404 from a wrong port, and it returning a real poll token is the first proof Communicator's login can work at all. Then, with a real approved login, exercise the minted credential:

```bash
curl -s -X POST http://localhost:4000/v1/oauth/token -H 'Content-Type: application/json' \
  -d '{"code":"REPLACED_FROM_CALLBACK","clientId":"client_comm_REPLACE_ME","clientSecret":"REPLACED_FROM_SEED_LOG","redirectUri":"http://localhost:5173/auth/nid/callback"}'
```

Expected: `{"account":{"id":"…","phone":"…","email":null,"phoneVerifiedAt":"…"},"session":{"token":"…","expiresAt":"…","scopes":["identity:read","memberships:read"]}}` — and **then, critically**, `curl` the `code` a second time and expect `{"statusCode":403,"message":"Invalid or already-used code."}`. Then pass the session token to `POST /v1/oauth/introspect` and confirm the `memberships` array lists the tenant(s) that account staffs with real `slug`/`name` values, not empty strings.

- [ ] **Step 4: Write the Project 0 entry in `docs/PHASES.md`**

Find the existing `### "Login with nID": closing the test-coverage gap` subsection and, after it, add:

```markdown
### "Login with nID": the credential an RP keeps (Project 0 for Communicator)

Exchange gave a relying party identity claims and nothing else — so from the
next request onwards it either held an `AccountSession` it had no business
holding (nID's own browser session: tenant-less, 30 days, no revocation), or
re-asked the person to log in. `RelyingPartySession` closes that: one minted
per exchange, scoped to what its `OAuthClient` allows (`identity:read`,
`memberships:read`), living `sessionTtlMinutes` (12h for Communicator), and
revocable.

`POST /v1/oauth/introspect` is what an RP spends it on — every request, in
Communicator's case — and returns `{active, accountId, expiresAt, scopes,
memberships[]}` with each membership's real tenant `slug`/`name`/`role`. A bad
client credential is a 403; an expired, revoked or foreign session is a
`200 {active: false}`, because "no" is a valid answer to the question that was
asked. `POST /v1/oauth/revoke` backs the RP's logout, idempotently.

Two things this deliberately does not do. It does not add a permissions
engine: nID says who an account is and which tenants it staffs with what role,
and each relying party maps that onto its own product surface — which is why
`TenantStaffMembership.role` now has to be a real enum rather than a string
someone can typo into a permanent wrong answer. And it does not add rate
limiting: `apps/api` has none today (no throttler, no global guard), and
inventing one inside a controller for one flow is a platform decision that
needs its own plan, not a side effect.
```

- [ ] **Step 5: Final gate**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && pnpm typecheck && pnpm lint && pnpm test && pnpm db:validate
```

Expected: all four silent / green, with `pnpm test` reporting the DB-gated suites as passed **or** explicitly naming how many skipped because `RUN_DB_TESTS` was unset — the second case is not done, per the environment note at the top of this plan.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/nommi/Downloads/scraper/nID-rp-sessions && git add packages/db/prisma/seed.ts docs/PHASES.md && git commit -m "feat(seed): register Communicator as a scoped client and document RP sessions"
```

- [ ] **Step 7: Report what the Communicator side needs**

Copy into your final message, verbatim from the seed output: the `clientId`, the `clientSecret`, the registered `redirect_uri`, and nID's `/v1/oauth/token` + `/v1/oauth/introspect` + `/v1/oauth/revoke` URLs. Communicator's `.env` needs `NID_CLIENT_ID`, `NID_CLIENT_SECRET`, `NID_BASE_URL` and a new `NID_LOGIN_UI_URL`, and `NID_REDIRECT_URI` must be set to exactly the registered `redirect_uri` string — a mismatch is a `400 That redirect URI is not registered for this client`, and it will look like a code bug rather than a config typo. The secret goes in `.env` and is never committed.

---

## Done criteria for this plan

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm db:validate` green in the worktree, and — if Postgres could be brought up — `RUN_DB_TESTS=true pnpm --filter @nid/api test` green with `relying-party-sessions.spec.ts` reporting **12 passed**, not skipped.
2. `RelyingPartySession` exists with `ENABLE`+`FORCE ROW LEVEL SECURITY` and the four `rp_session_*` policies, and `packages/db/src/rp-session-rls.spec.ts` proves `nid_app` can read a session with no tenant set and cannot write one for a foreign tenant.
3. `POST /v1/oauth/token` returns `{account, session:{token, expiresAt, scopes}}`, stores only `sha256Hex(token)`, and consumes the code + mints the session in one transaction (a failed mint leaves the code unconsumed).
4. `POST /v1/oauth/introspect` answers `{active:false}` for unknown/expired/revoked/foreign sessions, 403s for a bad client credential, returns real tenant `slug`s for an account staffing two different tenants, and ships `Cache-Control: no-store` — verified at the HTTP layer in Task 4 Step 5, not just by reading the decorator.
5. `POST /v1/oauth/revoke` is idempotent and cannot revoke another client's session.
6. `TenantStaffMembership.role` is a `StaffRole` enum, `InviteStaffDto` rejects `'super_admin'`/`'owner'`/`'BILLING_OVERLORD'`, and the migration aborts rather than coerces if a live database has a value outside the set.
7. `seedCommunicatorClient` registers `http://localhost:5173/auth/nid/callback` (never an `/api/v1/...` path) with `scopes` and `sessionTtlMinutes`, and its printed `clientId`/`clientSecret` are handed to the Communicator plan.
8. Nothing in `apps/login-ui`, `apps/dashboard` or the existing `login-requests`/`approve`/`claim` flow changed behaviourally — an RP that only does the old exchange still works, which is what lets this ship dark.

## Deviations from the spec, and why

- **Spec §4.1 N2 said "No `tenantId`".** Implemented with `tenantId`, mirroring `OAuthLoginRequest` (`migration.sql:219-232`). The spec's reasoning (`Account`/`AccountSession` are tenant-less) is true of the *account* but doesn't apply to a credential table whose rows gate tenant data and whose writes must be scoped. Spec amended.
- **Spec §4.1 N4 said "Body `{token}`".** Implemented as `{token, clientId, clientSecret}`. The same section says the endpoint is "guarded by the RP's own client credential", which the body didn't carry. Spec amended.
- **Spec §4.1 N4 said "joined to `Tenant`".** Not a join: `Tenant`'s `tenant_self` RLS policy makes a cross-tenant read return nothing, so each membership's tenant is read inside its own `forTenant` transaction. Spec amended.
- **Spec §4.1 N4 said the endpoint is rate-limited like checkout.** Withdrawn: nID has no rate limiter of any kind to be "like", and the billing plan never shipped its limiting task either. Spec amended with the reasoning recorded rather than deleted.
- **Spec §4.1 wrote `apps/api/jest.config.cjs`.** The file is `apps/api/jest.config.js`. Spec amended.
- **`relyingPartySession` is committed one task before the tests that exercise `introspect`/`revoke` on it.** Deliberate: one fixture set, one spec file, so the tests for the whole credential lifecycle share a tenant/client/account. Task 2 Step 6's commit note describes the split alternative if a reviewer objects to a partly-red file.
