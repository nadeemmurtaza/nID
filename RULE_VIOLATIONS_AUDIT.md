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

### Fixed 2026-11-16 (verified live by `scripts/e2e-smoke.sh`, 97 checks, also from an empty database)

- **Tenant isolation on reads** (S2, S19). The compat views ran with the
  superuser owner's rights, so reads skipped RLS. They are now
  `security_invoker`. Because that bypass was accidental and many paths
  depended on it, the legitimate cross-tenant paths got explicit
  policies (`20261116000003`): platform admin (`app.platform_admin`)
  and account-owned records (`app.account_id`). About 20 functions in
  `tenants`, `tenant-staff`, `account_verification`, `organizations` and
  `access` now open a context transaction. The `Organization` table has
  a deliberate `USING (true)` lookup policy, so its queries also filter
  by `tenant_id` explicitly.
- **Tenant context outside a transaction** in `organizations`,
  `sessions` and `verification_cases` (S2). Now transactional with
  commits, so those writes pass RLS.
- **New tenants could not authenticate.** Tenant create now picks its id
  first, sets the RLS context, mints the first API key and returns the
  real name, slug, secrets and `createdAt`.
- **OAuth** (S3, S4). Poll token and code hashed, code issued once at
  claim time, `redirect_uri` matched exactly against the client's
  registered URIs and bound to the code, client secret compared by
  hash, 10-minute expiry, and the access token is a real
  `account_session`. Also fixed a foreign key that made every login
  request fail (the public client id was bound instead of the row id).
- **Uploads** (S18). Verification documents, liveness frames and claim
  documents are written to storage (the pre-split code had the same
  `TODO`, so this was never working, not a regression). File type comes
  from leading bytes (`nid_storage::sniff_content_type`), not the client
  MIME type. Profile photo and gallery images were writing columns and
  an enum value that do not exist; now aligned with the schema.
- **Errors leaked gRPC and SQL text and lost their status** (S12). One
  classifier (`core::error::http_error`) gives 400/403/404/409/501 for
  domain errors and a generic 500 for infrastructure.
- **`DELETE /v1/accounts/me`** (C8) now erases the account: the schema
  cascades its own data and nulls the tenant-owned references.
- **Services** (S9): bind `127.0.0.1` by default (`BIND_ADDR` to
  override), require `APP_DATABASE_URL` (no superuser fallback), 5 s DB
  acquire timeout, dev mode defaults off.
- **Audit trail** (S20): API-key mint and revoke, staff add and remove,
  role create, update, delete, assign and unassign, and tenant create
  and update are recorded. The request-serving role can no longer
  UPDATE or DELETE the log.
- **Input validation** (S6), profile content only: http(s)-only link
  URLs, length limits and an email check on the public contact form.
- **Health check** (P15): `/health` queries Postgres and returns 503
  when it is down.
- **CI and scanning** (S13, S16): build, test and `cargo audit` on every
  PR, Dependabot (cargo, npm, actions) and CodeQL for the TypeScript
  apps. The workflows themselves have not run on GitHub yet; the same
  commands pass locally. Two `cargo audit` advisories are ignored with
  the reason recorded in `.cargo/audit.toml` (sqlx's sqlite and mysql
  drivers are in the lockfile but not compiled).
- **Rate limiting** (P7): the quota was one request per 10 seconds
  (`per_second(10)` sets an interval); now 10 per second, burst 30.

Added in the second round (same verification):

- **RLS on the access-control tables** (S2): `AccessGrant`, `RoleDefinition`,
  `RoleAssignment`, `Department`, `DepartmentAssignment`, `Invitation` and
  `Brand` now enforce tenant (Brand: organization membership) policies, and
  every function in those crates and the brands module runs in a context
  transaction on one connection. `accept_invitation` is now atomic.
- **API-key scopes and per-key rate limits** (S4): a request needs
  `<resource>:read|write` derived from its path (write implies read),
  tenant administration needs `tenant-admin`, and a key can only mint keys no
  more powerful than itself. Enforced in both extractors that accept keys.
