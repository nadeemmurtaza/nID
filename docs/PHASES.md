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
- **Phase 1** — **document upload + OCR and liveness, policy composition
  beyond a single method, and per-attribute verification badges (identity,
  date of birth, education, employment) at three levels of proof, are
  done** — see below. Two Phase 1 items remain: wiring the dashboard's staff
  login onto `Account` instead of raw API-key paste (a `TenantStaffMembership`
  join table — "does this Account work for this Tenant" — is the natural next
  step now that `Account` exists, deliberately not built in Phase 0 since
  nothing needed it yet), and signed webhooks to more than one tenant. A
  case-review queue for `NEEDS_REVIEW` attempts is also still unbuilt:
  `CaseStatus.NEEDS_REVIEW` is now a real, reachable state (`document_ocr`/
  `liveness` can both return it) and a case stops there correctly, but
  nothing lets staff *act* on it yet — no dashboard view, no resolution
  signal. It's a genuine dead end today, by design (the workflow doesn't
  guess), not yet a queue.

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

### Verification badges: ClaimType, VerificationLevel, and per-attribute claims

Before this, "verified" meant one thing — identity, via whatever the case's
policy ran. A tenant asked for badges shown separately per attribute
(education, employment, date of birth), each at its own strength of proof,
not folded into one identity check. Rather than a parallel system, this
reuses the Case/Policy/provider machinery Phase 1's KYC work already built:

- **`ClaimType`** (`IDENTITY`, `DATE_OF_BIRTH`, `EDUCATION`, `EMPLOYMENT`) and
  **`VerificationLevel`** (`SELF_ATTESTED`, `DOCUMENT_VERIFIED`,
  `REGISTRY_VERIFIED`, declared in that ascending-strength order so Postgres's
  enum ordering does the ranking) are both properties of a
  `VerificationPolicy`, denormalized onto `VerificationCase` at creation time
  the same way `VerificationMethodAttempt.providerKey` is denormalized from
  its provider. A tenant can have several policies for the same `ClaimType`
  at different levels (e.g. `education-document` and `education-registry`)
  — the level a passed case earns is the policy's own value, not computed
  from which methods happened to run.
- **`ImageClaimProvider`** (`packages/verification-providers/src/image-claim.provider.ts`)
  generalizes what was `DocumentOcrProvider` into one class instantiated
  once per document-backed `ClaimType` — `document_ocr` (identity),
  `dob_document`, `education_document`, `employment_document` — sharing the
  `CLAIM_DOCUMENT_DEV_MODE` toggle. Same mechanism as before: upload an
  image, mock-verify in dev, a real OCR vendor call in production.
- **`RegistryCheckProvider`** (`registry-check.provider.ts`) is new: a
  `REGISTRY_VERIFIED`-level check (`education_registry`, `employment_registry`)
  against an authoritative source. Unlike every other provider so far, its
  `start()` resolves *synchronously* — everything it needs (a `referenceId`
  the tenant supplies at case creation, e.g. a student or employee ID) is
  already there, so there's nothing for the subject to upload and
  `handleCallback` is never used. No real registry/employer vendor exists
  behind either key yet (`REGISTRY_CHECK_DEV_MODE` mocks both) — that's
  genuinely unbuilt, not just undocumented.
- **Badges are computed, not stored.** `GET /v1/subjects/:id/badges`
  (`SubjectsService.getBadges`) finds, per `ClaimType`, the highest-`level`
  `APPROVED` case — ties broken by most recent — with no new table and no
  sync-drift risk. `DATE_OF_BIRTH` gets one inference beyond that: if
  `Subject.dateOfBirth` is set but no case ever verified it, the badge shows
  `SELF_ATTESTED` (a value the subject supplied, never independently
  checked) rather than nothing. `EDUCATION`/`EMPLOYMENT` have no equivalent
  scalar field on `Subject` to infer a claimed-but-unverified value from, so
  they're either a real badge or absent — never fabricated.
