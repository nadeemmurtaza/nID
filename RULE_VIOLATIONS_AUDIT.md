# Rule Violations Audit (2026-11-15)

A point-in-time, breadth-first audit of both repos' actual code
against every rule in `CONVENTIONS.md`'s design anti-patterns,
`UX_UI_RULES.md`, `COMPLIANCE_AND_ACCESSIBILITY_RULES.md`,
`PRODUCTION_READINESS_RULES.md`, `SECURITY_RULES.md`,
`SAAS_UX_PATTERNS.md`, and `UNSLOP_DESIGN_RULES.md` — ~169 rules
total. This file is meant to be identical across both repos, same
status as the other rule files; update it whenever a violation gets
fixed or a new one is found, don't let it silently go stale. The nID
section was re-audited on 2026-11-16 (also against
`MODULE_SPLIT_PLAYBOOK.md`, `COMMUNICATION.md`, `ecosystem-stack.md`
and `ECOSYSTEM.md`) and Communicator's copy has not been synced to
it yet.

**Method and limits:** this was a grep/signal pass, not an exhaustive
read of every file. A rule marked "unverifiable statically" means it
needs a rendered app, a manual flow walkthrough, or legal/content
review to actually check — not that it's assumed clean. A rule with
no finding either way in a repo this size may still have violations
this pass didn't surface; treat "no finding" as "not yet checked,"
not "confirmed clean," outside of the items explicitly listed under
"Confirmed followed."

---

## Communicator

### Violated

- **No Lucide icons** (design anti-pattern 2) — `apps/web/package.json`
  depends on `lucide`.
- **No Inter/Geist/Space Grotesk** (design anti-pattern 10) —
  `tokens.css`'s `--font-sans` is `'Inter'`. Already flagged in the
  file itself; not a new finding.
- **No drop shadows** (design anti-pattern 5) — `tokens.css`'s
  `--elevation-*` tokens are drop-shadow values. Already flagged in
  the file itself; not a new finding.
- **Privacy Policy / Terms of Service** (compliance 1–2) — no
  privacy/terms files or routes found anywhere in the repo.
- **Consent banner** (compliance 3) — no cookie/consent banner
  component found.
- **Accessibility alt text** (compliance 16) — of 14 `<img>` tags
  found, only 7 have `alt=`; `WhatsAppQRCode.tsx`,
  `WhatsAppMediaComposer.tsx`, `WhatsAppMediaMessage.tsx`, and
  `LiveChatIntegration.tsx` render images with no `alt`.
- **Real business details** (compliance 11) — no footer/about page
  states the operating entity's name/contact/address; the "footer"
  grep hits found are WhatsApp message-template footers, unrelated.
- **Rate limiting** (production readiness 7 / security 5) — no
  rate-limiting crate (`tower-governor` or equivalent) in
  `backend-rs/Cargo.toml`; existing throttling is per-OTP-provider
  only, not API-wide.
- **CDN** (production readiness 5) — no CDN configuration found.
- **Queue + background jobs** (production readiness 8) — no durable
  job-queue crate; async work is ad hoc.
- **Timeouts + retries** (production readiness 16) — several
  `reqwest::Client::new()` calls (`external_otp_integration.rs:662`,
  `otp_engine.rs:985,1124`, `shopify_store_integration.rs:678`) use
  reqwest's default client, which has no timeout configured.
- **Circuit breaker** (production readiness 17) — none found.
- **Monitoring + alerts** (production readiness 18) — no Sentry/
  Prometheus/Datadog dependency anywhere.
- **k6 load test** (production readiness 19) — no load-test script or
  directory.
- **Security headers** (security 17) — no CSP/HSTS/X-Frame-Options/
  X-Content-Type-Options middleware in `main.rs`.
- **Lock down CORS** (security 8) — **partial violation**: the allowed
  origins are an explicit list (not `*`, which is correct), but
  `allow_methods(Any)` and `allow_headers(Any)` are wildcarded in both
  the dev and prod branches of `main.rs` (~lines 66–84).

### Confirmed followed

- **Health checks** — `GET /health` registered in `main.rs`.
- **Verify webhook signatures** — `services/signatures.rs` is actually
  imported and used in `routes/webhooks.rs` and `routes/live_proof.rs`.
- **Connection pooling** — `PgPoolOptions` used consistently across
  services.
- **Backup** — `docs/BACKUP.md` and `scripts/backup-databases.ps1`
  exist (whether failover is *tested*, per the rule's wording, is
  unverifiable statically).