- **Service authentication and TLS** (S9): `nid-service-auth` adds a shared
  bearer token (constant-time check; mandatory off loopback) and optional TLS
  to the gRPC hop. Clients share one cached channel with connect and call
  timeouts instead of a new connection per call; an unreachable service is a
  503 with no internals. Verified including rejection of a missing or wrong
  token, a real CA and leaf certificate, plaintext against the TLS port, and an
  untrusted CA.
- **Production login codes** (S12): Twilio SMS delivery, with the code never
  logged. Verified against a local mock of the Twilio API.
- **Self-service verification cases**: the platform tenant `self` has the same
  per-claim-type policies the seed gives the demo tenants (ordinary rows to
  edit); cases pick a policy by claim type and level.
- **Verification sessions** never worked (the case crate hashed the token with
  its own byte-sum, not SHA-256) and their uploads wrote columns that do not
  exist. Fixed and tested end to end with a real document and liveness frames.
- **SQL against the schema**: `scripts/validate-sql.py` PREPAREs every static
  SQL string against a live schema. 37 of 303 failed, which meant offers,
  business hours, links, social links, contact messages, services,
  availability, appointments and organization membership had never worked. All
  314 now prepare, those features are tested live (a visitor books a slot, a
  double booking is a 409, the owner confirms and cancels, an organization
  invite is accepted), and CI runs the validator on every PR.
- **Appointment slots**: the uniqueness ignored status, so a cancelled
  appointment blocked its time forever; now a partial unique index.
- **CI**: build, test, `cargo audit`, CodeQL, the SQL validator, and the
  frontend typecheck, build and contrast check all run on every PR. CI and
  CodeQL have run green on GitHub; the Qodo reviewer fails because its trial
  ended and gates nothing.
- **Design and accessibility** (D2, D5, D10, D21, C3, C8, C17, S19 UX):
  contrast measured and fixed (15 failing pairings to 0, checked in CI);
  Inter removed; `lucide-animated` replaced by a first-party icon set
  (decision recorded in CONVENTIONS rule 2); flat elevation; every bare
  "Loading..." is a skeleton; a native-dialog confirmation guards all 12
  one-click destructive actions; one shared consent banner with a real consent
  store replaces the inert one; and a Delete account control calls the working
  endpoint. Verified in a real browser (`scripts/ui-smoke.js`).


### Still open: security and core function

1. **Legal and business content** (C1, C2, C11, C15; deliberately not
   written): the privacy policy still describes a different product (email
   and password instead of phone, ID documents and face capture), the terms
   have a placeholder governing law, there is no legal entity or address, and
   it makes unsupported claims (AES-256, bcrypt, 99.9% uptime). These need a
   person who can state the real facts; the consent banner and deletion
   control are real but the text they link to is not.
2. **Not exercised live**: organization decline, username-based and email
   invitations, brand updates and removal, the verification-case resolve flow
   after a self-service case is created (nothing runs a policy's methods: no
   workflow engine is wired up, so cases stay PENDING), and stored images
   are not served back as bytes (the public photo endpoints return a key).
3. **Webhook secrets** are stored in plaintext columns, and session tokens
   live in `localStorage` in the browser (S10, S4).
4. **Audit coverage** (S20): departments, invitations, access-grant changes,
   brands and booking are not audited (api keys, staff, roles and tenant
   changes are). Account deletion is logged to the application log only.
5. **Validation** (S6) beyond profile content: the `validator` crate is
   unused elsewhere.
6. **Services accept any caller that holds the shared token.** That is
   service-level authentication, not per-user: a compromised service or the
   token still grants everything its role can do. mTLS with per-service
   identities would be the next step.
7. **Email**: there is no email provider (email verification codes are only
   logged in dev mode) and no unsubscribe flow (C9), because nothing sends
   email.
8. **Age and parental consent** (C6, C7): the terms state 16+, and no age step
   exists.

### Production readiness

- **Rate limiting** (P7, S5): partial. Per peer IP only, so behind a
  proxy every client shares one bucket; no per-user limit; state is
  in-process, so each replica counts separately; `/health` is
  limited too; 429 responses carry no security headers. (The quota
  itself is fixed, see above.)
- **Health checks** (P15): the API checks Postgres; the 17 services
  have no health endpoint.