- **`otp_sms` alone is `SELF_ATTESTED`, `otp_sms + document_ocr + liveness`
  is `DOCUMENT_VERIFIED`**: Phase 0's `standard` and `kyc` policies were
  retrofitted with these levels rather than left as an ungraded exception.
  Proving you control a phone number isn't proving a document backs your
  identity — the honest level for `standard` is the weakest one, same as
  every other `ClaimType`'s ungraded state would be.
- **A real gap this exposed and fixed**: `Subject.dateOfBirth` existed in
  the schema since Phase 0 but `POST /v1/subjects` never accepted it — the
  `DATE_OF_BIRTH` badge's `SELF_ATTESTED` fallback would have been dead code
  without a way to set the field it reads. `CreateSubjectDto` now takes an
  optional `dateOfBirth`.

**New submit route**: `dob_document`/`education_document`/`employment_document`
share one generic multipart route — `POST
/v1/verification-cases/:id/claims/:method/submit` (and the session-token
equivalent) — instead of three more near-identical dedicated routes like
`document_ocr`/`liveness` have. `education_registry`/`employment_registry`
need no submit route at all: they resolve at `start()`.

**Seeded**: tenant-a has five more policies — `dob-document`,
`education-document`, `education-registry`, `employment-document`,
`employment-registry` — alongside `standard` and `kyc` (now leveled), via
`pnpm db:seed`.

**Verified live**: cases created across all four `ClaimType`s (curl against
a running `apps/api` + real Postgres) correctly denormalize their policy's
`claimType`/`level`, including `education-registry` with a `referenceId`.
A real multipart upload through the generic claims route persisted a
byte-for-byte-correct file and `DocumentAsset` row, and the route correctly
rejects a non-claim-document method (`liveness`) with a 400. The badges
endpoint was proven against a subject with cases at multiple levels of the
same `ClaimType`: `education-document` (`DOCUMENT_VERIFIED`) and
`education-registry` (`REGISTRY_VERIFIED`) both `APPROVED` correctly
surfaces the stronger one, an unresolved `employment-document` case
correctly shows no badge, and a *rejected* `dob-document` case correctly
falls back to the `SELF_ATTESTED` inference rather than either fabricating
a pass or hiding the badge entirely. `apps/dashboard`'s badges panel was
driven in real headless Chromium and matched the API exactly — all four
`ClaimType` slots, "Not verified" for the two without a passed case.
`apps/verify-ui` was driven through a real `employment_document` upload
(genuine browser file input, not a seeded DB row) and the
`employment_registry` "checking with the registry" waiting view, confirming
no file input renders for a method that never needs a subject upload.
**Not verified**: the Temporal orchestration layer, for the same reason as
everywhere else in this document.

### Real document OCR and a real generic registry-check client

"Buy, don't build" (this document's own earlier guidance) was right for
fraud/tamper *detection* — that's a genuine multi-year ML investment, and
still isn't built here. It was wrong for OCR *itself*: reading a document is
a solved problem with a mature, free, self-hosted answer, so `document_ocr`
/ `dob_document` / `education_document` / `employment_document`'s
production path now runs real Tesseract OCR (`@nid/ocr-engine`, via
`tesseract.js`) instead of throwing "no vendor wired up yet." No vendor API
key, no per-call cost, no third party ever sees the document.

- **MRZ checksum validation** (`packages/ocr-engine/src/mrz.ts`) parses a
  passport's Machine Readable Zone (ICAO Doc 9303 TD3: two 44-character
  lines) and validates every check digit — the digits the issuing authority
  itself generated at print time, using the same weighted-mod-10 algorithm
  every real MRZ reader uses. A mismatch means tampered-or-misread, not a
  guess. **Verified against the real standard**, not just internal
  self-consistency: `mrz.spec.ts` cross-checks the parser against the
  actual published ICAO Doc 9303 worked example (the canonical Anna Maria
  Eriksson passport), not a fixture generated by the same code under test.
  Deliberately TD3-only — TD1 (ID cards, three 30-character lines) has a
  different field layout and composite-check range that would be easy to
  implement subtly wrong; a TD1-shaped MRZ is detected but returns
  unparsed rather than risk validating against the wrong checksum.
