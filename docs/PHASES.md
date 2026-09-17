# Delivery phases

Full rationale lives in the plan this scaffold was built from. Summary:

- **Phase 0 (this scaffold)** — repo structure, Tenant/Subject/Case/Attempt schema
  with RLS, API-key auth, one method end-to-end: `otp_sms`. Also has, ahead of the
  original Phase 1 plan: a hosted subject-facing verification flow
  (`apps/verify-ui`, token-authenticated via the new `VerificationSession`
  concept), a first-cut tenant dashboard (`apps/dashboard`, API-key
  "login" — no separate staff-account system yet, so this is explicitly a
  Phase 0 simplification, not the Phase 1 dashboard's final auth story), and
  **"Login with nID"** — a portable `Account` identity (phone + OTP,
  passwordless) plus a simplified OAuth-style flow (`apps/login-ui`,
  `apps/api/src/modules/oauth`) any relying-party app can embed a "Continue
  with nID" button for, same-device URL or cross-device QR. `erp-1` also
  already integrates as nID's tenant #1 — see below.
- **Phase 1** — **document upload + OCR and liveness, and policy composition
  beyond a single method, are done** — see below. Two Phase 1 items remain:
  wiring the dashboard's staff login onto `Account` instead of raw API-key
  paste (a `TenantStaffMembership` join table — "does this Account work for
  this Tenant" — is the natural next step now that `Account` exists,
  deliberately not built in Phase 0 since nothing needed it yet), and signed
  webhooks to more than one tenant. A case-review queue for `NEEDS_REVIEW`
  attempts is also still unbuilt: `CaseStatus.NEEDS_REVIEW` is now a real,
  reachable state (`document_ocr`/`liveness` can both return it) and a case
  stops there correctly, but nothing lets staff *act* on it yet — no
  dashboard view, no resolution signal. It's a genuine dead end today, by
  design (the workflow doesn't guess), not yet a queue.

### KYC: document_ocr, liveness, and multi-method policies

`otp_sms` was Phase 0's only method — proving the shape, not the product.
Phase 1's KYC work generalizes everything one level up without touching the
`VerificationMethodProvider` interface itself:

- **`document_ocr` and `liveness`** (`packages/verification-providers`) —
  same interface as `otp_sms`. `start()` has nothing to send (the subject's
  next step is an upload, not receiving a code), so it returns `pending`
  immediately; `handleCallback()` does the real work. `DOCUMENT_OCR_DEV_MODE`
  / `LIVENESS_DEV_MODE` mock a result instead of calling a real vendor —
  same "real interface, mock result" shape as `OTP_SMS_DEV_MODE`, including
  a `mockOutcome` override for deterministic tests. In production these
  `evaluate()` methods should call a real OCR/liveness vendor
  (Persona/Sumsub/Onfido-class — see the top-level plan's "buy, don't build"
  rationale); nothing in this codebase should call a biometric vendor
  directly outside this one function per provider.
- **`@nid/storage`** — a `StorageDriver` interface (mirrors erp-1's own) with
  one real implementation: local disk, for dev and single-host use. Not a
  stub — `put()`/`get()` genuinely write and read bytes. `apps/api` writes
  an upload (via `POST /v1/verification-cases/:id/document/submit` or
  `.../liveness/submit`, tenant-API-key or session-token authenticated —
  both paths exist, same split as `otp/submit`), creates a `DocumentAsset`
  row, and signals the workflow with a `storageKey` reference — never the
  raw bytes, which would bloat Temporal's workflow history. `apps/workflows`
  reads the bytes back from the *same* `LOCAL_STORAGE_DIR` to hand to the
  provider. This is a dev/single-host constraint specifically because
  `apps/api` and `apps/workflows` are separate processes; an S3-compatible
  driver (documented, not built) removes it.
- **`verificationWorkflow`** (`apps/workflows/src/workflows/verification.workflow.ts`)
  replaces Phase 0's `otpVerificationWorkflow` — one workflow that loops over
  `VerificationPolicy.methods` in order, dispatching each through the
  provider registry via four generic activities (`startMethodActivity`,
  `completeMethodActivity`, `expireMethodActivity`, `resolveCaseActivity`),
  never branching on a method's name. A single-method `["otp_sms"]` policy
  is this same workflow's one-iteration case, not a separate implementation
  — Phase 0's policies keep working unchanged. Any method coming back
  `FAILED` or `NEEDS_REVIEW` stops the case there; later methods in the
  policy never run.
- **A real bug this caught**: `getById`/`getStatus`'s Prisma queries
  included `attempts` with no explicit `orderBy`. Postgres has no implicit
  row order, and a `UPDATE` on an attempt can change its physical position
  in a sequential scan — live testing (Playwright driving `apps/verify-ui`
  through a real multi-method case) caught the step indicator showing "Step
  1 of 3" on every step once an earlier attempt had been updated. Fixed with
  `orderBy: { startedAt: 'asc' }` on both queries.

**Seeded**: tenant-a has a `"kyc"` policy (`methods: ["otp_sms", "document_ocr",
"liveness"]`) alongside the Phase 0 `"standard"` one, via `pnpm db:seed`.

**Verified live**: the full KYC path end to end against real Postgres and
real disk — `apps/workflows/test/verification-method.activity.spec.ts`
(`RUN_DB_TESTS=true`) calls the four generic activities directly (the same
workaround as Phase 0's OTP test, for the same reason: this sandbox has no
reachable Temporal server), including a real `put()`/`get()` round trip
through `@nid/storage` and a multi-method sequence proving the case isn't
resolved until every method has run, in order. `apps/api`'s upload endpoints
were driven with real curl multipart requests against a running server and
real Postgres — case creation for a 3-method policy, document and selfie
uploads, `DocumentAsset` rows with byte-for-byte-correct content on disk,
and the audit trail. `apps/verify-ui` was driven through the full 3-step
flow in real headless Chromium (Playwright): the OTP form, then the document
upload form, then the selfie upload form — each transition triggered by a
real `POST /v1/sessions/:token` submission, including one genuine real
browser file upload (not a seeded DB row) through the actual `<input
type="file">` → `FormData` → `fetch` path — through to the "You're verified"
terminal view, plus the new `NEEDS_REVIEW` terminal view. **Not verified**:
the Temporal orchestration layer itself, for the same reason as Phase 0 —
this sandbox's egress policy blocks reaching or installing a Temporal
server. Every activity the workflow calls is proven directly, in the exact
sequence the workflow calls them in, which is what's provable without one.
- **Phase 2** — sanctions/PEP screening, KYB/business-registry lookup, one
  country's national-ID registry adapter, manual-review tooling, retention/audit
  maturity.
- **Phase 3** — self-serve tenant signup, per-method usage metering, billing
  integration, second country's registry adapter, bank-linked verification where a
  viable in-market API exists.
- **Phase 4** — SOC 2 process, public API docs, SLAs, multi-region deployment, pen
  testing. Its own budget line, not a byproduct of Phases 0–3.

`erp-1` already integrates with nID: a `identity-verification` module
implementing an `IdentityVerificationProvider` client against this API,
subscribed to nID's webhook (`erp-1` repo, `docs/implementation/18-identity-verification.md`).
It's off by default there (no `NID_API_URL`/`NID_API_KEY` set) until this
shop has a real nID tenant account and API key from `pnpm db:seed`.

That's a different integration point from "Login with nID": the KYC module
verifies erp-1's *existing* users; erp-1 embedding a "Continue with nID"
button (an `OAuthClient` of its own, seeded the way `packages/db/prisma/seed.ts`
seeds the demo one) so *new* users can sign up/log into erp-1 with their nID
identity is a separate, not-yet-built piece of erp-1-side work.