- **Timeouts, retries, circuit breaker** (P16, P17): 141 call sites
  open a new plaintext HTTP/2 connection per request with no
  timeout or retry; one slow service hangs API requests.
- **Pooling** (P10): partial. The API pool is configured and the
  services now have a 5 s acquire timeout, but each uses
  `max_connections(5)` and the total (17 x 5 + 10 + 1 = 96) sits
  against Postgres's default of 100.
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
  of the lost transactions and the lossy tenant-create response (both
  fixed). It also committed a binary file `null` at the repo root and
  `allowBuilds: ... "set this to true or false"` placeholders in
  `pnpm-workspace.yaml` (both still there).
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
  and `db`, and there is no NATS code. **Update 2026-11-16:** NATS
  publish code now exists (`crates/event-bus`, wired into
  `crates/tenants`, `crates/organizations`, and `apps/rust-api`'s
  brands module) — it's a flagged, local-dev-only interim per
  `COMMUNICATION.md`'s own rule that the real bus belongs in
  `core-newax`, not a claim that the gap is closed. Account/customer
  identity events are not wired (see below).
- **Customer identity events**: now wired (2026-11-16, second pass)
  into `crates/accounts`'s `verify_otp` ("updated"), `register`
  ("created"), and `delete_account` ("deleted"). This crate had a
  concurrent session's uncommitted onboarding changes in flight at
  the time (`name`/`password` fields) — the publish calls were added
  as small, additive hooks around existing queries rather than
  restructuring anything, to minimize collision risk, and
  `cargo check --workspace` stayed clean afterward. `login` (password
  sign-in) was left alone: it's read-only, no identity field changes.
  `verify_email` was also left alone: `CustomerEvent` doesn't carry a
  verified-email flag, so there's nothing for it to publish yet.
- **Found 2026-11-16, in Communicator, not fixed here**:
  Communicator already has unused webhook-based sync scaffolding
  (`crates/nid_tenant_sync`, `nid_organization_sync`, `nid_brand_sync`,
  tables `nid_tenants`/`nid_tenant_mapping`/`nid_organization_mapping`)
  that bypasses `COMMUNICATION.md`'s event-bus mandate by design
  (`ProcessWebhook` RPCs, REST+HMAC) — nothing on nID's side calls
  it, so it's dead code, not a live competing system, but it's
  undocumented anywhere and should be removed or explicitly
  superseded rather than left to confuse the next person who finds
  it. Separately, migration `0064_nid_sync.sql`'s views (
  `v_personal_profile`, `v_work_profile`, etc.) assume a literally
  shared Postgres instance between nID and Communicator — the two
  repos' `.env.example` files show they are not (`nid` vs.
  `communicator` databases) — so those views cannot have ever
  resolved and are not applied schema, just misleading dead SQL. See
  Communicator's own copy of this file for the matching note.
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

### Compliance and accessibility (what is left)

- **Privacy Policy and Terms** (C1, C2, C11, C15): see open item 1 above. The
  terms are also not linked from the sign-up form, and `verify-ui`,
  `dashboard` and the `profile-ui` public forms carry no legal links.
- **Forms** (C4): `fullName` is collected at sign-up and never sent. Third
  party SDK disclosure (C5) says the vendor "may vary".
- **Age** (C6): the terms say 16+ and no age step exists.
- **Licensing** (C10): no licence record for the fonts and images in use.
- **Alt text** (C16): gallery photos use `alt=""`.
- **Keyboard and labels** (C18): upload inputs are unreachable by keyboard (a
  `display:none` input inside a non-focusable label), the dashboard has 35
  labels without `htmlFor`, and three inputs have no label.
- **Fixed this round**: contrast (C17, measured and CI-checked), the consent
  banner (C3, now a real store, equal-weight buttons, in all four apps), and
  the deletion control (C8).
- **Followed**: Accept and Decline have equal prominence (C12). **No surface
  yet**: children's data (C7), email sending (C9), checkout (C13).

### Design and UX (what is left)

Fixed this round: Inter, Lucide, card shadows, skeleton loaders, one-click
destructive actions, motion preferences and focus rings (D2, D5, D10, D21,
`UX_UI_RULES.md` reduced motion). Still open:

- **Copy and decoration**: about 50 em dashes in UI strings (D9), emojis
  (`dashboard/app/page.tsx:1676`), two coloured left stripes (D11), hover
  animations on a filter brightness (D28), and the headline "Your work,
  connected." (UNSLOP 9).
- **Missing SaaS patterns**: command palette and shortcuts, debounce and
  throttle, inline validation, bulk actions, a shared data table, filtering,
  an app-level 404 and `error.tsx`, retry on error states, and a mobile layout
  (one `@media` rule in the whole repo).
- **`UX_UI_RULES.md`**: literal durations instead of motion tokens, a linear
  easing (`dashboard/app/globals.css:161`), hit areas of 24 to 36 px on small
  buttons, 10 flat navigation items, dashboard tabs held in state so Back
  does not work.
- **`UNSLOP_DESIGN_RULES.md`**: literal px and hex outside tokens, a parallel
  palette in `login-ui/app/brand.ts`, mixed icon sets in places, no
  `text-wrap` or `tabular-nums`, hex tokens instead of OKLCH.
- **Placeholders shipped**: `/security` reads "This page is a placeholder."
  (`login-ui/app/security/page.tsx:10`); `profile-ui/app/page.tsx:10` shows
  `nid.example/your-slug`.

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

### Fixed 2026-11-16 (verified live by `scripts/e2e-smoke.sh`, 97 checks, also from an empty database)

- **Tenant isolation on reads** (S2, S19). The compat views ran with the
  superuser owner's rights, so reads skipped RLS. They are now
  `security_invoker`. Because that bypass was accidental and many paths
  depended on it, the legitimate cross-tenant paths got explicit
  policies (`20261116000003`): platform admin (`app.platform_admin`)
  and account-owned records (`app.account_id`). About 20 functions in
  `tenants`, `tenant-staff`, `account_verification`, `organizations` and
  `access` now open a context transaction. The `Organization` table has
  a deliberate `USING (true)` lookup policy, so its queries also filter
  by `tenant_id` explicitly.
- **Tenant context outside a transaction** in `organizations`,
  `sessions` and `verification_cases` (S2). Now transactional with
  commits, so those writes pass RLS.
- **New tenants could not authenticate.** Tenant create now picks its id
  first, sets the RLS context, mints the first API key and returns the
  real name, slug, secrets and `createdAt`.
- **OAuth** (S3, S4). Poll token and code hashed, code issued once at
  claim time, `redirect_uri` matched exactly against the client's
  registered URIs and bound to the code, client secret compared by
  hash, 10-minute expiry, and the access token is a real
  `account_session`. Also fixed a foreign key that made every login
  request fail (the public client id was bound instead of the row id).
- **Uploads** (S18). Verification documents, liveness frames and claim
  documents are written to storage (the pre-split code had the same
  `TODO`, so this was never working, not a regression). File type comes
  from leading bytes (`nid_storage::sniff_content_type`), not the client
  MIME type. Profile photo and gallery images were writing columns and
  an enum value that do not exist; now aligned with the schema.
- **Errors leaked gRPC and SQL text and lost their status** (S12). One
  classifier (`core::error::http_error`) gives 400/403/404/409/501 for
  domain errors and a generic 500 for infrastructure.
- **`DELETE /v1/accounts/me`** (C8) now erases the account: the schema
  cascades its own data and nulls the tenant-owned references.
- **Services** (S9): bind `127.0.0.1` by default (`BIND_ADDR` to
  override), require `APP_DATABASE_URL` (no superuser fallback), 5 s DB
  acquire timeout, dev mode defaults off.
- **Audit trail** (S20): API-key mint and revoke, staff add and remove,
  role create, update, delete, assign and unassign, and tenant create
  and update are recorded. The request-serving role can no longer
  UPDATE or DELETE the log.
- **Input validation** (S6), profile content only: http(s)-only link
  URLs, length limits and an email check on the public contact form.
- **Health check** (P15): `/health` queries Postgres and returns 503
  when it is down.
