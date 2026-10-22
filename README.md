# nID

Identity and profile verification platform — a system of record and verification
orchestrator for people, companies, organizations, and tenants. Sold to third
parties as an external product (Persona/Sumsub/oneID.uz-shaped), not just an
internal Newax tool. See `docs/HOUSE-RULES.md` for engineering conventions and
`docs/PHASES.md` for the delivery roadmap this scaffold implements Phase 0 of.

## Part of the NEWAX ecosystem

This is one of several connected NEWAX repos, and **this one is the single
identity provider for all of them** — login, 2FA, OAuth sessions, and the
secrets vault. See [`ECOSYSTEM.md`](ECOSYSTEM.md) for the full picture.
`newcom/esp`'s `esp/nid_auth.go` ("Login with nID") is the reference
integration every other repo should copy.

## What's here (Phase 0)

- `packages/db` — Prisma schema for the multi-tenant core (`Tenant`, `TenantApiKey`,
  `Subject`, `Organization`, `VerificationPolicy`, `VerificationCase`,
  `VerificationMethodAttempt`, `VerificationSession`, `DocumentAsset`,
  `AuditLogEntry`), plus a hand-written Postgres Row-Level Security migration that
  scopes every tenant-owned table to the session's `app.tenant_id`.
- `packages/verification-providers` — the `VerificationMethodProvider` interface
  (mirrors the `PaymentProvider` pattern in Newax's `erp-1`), `OtpSmsProvider`
  and `LivenessProvider`, `ImageClaimProvider` (one class, instantiated per
  document-backed `ClaimType`: `document_ocr`, `dob_document`,
  `education_document`, `employment_document`), and `RegistryCheckProvider`
  (`education_registry`, `employment_registry` — resolves synchronously, no
  subject upload involved).
- `packages/ocr-engine` — real, self-hosted document OCR (Tesseract via
  `tesseract.js`) plus ICAO 9303 MRZ checksum validation for passports/IDs.
  No vendor API key, no per-call cost. `ImageClaimProvider`'s production
  path calls this instead of throwing "no vendor wired up" — see
  `docs/PHASES.md`'s OCR section for what's genuinely solved (reading a
  document) versus what still isn't (fraud/tamper ML detection, a real
  multi-year vendor-shaped investment).