- **Log admin actions** — `audit_log`/`AuditLog` referenced broadly
  across route files (`admin_system.rs`, `compliance_dashboard.rs`,
  `automation.rs`, `canned_macros_sla.rs`, `contacts.rs`, `otp.rs`,
  and more), not just the compliance-specific log.
- **Parameterized queries** — the known `compliance_dashboard::
  update_gdpr_request` bug (only `binds[0]` ever gets bound) is a
  correctness bug, not a SQL-injection violation: the query still
  uses `$n` placeholders and `.bind()`, never raw string
  interpolation of a user value.

### Unverifiable statically

Remove fake reviews / unsupported claims; color contrast ratio;
keyboard navigation; DB replication/sharding; age consent / parental
consent for children's data; hidden fees / dark patterns; file upload
type validation (upload routes exist — `omni_broadcast.rs`,
`erp_payments.rs`, `fin_vision.rs`, `commerce.rs`, `contacts.rs` —
but whether each validates real content vs. trusting client MIME
needs a per-file follow-up this pass didn't do); IDOR protection
(needs a per-endpoint ownership-check review, not conclusive from
spot checks at this repo's size); mobile-optimized layouts; skeleton
loader coverage (`Skeleton` found only in `ContactProfile.tsx` — other
pages' loading states need a broader per-page check).

---

## nID (re-audited 2026-11-16)

**Method.** Three read passes (Rust backend; conventions, playbook,
communication and stack docs; all four UIs) plus a live run of the
whole local stack (Postgres, 17 gRPC services, the API): a
no-credentials sweep of all 155 routes, header, CORS and rate-limit
probes, psql tests as `nid_app`, and a tenant-create and login flow.
**LIVE** marks a finding reproduced against the running stack; the
rest were read in code. S = `SECURITY_RULES.md`, P =
`PRODUCTION_READINESS_RULES.md`, C =
`COMPLIANCE_AND_ACCESSIBILITY_RULES.md`, D = `CONVENTIONS.md` design
anti-patterns.

The previous "Fixed (2026-11-15)" list is withdrawn. Several of its
entries were not fixes (a deletion endpoint that deletes nothing, a
consent banner that gates nothing, skeleton components nothing
imports, legal pages describing a different product). Each is
restated below with its real status.

### Launch blockers: security and core function

1. **Row-level security does not apply to reads** (S2, S19). All 60
   snake_case compat views in
   `crates/db-schema/migrations/20261115000000_baseline_from_prisma.sql`
   are owned by superuser `nid` and none is `security_invoker`, so a
   read through a view runs with the owner's rights. LIVE: as
   `nid_app` with no tenant context, or with another tenant's,
   `"Subject"` returns 0 rows and `subject` returns the other
   tenant's row. Queries with no tenant predicate therefore read
   across tenants: `crates/verification_cases/src/lib.rs:373-383`
   (latest 100 cases with subject name, email and phone), `:447`,
   `:518`, `:544`; `crates/subjects/src/lib.rs:260`;
   `crates/organizations/src/lib.rs:157`, `:173`. Separately,
   `AccessGrant`, `RoleAssignment`, `Department`, `Invitation` and
   `Brand` have no RLS enabled at all. Predates the SQLx cutover (the
   views came from Prisma migration `20261114160000`).
2. **Tenant context is set outside a transaction in three crates**
   (S2, `MODULE_SPLIT_PLAYBOOK.md` §5.2). `crates/organizations` (6
   sites), `crates/sessions` (5) and `crates/verification_cases` (9)
   call `set_config('app.tenant_id', $1, true)` on a bare
   `acquire()`. The pre-split code used `begin()` (`git show
   4ff2241^`). LIVE: the setting is gone on the next statement and
   the insert fails with "new row violates row-level security
   policy". Writes do go through RLS (the view triggers run as the
   caller), so creating organizations, verification sessions and
   verification cases cannot succeed as `nid_app`.
3. **A new tenant cannot obtain a credential.** LIVE: `POST
   /v1/tenants` mints no API key, and every API-key and staff route
   requires an existing API key (`modules/tenants/handlers.rs`,
   `modules/tenant_staff/handlers.rs`). The create response returns
   the webhook secret as both `webhookSecret` and
   `billingWebhookSecret`, never returns the real billing secret,
   and returns empty `name`, `slug`, `dataResidencyRegion` and
   `createdAt` (`services/tenants/src/main.rs:84`,
   `modules/tenants/service.rs:79-91`). Regression from the batch
   split.
4. **Uploaded files are discarded** (S18). `crates/sessions/src/lib.rs:194-214`
   and `crates/profile_content/src/lib.rs:624-657` insert a row with
   an invented URL; no crate or service depends on `nid-storage`
   (the pre-split sessions code had six storage calls). Identity
   documents and liveness captures return `accepted` and are lost.
   `core/upload.rs:44-49` also trusts the client-supplied MIME type.
5. **OAuth is not a working security boundary** (S3, S4).
   `crates/oauth/src/lib.rs:150` compares the raw client secret to
   `client_secret_hash`; `:146` ignores `redirect_uri` at token
   exchange; `:184` issues `{account_id}_{uuid}` as the access
   token, never stored, so it cannot be verified and it leaks the
   account id. Reported by the read pass and not re-verified: poll
   token and auth code stored unhashed, and unauthenticated `/claim`
   returning the code. Pre-existing, not caused by the split.
6. **Login OTP has no production path** (S12).
   `services/accounts/src/main.rs:151` defaults `OTP_SMS_DEV_MODE`
   to true. Dev mode logs the code with the phone number (LIVE);
   non-dev mode errors because no SMS vendor exists
   (`crates/accounts/src/lib.rs:104-110`). Email verification reuses
   the same flag.
7. **The 17 services are open on the network** (S9,
   `COMMUNICATION.md`). All bind `0.0.0.0` in plaintext with no
   authentication and trust the `tenant_id` and `account_id` in the
   request. All fall back to the superuser `DATABASE_URL` when
   `APP_DATABASE_URL` is unset.
8. **Errors leak internals and lose their status** (S12). No module
   maps gRPC status codes. LIVE: a public profile that does not
   exist returns 500 with the raw tonic status and metadata in the
   body; raw database error text reaches clients
   (`modules/accounts/handlers.rs:129-134`, the same pattern in about
   18 handler files).
9. **`DELETE /v1/accounts/me` deletes nothing** (C8).
   `modules/accounts/service.rs:136-146` revokes sessions, writes one
   log line and returns 204. The request is not persisted, and no UI
   calls the route.
10. **Audit trail is partial and editable** (S20). `AuditService` is
    constructed in `main.rs` and never called; the tenants, roles,
    departments, invitations, tenant-staff and accounts crates write
    no audit rows; `nid_app` holds UPDATE and DELETE on the audit
    log (`20261115000001_grant_nid_app.sql`, reproducing Prisma's
    blanket grant).
11. **API-key scopes and `rate_limit_per_minute` are stored and
    never enforced** (S4). Any key can do everything, including mint
    more keys.
12. **No input validation** (S6). The `validator` crate is unused.
    Unauthenticated contact messages have no length or format check
    (`crates/profile_content/src/lib.rs:783-790`); custom-link URLs
    have no scheme check (`:379-386`), so a `javascript:` link can be
    stored and served on a public profile.
13. **Nothing gates a merge** (S13, S16). The only workflow is
    `.github/workflows/qodo-review.yml`, paused for billing. No
    build, test, Dependabot, CodeQL or Semgrep. PRs #11 and #12 were
    merged with no review.
14. **Secrets at rest and in the browser.** Tenant webhook secrets
    are stored in `webhookSecretPlaintext` /
    `billingWebhookSecretPlaintext`; session tokens are kept in
    `localStorage` (`apps/login-ui/lib/api.ts:32`).

### Production readiness

- **Rate limiting** (P7, S5): partial. Per peer IP only, so behind a
  proxy every client shares one bucket; no per-user limit; state is
  in-process, so each replica counts separately; `/health` is
  limited too; 429 responses carry no security headers. Fixed
  2026-11-16: the quota was one request per 10 seconds
  (`per_second(10)` sets an interval), LIVE 147 of 155 probe
  requests got 429; now 10 per second with a burst of 30.
- **Health checks** (P15): `modules/health.rs:17` returns a static
  "ok" without touching the database; the services have none.
- **Timeouts, retries, circuit breaker** (P16, P17): 141 call sites
  open a new plaintext HTTP/2 connection per request with no
  timeout or retry; one slow service hangs API requests.
- **Pooling** (P10): partial. The API pool is configured; each
  service uses `max_connections(5)` with no timeouts, and the total
  (17 x 5 + 10 + 1 = 96) sits against Postgres's default of 100.
- **Pagination** (P13): no page parameters anywhere in `modules/`
  (`crates/tenants/src/lib.rs:273-279`).
- **Not present**: Redis or any cache (P6), a job queue or Temporal
  client in Rust (P8, so cases likely never progress), read
  replicas (P11), metrics or error tracking (P18), a k6 load test
  (P19), graceful shutdown or degradation in services (P20).
- **Likely**: uploads over about 2 MB fail on default body limits
  despite the 10 MB `MAX_FILE_SIZE`.

### Conventions, split playbook, communication, stack

- **Batch split commit `4ff2241`** broke the playbook's
  one-module-per-commit rule (9 modules, 78 files), and is the source
  of blockers 2, 3 and 4. It also committed a binary file `null` at
  the repo root and `allowBuilds: ... "set this to true or false"`
  placeholders in `pnpm-workspace.yaml`.
- **"No direct cross-module DB access"** (`CONVENTIONS.md` §3):
  violated. `account` is queried from 8 crates, `subject` from 6,
  `verification_case` from 5, `access_grant` from 4. The playbook
  says shared tables are fine; the two documents contradict each
  other.
- **Naming drift**: 11 protos name the service `*ApiService`, 6 use
  `*Service`; `ORG_PROFILES_*` env vars instead of
  `ORGANIZATION_PROFILES_*`; `services/tenant-staff` is kebab-case
  among snake_case folders; `billing`, `shared-types`, `storage` and
  `db-schema` are packaged `nid-*`, not `newax-*`; protos live at
  `proto/nid/<module>/v1`.
- **Commits**: none of the last 45 uses Conventional Commits; six
  unsquashed commits sit on `main`'s first-parent history.
- **"SQLx, compile-time checked"** (`ecosystem-stack.md`): false.
  Zero `query!` macros, 339 runtime `sqlx::query(...)` calls, no
  `.sqlx` cache, so `SQLX_OFFLINE=true` does nothing.
- **Stack gaps still true**: the public API is axum REST (no
  tonic-web or Connect), no moka or Redis, the four frontends are
  Next 15 and React 19 rather than Svelte, Prisma is still used by
  `apps/api`, `apps/workflows`, `verification-providers`, `billing`
  and `db`, and there is no NATS code.
- **Ownership** (`ECOSYSTEM.md`): nID holds business data it is
  meant never to own: booking (appointments, availability,
  services), offers with prices, contact messages, and a full
  billing platform (invoices, payments, subscriptions, ledger).
  None is listed under "Known misplacements". The secrets vault nID
  is meant to own does not exist.
- **Stale docs**: `CONVENTIONS.md:257` ("three pilot services"),
  `:320-332` (remaining modules; the real remainder is brands and
  profiles), `:384` ("only 3 Rust library crates"; there are 22);
  `COMMUNICATION.md:185` ("14 Communicator, 6 nID"; nID has 17);
  `ecosystem-stack.md:142-179` (says no tonic or proto exists, omits
  `db-schema`); root `README.md` still presents `apps/api` and
  `prisma migrate deploy`.
- **Cross-repo drift**: `CONVENTIONS.md`, `tokens.css` and this file
  no longer match Communicator's copies.

### Compliance and accessibility

- **Privacy Policy** (C1): describes a different product. It claims
  an email address and a bcrypt-hashed password
  (`apps/login-ui/app/privacy/page.tsx:16-18,86`); sign-up collects
  name and phone with OTP and there is no password. It omits ID
  documents, face capture, national ID numbers, public-profile data
  and visitor contact and booking data.
- **Terms** (C2): not linked from the sign-up form; claims accounts
  can be closed from settings (`terms/page.tsx:73`) when the account
  page only offers Sign out; governing law is a placeholder
  (`:88`).
- **Consent banner** (C3): gates nothing. Both branches are
  `console.log` (`consent-banner.tsx:27-33`), the stored choice is
  never read, it announces analytics cookies that do not exist, and
  it is in login-ui only. `verify-ui` starts face capture with no
  consent notice or policy link.
- **Unsupported claims** (C15): AES-256, bcrypt, MFA-gated staff
  access, 99.9% uptime (`privacy/page.tsx:85-87`, `terms/page.tsx:52`).
- **Operator identity** (C11): no legal entity or address anywhere;
  `support@newax.com` appears only on these two pages.
- **Also violated**: `fullName` collected and never sent (C4); SDK
  disclosure says the vendor "may vary" (C5); Terms say 16+ and no
  age step exists (C6); no deletion path in any UI (C8); no licence
  record for Inter or `lucide-animated` (C10); gallery photos use
  `alt=""` (C16); upload inputs are unreachable by keyboard, the
  dashboard has 35 labels and no `htmlFor` (C18).
- **Contrast** (C17), computed from tokens: white on accent 3.19,
  accent as text about 3.1, `--success` text 1.6 to 1.8, `--warn`
  text 3.1 to 3.5, `--color-ink-faint` 3.07 to 3.23 (light) and 3.82
  to 4.08 (dark). All below 4.5:1.
- **Followed**: Accept and Decline have equal prominence (C12).
  **No surface yet**: children's data (C7), email sending (C9),
  checkout (C13).

### Design and UX

- **Banned defaults still in use**: `lucide-animated` in all four
  apps (D2); card shadows in all four (D5); Inter via
  `next/font/google` in dashboard, profile-ui and verify-ui and in
  `login-ui/app/brand.ts:64` (D10; only `tokens.css` changed, and no
  app uses `--font-sans`); emojis (`dashboard/app/page.tsx:1676`);
  about 50 em dashes in UI strings (D9); two left stripes (D11);
  hover animations (D28).
- **login-ui is partly unstyled**: no `button` or `.field-label`
  rule, `.btn-link` uses an undefined `--on-accent`; the dashboard
  has 24 class names with no CSS.
- **Skeleton loaders** (D21): zero usages;
  `packages/design-tokens/Skeleton.tsx` is never imported. Loading
  is bare "Loading…" text in about 12 places.
- **Destructive actions**: 12 of 13 run on one click (revoke API
  key, remove staff, delete image).
- **Missing patterns**: command palette and shortcuts, debounce and
  throttle, inline validation, bulk actions, a shared table,
  filtering, app-level 404 and `error.tsx`, retry on error states;
  one `@media` rule in the whole repo.
- **`UX_UI_RULES.md`**: literal durations and default easing instead
  of motion tokens, linear easing (`dashboard/app/globals.css:161`),
  hit areas of 24 to 36 px, 10 flat nav items, dashboard tabs held
  in state so Back does not work, no `prefers-reduced-motion`
  anywhere.
- **`UNSLOP_DESIGN_RULES.md`**: literal px and hex outside tokens, a
  parallel palette in `login-ui/app/brand.ts`, mixed icon sets, no
  `text-wrap` or `tabular-nums`, hex tokens instead of OKLCH, no
  safe-area inset on the fixed banner.
- **Placeholders shipped**: `/security` reads "This page is a
  placeholder." (`login-ui/app/security/page.tsx:10`);
  `profile-ui/app/page.tsx:10` shows `nid.example/your-slug`.

### Confirmed followed

- **Auth on every route** (S3). LIVE: with no credentials, 129 of
  155 routes return 401. The other 26 are health, login, OAuth,
  public profile and token-in-URL verification routes, public by
  design. The platform-admin guard rejects an empty token, fails
  closed when the secret is unset and compares in constant time
  (`core/auth/platform_admin.rs:69-76`).
- **CORS** (S8). LIVE: explicit allowlist; a disallowed origin gets
  no `Access-Control-Allow-Origin`. `X-Tenant-Id` added to the
  allowed headers on 2026-11-16.
- **Security headers** (S17). LIVE: CSP, HSTS, `nosniff`,
  `X-Frame-Options`, `Referrer-Policy` on API responses.
- **Parameterized queries** (S7): dynamic SQL interpolates only fixed
  column lists and `$n` placeholders.
- **`X-Tenant-Id`** is checked against the caller's memberships
  before use (`core/auth/tenant_actor.rs:114-125`).
- **Split mechanics**: 17 unique ports with matching client and
  server defaults, no `sqlx` left in the split modules, no module
  crate depends on another, the tracking table has all 17 rows.
- **`CLAUDE.md` and `AGENT.md`** match, and the rule counts they
  quote match the files.

### Not checked, or needs a browser

Deployment-level rules (P1, P2, P4, P12, P14; S1 has no bucket
yet); tenant webhook-URL SSRF; real tab order and focus visibility;
most motion and typography rules in `UX_UI_RULES.md` and
`UNSLOP_DESIGN_RULES.md` (rules 1, 2, 11, 20, 26, 28 and 30 of the
latter were not checked at all).

---

## What to do with this

This file is a snapshot, not a task tracker — it doesn't get a
checkbox workflow of its own. When a violation above gets fixed,
remove its bullet and note the fix in the fixing commit's message;
when a deeper pass finds something this breadth-first audit missed
(especially under "unverifiable statically" — IDOR, upload
validation, and skeleton-loader coverage were explicitly flagged as
needing a second, deeper pass even within what this audit could
reach), add it here the same way.