- **CI and scanning** (S13, S16): build, test and `cargo audit` on every
  PR, Dependabot (cargo, npm, actions) and CodeQL for the TypeScript
  apps. The workflows themselves have not run on GitHub yet; the same
  commands pass locally. Two `cargo audit` advisories are ignored with
  the reason recorded in `.cargo/audit.toml` (sqlx's sqlite and mysql
  drivers are in the lockfile but not compiled).
- **Rate limiting** (P7): the quota was one request per 10 seconds
  (`per_second(10)` sets an interval); now 10 per second, burst 30.

Added in the second round (same verification):

- **RLS on the access-control tables** (S2): `AccessGrant`, `RoleDefinition`,
  `RoleAssignment`, `Department`, `DepartmentAssignment`, `Invitation` and
  `Brand` now enforce tenant (Brand: organization membership) policies, and
  every function in those crates and the brands module runs in a context
  transaction on one connection. `accept_invitation` is now atomic.
- **API-key scopes and per-key rate limits** (S4): a request needs
  `<resource>:read|write` derived from its path (write implies read),
  tenant administration needs `tenant-admin`, and a key can only mint keys no
  more powerful than itself. Enforced in both extractors that accept keys.
- **Service authentication and TLS** (S9): `nid-service-auth` adds a shared
  bearer token (constant-time check; mandatory off loopback) and optional TLS
  to the gRPC hop. Clients share one cached channel with connect and call
  timeouts instead of a new connection per call; an unreachable service is a
  503 with no internals. Verified including rejection of a missing or wrong
  token, a real CA and leaf certificate, plaintext against the TLS port, and an
  untrusted CA.
- **Production login codes** (S12): Twilio SMS delivery, with the code never
  logged. Verified against a local mock of the Twilio API.
- **Self-service verification cases**: the platform tenant `self` has the same
  per-claim-type policies the seed gives the demo tenants (ordinary rows to
  edit); cases pick a policy by claim type and level.
- **Verification sessions** never worked (the case crate hashed the token with
  its own byte-sum, not SHA-256) and their uploads wrote columns that do not
  exist. Fixed and tested end to end with a real document and liveness frames.
- **SQL against the schema**: `scripts/validate-sql.py` PREPAREs every static
  SQL string against a live schema. 37 of 303 failed, which meant offers,
  business hours, links, social links, contact messages, services,
  availability, appointments and organization membership had never worked. All
  314 now prepare, those features are tested live (a visitor books a slot, a
  double booking is a 409, the owner confirms and cancels, an organization
  invite is accepted), and CI runs the validator on every PR.
- **Appointment slots**: the uniqueness ignored status, so a cancelled
  appointment blocked its time forever; now a partial unique index.
- **CI**: build, test, `cargo audit`, CodeQL, the SQL validator, and the
  frontend typecheck, build and contrast check all run on every PR. CI and
  CodeQL have run green on GitHub; the Qodo reviewer fails because its trial
  ended and gates nothing.
- **Design and accessibility** (D2, D5, D10, D21, C3, C8, C17, S19 UX):
  contrast measured and fixed (15 failing pairings to 0, checked in CI);
  Inter removed; `lucide-animated` replaced by a first-party icon set
  (decision recorded in CONVENTIONS rule 2); flat elevation; every bare
  "Loading..." is a skeleton; a native-dialog confirmation guards all 12
  one-click destructive actions; one shared consent banner with a real consent
  store replaces the inert one; and a Delete account control calls the working
  endpoint. Verified in a real browser (`scripts/ui-smoke.js`).


### Still open: security and core function

1. **Legal and business content** (C1, C2, C11, C15; deliberately not
   written): the privacy policy still describes a different product (email
   and password instead of phone, ID documents and face capture), the terms
   have a placeholder governing law, there is no legal entity or address, and
   it makes unsupported claims (AES-256, bcrypt, 99.9% uptime). These need a
   person who can state the real facts; the consent banner and deletion
   control are real but the text they link to is not.
2. **Not exercised live**: organization decline, username-based and email
   invitations, brand updates and removal, the verification-case resolve flow
   after a self-service case is created (nothing runs a policy's methods: no
   workflow engine is wired up, so cases stay PENDING), and stored images
   are not served back as bytes (the public photo endpoints return a key).