- **`evaluateDocument()`** (`evaluate-document.ts`) decides honestly from
  what OCR actually found: MRZ checksums valid → `PASSED`; MRZ present but
  invalid → `FAILED`; readable text with no MRZ (diplomas, offer letters,
  most non-passport IDs — nothing here has an authority-issued checksum to
  check) → `NEEDS_REVIEW`; no readable text at all → `FAILED`. The
  OCR-calling step and the decide-from-text step are split on purpose: the
  decision logic is pure and gets full deterministic unit coverage against
  real (ICAO-verified) MRZ text; the OCR call itself is proven live against
  real rendered images instead.
- **A real, honest limitation this surfaced**: general-purpose English
  OCR's language model actively fights MRZ accuracy — it has no concept of
  a long run of a repeated filler character (`<<<<<<<<<<`) that never
  occurs in real English, and both "corrects" O/0 (a font-level
  disambiguation OCR-B is specifically designed to make and generic Latin
  models aren't trained for) and drifts on character count at line
  boundaries. A second, MRZ-character-whitelisted OCR pass
  (`extractMrzCandidateText`) measurably helps but does not fully solve
  this on a synthetically-rendered test image — verified live, honestly,
  against three real rendered images: a rendered passport MRZ (the real
  pipeline ran, extracted real text, and correctly declined to trust the
  noisy result — `NEEDS_REVIEW`, not a fabricated pass or fail), a rendered
  diploma (real prose OCR, essentially perfect — `NEEDS_REVIEW` for the
  right reason, no MRZ exists), and a blank image (correctly `FAILED`, no
  readable text). Real passport photos, cropped tightly to the MRZ band the
  way real MRZ scanners do (this pipeline doesn't crop yet), would likely
  score meaningfully better than a synthetic full-page render — that's a
  concrete, scoped follow-up, not a hand-wave.
- **`RegistryCheckProvider`'s production path** (`registry-check.provider.ts`)
  is a real HTTP client against a contract this codebase defines itself —
  `POST {url}` with `{method, referenceId, subjectId, tenantId}`, `Bearer
  {key}`, expects `{status, score?, raw?}` back — configured per ClaimType
  via `EDUCATION_REGISTRY_API_URL`/`_API_KEY` and
  `EMPLOYMENT_REGISTRY_API_URL`/`_API_KEY`. Neither National Student
  Clearinghouse nor Truework/The Work Number offer self-serve signup — both
  require an actual institutional agreement no amount of code produces —
  so this is deliberately vendor-agnostic rather than hardcoded to either:
  point `apiUrl` at whichever vendor/aggregator you actually contract with,
  or a thin adapter in front of it, no code change needed either way.
  **Verified live**: a real HTTP server implementing exactly this contract,
  real `Authorization: Bearer` header sent, real JSON body matching the
  documented shape, and all three real branches proven — a `PASSED` result
  passed through with its vendor-specific `raw` payload preserved, a vendor
  `FAILED` result passed through, and a vendor `500` response correctly
  landing on `verified: false` (unverified, not a genuine `FAILED` — the
  registry being down isn't proof the claim is false).
- **A more promising named target surfaced mid-build**: NADRA (Pakistan's
  National Database and Registration Authority) productizes third-party
  institutional access to CNIC/NICOP verification — Verisys (OTP-consent
  verification) and an explicitly API-based Batch Verification Service —
  which is a meaningfully shorter path than NSC/Truework, since NADRA
  already sells this to corporate/institutional clients rather than
  requiring a from-scratch government relationship. Still needs a real
  institutional agreement (security protocol review, 2FA) before any code
  can call it for real, and the exact request/response shape isn't public
  — worth a named `nadra_verisys` provider once that agreement and its API
  docs exist, reusing `RegistryCheckProvider`'s HTTP-client mechanism
  rather than inventing a new one, not a generic placeholder pretending to
  be it in the meantime.

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