- `packages/storage` — a `StorageDriver` interface (mirrors erp-1's own) with one
  real implementation, local disk, for document/selfie upload bytes — see
  `docs/PHASES.md`'s KYC section for why apps/api and apps/workflows both need to
  point at the same directory.
- **Verification badges** — `ClaimType` (`IDENTITY`, `DATE_OF_BIRTH`,
  `EDUCATION`, `EMPLOYMENT`) and `VerificationLevel` (`SELF_ATTESTED`,
  `DOCUMENT_VERIFIED`, `REGISTRY_VERIFIED`) on `VerificationPolicy`/`VerificationCase`
  — a Subject earns one badge per `ClaimType`, computed on read
  (`GET /v1/subjects/:id/badges`) as the strongest passed case, not stored
  or synced separately. See `docs/PHASES.md`'s badges section.
- `apps/api` — NestJS control-plane: tenant/subject/verification-case REST endpoints
  (API-key auth, including multipart document/selfie/claim-document upload
  routes and the badges endpoint), a public `sessions` module (token-auth, for
  `apps/verify-ui`, same routes), and a Prisma service that sets the RLS
  session variable per request so tenant isolation is enforced by the
  database, not just application code.
- `apps/workflows` — a Temporal worker with one workflow (`verificationWorkflow`)
  that loops over a policy's methods in order, dispatching each through whichever
  provider it names — a single-method `["otp_sms"]` policy is this same
  workflow's one-iteration case, not a separate implementation.
- `apps/verify-ui` — the hosted, subject-facing verification flow (Next.js, no
  login): walks a multi-step policy (enter an OTP code, upload a document,
  upload a selfie — whichever the policy names, in order) and shows the result.
  Authenticates with a `VerificationSession` token, never the tenant's API key —
  see below.
- `apps/dashboard` — the tenant staff dashboard (Next.js): sign in with the tenant
  API key (pasted once, kept in `localStorage` — Phase 0 has no separate staff-login
  system), browse verification cases, view a case's attempts and its subject's
  verification badges (one slot per `ClaimType`, "Not verified" where there's
  no passed case yet).
- **"Login with nID"** — nID as an identity provider other apps embed a button
  for, the way Google/Facebook/oneID.uz work. `Account`/`AccountSession`
  (`packages/db/prisma/schema.prisma`) are a portable identity a person creates
  once, passwordless (phone + OTP — "sign up" and "log in" are the same
  operation), and reuses across any relying-party app, distinct from `Subject`
  (owned by one tenant for that tenant's own KYC). `OAuthClient` is a
  tenant-owned RP registration; `OAuthLoginRequest` is one sign-in attempt. A
  simplified redirect-code flow, not full OAuth2/OIDC — see
  `apps/api/src/modules/oauth/oauth.service.ts`'s header comment for exactly
  what's deliberately not built (PKCE, signed JWT ID tokens, a discovery
  document) and why that's enough for a Phase-0-scale integration.
- `apps/login-ui` — the page an RP's "Continue with nID" button sends a browser
  to. One approval link, delivered two ways: a same-device phone+OTP form, or a
  QR code of that *same* URL for a cross-device scan — see below for why that's
  one flow, not two.
- **Public profiles** — `Profile` (1:1 with `Account`, not `Subject` —
  see `docs/PHASES.md`'s profiles section for why) plus `Service`,
  `Offer`, `BusinessHour`, `CustomLink`, `SocialLink`, `ProfileImage`,
  `AvailabilityRule`, `Appointment`, `ContactMessage`, and
  `PhoneBadgeEvidence` (the no-RLS-bypass mechanism a Profile's badges are
  computed from, across every tenant that ever KYC'd this phone). Real
  booking with a `SERIALIZABLE`-transaction double-booking guarantee, real
  timezone-correct availability, real `@nid/storage`-backed image uploads
  — see `docs/PHASES.md` for the full architecture and what was verified
  live.
- `apps/profile-ui` — public, unauthenticated `/[slug]` pages (photo, bio,
  verified badges, offers, hours, a real booking widget, links, a contact
  form) plus an account-authenticated `/dashboard` for the owner to edit
  everything, including appointments and the contact-message inbox.
- Root `eslint.config.mjs`, wired into every package's `pnpm lint`.

### "URL or QR code, both" is one link, not two flows

`apps/login-ui`'s `/authorize/[pollToken]` page is reachable two ways — a
same-device redirect, or a QR code encoding that exact URL for a phone to
scan — and neither is special-cased in the backend. What *is* special-cased:
**which tab is allowed to redirect back to the RP.** `OAuthService.approve()`
(called by whichever device just authenticated) never mints the exchange
code; `OAuthService.claim()` (called by whichever tab has been polling since
the link was first opened) does. In the same-device case those are the same
tab. In the cross-device case they're not — the phone that scans the QR and
approves must **not** also claim, or it would grab the code the desktop tab
(the one actually driving the RP's browser session) needs. `apps/login-ui`
tells the two apart with a `sessionStorage` flag set only by the tab that
*originated* the request (`/authorize` before it hands off to
`/authorize/[pollToken]`) — a fresh device reached via QR never has it. This
was a real bug caught by testing, not a hypothetical: see the Playwright note
below.

### Why `apps/verify-ui` needed a new backend concept

The tenant's API key can create/read everything for that tenant — a subject's
browser must never hold it. `VerificationSession` (`packages/db/prisma/schema.prisma`)
is a single-case, expiring, subject-facing credential instead: created alongside
every `VerificationCase` (`POST /v1/verification-cases` now also returns
`sessionToken`/`hostedUrl`), resolved by a public `apps/api/src/modules/sessions`
controller. Its RLS policy mirrors `TenantApiKey`'s open-`SELECT`-for-bootstrap
exception exactly (see `packages/db/prisma/migrations/001_verification_sessions`)
— the same chicken/egg problem (resolving *which* tenant a token belongs to
before `app.tenant_id` can be set) has the same shape of answer.

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
pnpm --filter @nid/verify-ui dev   # in a third terminal: hosted flow at :3100
pnpm --filter @nid/dashboard dev   # in a fourth terminal: staff dashboard at :3200
pnpm --filter @nid/login-ui dev    # in a fifth terminal: "Login with nID" at :3300
pnpm --filter @nid/profile-ui dev  # in a sixth terminal: public profiles + owner dashboard at :3400
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
>
> **The UIs are verified live too**, in a real headless Chromium via Playwright
> against this same non-Docker Postgres + `apps/api` (Temporal-dependent writes
> seeded directly through `@nid/db`, bypassing the unreachable Temporal server —
> the same workaround as the activity tests above): `apps/verify-ui` correctly
> renders the OTP form, shows the phone number, handles an invalid/expired link,
> and — since the Temporal gRPC call genuinely times out here — handles a failed
> submission gracefully (button re-enables, error shown, no crash) rather than
> hanging forever. `apps/dashboard` was driven through the full flow: reject a
> bad API key with a clear error, accept the real one, list cases with correct
> status badges, open a case's detail and attempts table, and reload the page to
> confirm the `localStorage` session survives a refresh.
>
> **"Login with nID" is verified live end to end, including the cross-device
> QR path** — not just rendered, the whole thing: a curl-driven pass through
> every `apps/api/src/modules/oauth` endpoint (bad `redirect_uri` rejected,
> wrong OTP code rejected, double-claim rejected, code replay rejected, wrong
> client secret rejected, a correct run producing real identity claims), then
> two full Playwright passes against a real `apps/login-ui` and a throwaway
> local HTTP server standing in for an RP's callback. The same-device pass
> fills the phone+OTP form and follows the redirect back to the RP with
> `code`/`state` intact. The cross-device pass is the real test: two
> *separate, non-cookie-sharing* Playwright browser contexts — one opens the
> RP link and gets the QR ("desktop"), the other decodes the actual QR image
> (via `jsqr`) and opens that URL fresh ("phone"), logs in there, and
> approves. The desktop context, which never touched the phone's login at
> all, detects the approval through its own polling and redirects itself to
> the RP with a valid code. This pass is what caught a real bug before it
> shipped: the first version let *any* tab that approved also claim the
> code, so the phone would occasionally win the race and strand the desktop
> tab — fixed by having only the *originating* tab (marked via a
> `sessionStorage` flag `/authorize` sets before handing off) ever claim.
> See the README section above on why that split exists.
>
> **The KYC path (document_ocr + liveness + multi-method policies) is
> verified live the same way** — see `docs/PHASES.md`'s KYC section for the
> full account: the generalized activities against real Postgres and a real
> `@nid/storage` round trip, `apps/api`'s upload endpoints via curl with
> byte-for-byte file verification on disk, and `apps/verify-ui`'s full
> 3-step flow (including one genuine browser file upload) in real headless
> Chromium. Also not verified: the Temporal orchestration layer, for the
> same reason as everything else in this note.
>
> **Public profiles are verified live end to end, including under genuine
> concurrency** — see `docs/PHASES.md`'s profiles section for the full
> account: real cross-tenant badge aggregation, curl-driven booking
> (creation, timezone-correct computed availability, exact-instant and
> overlapping-interval double-booking rejection, and — the one that
> actually matters — 5 truly simultaneous requests for the same slot
> resolving to exactly one winner), and two full Playwright passes against
> `apps/profile-ui`: the public page's booking widget and contact form
> both driven through real browser interaction, and the owner dashboard
> driven through creating a profile, editing and publishing it, managing
> services/hours/offers/links, uploading a real image, and confirming a
> real appointment. This pass caught a real bug (an empty optional field
> failing `@IsEmail` validation) before it shipped — see `docs/PHASES.md`.

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
   starts `verificationWorkflow` (`policyName` must reference a
   `VerificationPolicy` whose `methods` includes `otp_sms`), the dev-mode
   `otp_sms` provider logs the code instead of sending a real SMS, `POST
   .../otp/submit` with the correct code resolves the case to `PASSED`, and
   the tenant's webhook receiver gets an HMAC-signed callback verified with a
   constant-time comparison. **Not verified against an actual Temporal
   server** (see note above) — but every activity this workflow calls is
   proven directly by
   `apps/workflows/test/verification-method.activity.spec.ts`
   (`RUN_DB_TESTS=true`), including the signed webhook delivery to a real
   HTTP receiver.
4. An `AuditLogEntry` row exists for the Subject-data read in step 3, not just the
   write. **Verified** — `verification-method.activity.spec.ts` asserts the
   `SYSTEM`-actor audit row `resolveCaseActivity()` writes.
5. **"Login with nID"**: an RP's `/authorize?client_id&redirect_uri&state` link
   creates a `PENDING` `OAuthLoginRequest`; signing in with phone + OTP (same
   device or, via the QR code of the identical URL, a different one) resolves
   it to `APPROVED`; the tab that originated the request — and only that one —
   claims a one-time code and redirects to `redirect_uri?code&state`; the RP's
   backend exchanges it at `POST /v1/oauth/token` with its `client_secret` for
   `{ id, phone, email, phoneVerifiedAt }`. A wrong `redirect_uri`, wrong OTP,
   double claim, replayed code, or wrong client secret are all rejected.
   **Verified live** — see the note above.

## Phase 1 acceptance criteria (KYC)

See `docs/PHASES.md`'s "KYC: document_ocr, liveness, and multi-method
policies" section for the full architecture and what was verified live —
summarized:

1. A tenant creates a case against a multi-method policy (`pnpm db:seed`
   seeds `"kyc"`: `["otp_sms", "document_ocr", "liveness"]`) and gets back
   one `VerificationMethodAttempt` per method, in policy order.
   **Verified live** via curl against a running `apps/api` and real
   Postgres.
2. The subject completes each method in order — OTP code, then a document
   upload, then a selfie upload — through `apps/verify-ui`, which shows the
   right step and advances automatically as each resolves. **Verified
   live** in real headless Chromium (Playwright), including one genuine
   browser file upload through `<input type="file">`.
3. An upload is real, working storage: the file lands on disk at
   `LOCAL_STORAGE_DIR`, byte-for-byte identical to what was sent, with a
   `DocumentAsset` row pointing at it — never the raw bytes anywhere in
   Postgres or Temporal. **Verified live**.
4. A method that returns `NEEDS_REVIEW` (document_ocr/liveness's dev-mode
   provider supports a `mockOutcome` override for exactly this) stops the
   case there rather than silently passing or failing it.
   **Verified** via `verification-method.activity.spec.ts` and
   `apps/verify-ui`'s terminal view.
5. A multi-method case is not resolved (`APPROVED`/webhook fired) until
   every method has run. **Verified** via
   `verification-method.activity.spec.ts`'s multi-method test, which calls
   the same activities in the same order `verificationWorkflow` does and
   asserts the case is still `IN_REVIEW` partway through.

## Phase 1 acceptance criteria (verification badges)

See `docs/PHASES.md`'s "Verification badges" section for the full
architecture and what was verified live — summarized:

1. A Subject's badge for a given `ClaimType` is the strongest `APPROVED`
   case for it, not the most recent — a later, weaker re-check never
   regresses an already-earned stronger badge. **Verified live**: a subject
   with both an `APPROVED` `education-document` (`DOCUMENT_VERIFIED`) case
   and an `APPROVED` `education-registry` (`REGISTRY_VERIFIED`) case shows
   `REGISTRY_VERIFIED`.
2. A `ClaimType` with no passed case shows no badge — never fabricated.
   `DATE_OF_BIRTH` is the one exception: a `Subject.dateOfBirth` on file with
   no verifying case shows `SELF_ATTESTED`, and a *rejected* case for it
   doesn't suppress that fallback. **Verified live** against a subject with
   an unresolved `employment-document` case (no badge) and a rejected
   `dob-document` case (still shows `SELF_ATTESTED`, not nothing).
3. `education_registry`/`employment_registry` resolve without any subject
   upload — `apps/verify-ui` shows a waiting view with no file input for
   them. **Verified live** in real headless Chromium.
4. `dob_document`/`education_document`/`employment_document` share one
   generic upload route (`.../claims/:method/submit`) instead of three more
   dedicated ones, and that route rejects a non-claim-document method.
   **Verified live** via curl: a real `employment_document` upload
   persisted byte-for-byte, and a `liveness` submission through the same
   route was rejected with 400.

## Phase 1 acceptance criteria (public profiles)

See `docs/PHASES.md`'s "Public profiles" section for the full architecture
and what was verified live — summarized:

1. A `Profile`'s badges are computed across every tenant that ever ran
   `APPROVED` KYC against its Account's phone, not just one tenant's view
   — without granting the API's database role any new RLS-bypass
   privilege. **Verified live**: seeded `PhoneBadgeEvidence` rows at
   different `VerificationLevel`s for the same `claimType`, from
   different fake `tenantId`s, correctly rank strongest-first on the
   public profile response.
2. A profile's visibility flags are enforced server-side, not just hidden
   in a UI — an unset `showPhone` genuinely nulls `phone` in the public
   API response. **Verified live** via curl.
3. Double-booking is genuinely impossible under real concurrency, not
   just rejected by a slower sequential check. **Verified live**: 5
   simultaneous `curl` requests for the identical free slot resolve to
   exactly one `201 Created` and four `409 Conflict`s.
4. Availability is computed from real recurring rules, minus real existing
   appointments, converted correctly for the profile's own IANA timezone
   including across a DST transition — never a hardcoded or synthetic
   slot list. **Verified live** and unit-tested
   (`packages/shared-types/src/timezone.spec.ts`).
5. The owner dashboard (`apps/profile-ui`'s `/dashboard`) can create a
   profile, edit every field and visibility toggle, manage services,
   bookable-hours, display hours, offers, and links, upload a photo and
   gallery images, and confirm/cancel a real appointment and mark a real
   contact message read — all through the identical phone+OTP Account
   session `apps/login-ui` already established. **Verified live** in real
   headless Chromium (Playwright), including a bug the pass itself caught
   and a fix that landed before this criterion was marked done — see
   `docs/PHASES.md`.

## Repo layout

```
nID/
  apps/
    api/            NestJS control-plane: tenants, subjects, cases, sessions, accounts, oauth, webhooks
    workflows/      Temporal worker: workflows + verification-method-provider activities
    verify-ui/      Hosted, subject-facing verification flow (Next.js, no login)
    dashboard/      Tenant staff dashboard (Next.js, API-key auth)
    login-ui/       "Login with nID" — the page an RP's button sends a browser to
    profile-ui/     Public /[slug] profile pages + account-authenticated owner dashboard
  packages/
    db/             Prisma schema, RLS migrations, seed script
    verification-providers/   one file per VerificationMethodProvider
    ocr-engine/     Real Tesseract OCR + ICAO 9303 MRZ checksum validation
    storage/        StorageDriver interface + local-disk implementation
    shared-types/   session tokens, webhook signing, IANA timezone conversion
    workflow-contracts/       signal/query/workflow-type names shared by api <-> workflows
  docs/
    HOUSE-RULES.md
    PHASES.md
```