3. **Webhook secrets** are stored in plaintext columns, and session tokens
   live in `localStorage` in the browser (S10, S4).
4. **Audit coverage** (S20): departments, invitations, access-grant changes,
   brands and booking are not audited (api keys, staff, roles and tenant
   changes are). Account deletion is logged to the application log only.
5. **Validation** (S6) beyond profile content: the `validator` crate is
   unused elsewhere.
6. **Services accept any caller that holds the shared token.** That is
   service-level authentication, not per-user: a compromised service or the
   token still grants everything its role can do. mTLS with per-service
   identities would be the next step.
7. **Email**: there is no email provider (email verification codes are only
   logged in dev mode) and no unsubscribe flow (C9), because nothing sends
   email.
8. **Age and parental consent** (C6, C7): the terms state 16+, and no age step
   exists.

### Production readiness

- **Rate limiting** (P7, S5): partial. Per peer IP only, so behind a
  proxy every client shares one bucket; no per-user limit; state is
  in-process, so each replica counts separately; `/health` is
  limited too; 429 responses carry no security headers. (The quota
  itself is fixed, see above.)
- **Health checks** (P15): the API checks Postgres; the 17 services
  have no health endpoint.
- **Timeouts, retries, circuit breaker** (P16, P17): 141 call sites
  open a new plaintext HTTP/2 connection per request with no
  timeout or retry; one slow service hangs API requests.
- **Pooling** (P10): partial. The API pool is configured and the
  services now have a 5 s acquire timeout, but each uses
  `max_connections(5)` and the total (17 x 5 + 10 + 1 = 96) sits
  against Postgres's default of 100.
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
  of the lost transactions and the lossy tenant-create response (both
  fixed). It also committed a binary file `null` at the repo root and
  `allowBuilds: ... "set this to true or false"` placeholders in
  `pnpm-workspace.yaml` (both still there).
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
  and `db`, and there is no NATS code. **Update 2026-11-16:** NATS
  publish code now exists (`crates/event-bus`, wired into
  `crates/tenants`, `crates/organizations`, and `apps/rust-api`'s
  brands module) — it's a flagged, local-dev-only interim per
  `COMMUNICATION.md`'s own rule that the real bus belongs in
  `core-newax`, not a claim that the gap is closed. Account/customer
  identity events are not wired (see below).
- **Customer identity events**: now wired (2026-11-16, second pass)
  into `crates/accounts`'s `verify_otp` ("updated"), `register`
  ("created"), and `delete_account` ("deleted"). This crate had a
  concurrent session's uncommitted onboarding changes in flight at
  the time (`name`/`password` fields) — the publish calls were added
  as small, additive hooks around existing queries rather than
  restructuring anything, to minimize collision risk, and
  `cargo check --workspace` stayed clean afterward. `login` (password
  sign-in) was left alone: it's read-only, no identity field changes.
  `verify_email` was also left alone: `CustomerEvent` doesn't carry a
  verified-email flag, so there's nothing for it to publish yet.
- **Found 2026-11-16, in Communicator, not fixed here**:
  Communicator already has unused webhook-based sync scaffolding
  (`crates/nid_tenant_sync`, `nid_organization_sync`, `nid_brand_sync`,
  tables `nid_tenants`/`nid_tenant_mapping`/`nid_organization_mapping`)
  that bypasses `COMMUNICATION.md`'s event-bus mandate by design
  (`ProcessWebhook` RPCs, REST+HMAC) — nothing on nID's side calls
  it, so it's dead code, not a live competing system, but it's
  undocumented anywhere and should be removed or explicitly
  superseded rather than left to confuse the next person who finds
  it. Separately, migration `0064_nid_sync.sql`'s views (
  `v_personal_profile`, `v_work_profile`, etc.) assume a literally
  shared Postgres instance between nID and Communicator — the two
  repos' `.env.example` files show they are not (`nid` vs.
  `communicator` databases) — so those views cannot have ever
  resolved and are not applied schema, just misleading dead SQL. See
  Communicator's own copy of this file for the matching note.
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
  age step exists (C6); the deletion endpoint now works but no UI calls it (C8); no licence
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
