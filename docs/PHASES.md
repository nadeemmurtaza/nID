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
  beyond a single method, per-attribute verification badges (identity,
  date of birth, education, employment) at three levels of proof, public
  profile pages with real badges, booking, and owner-managed content, the
  `NEEDS_REVIEW` manual-review queue, and the dashboard's staff login
  (`TenantStaffMembership`, replacing raw API-key paste), are all done** —
  see below. Signed webhooks to more than one tenant already work today
  (each `Tenant` carries its own `webhookUrl`/`webhookSecretPlaintext`,
  delivery is per-tenant-keyed) — nothing left to build there either.

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

### Public profiles: pages, badges, booking, and owner-managed content

A different kind of surface than everything above: instead of a tenant
verifying *its own* end-users, a person who has completed KYC with *any*
tenant gets a public page of their own — a Linktree/business-card-shaped
profile (photo, bio, contact actions, hours, offers, links, a real booking
widget, a contact form) that shows their verified badges regardless of
which tenant's KYC earned them. This is the direct payoff of `Account`
being portable: without it, "get verified once, benefit everywhere" would
have nothing to attach to.

- **`Profile` is 1:1 with `Account`, never with `Subject`.** A `Subject` is
  owned by exactly one tenant, by design (`docs/HOUSE-RULES.md`) — a
  Profile anchored to a Subject would only ever show that one tenant's
  view. Anchoring it to `Account` instead is the same portability
  `Account` already gives "Login with nID": one page, badges fanned out
  across every tenant that ever KYC'd this phone number. No `tenantId`,
  no RLS policy — same trust domain as `Account`/`AccountSession` above,
  access control is `AccountSessionGuard` at the API layer.
- **Ten new models** (`packages/db/prisma/schema.prisma`): `Profile`
  itself (slug, display fields, per-section `show*` visibility booleans,
  address/geo, IANA `timezone`), `Service`, `Offer`, `BusinessHour`,
  `CustomLink`, `SocialLink`, `ProfileImage`, `AvailabilityRule`,
  `Appointment`, `ContactMessage`.
- **`PhoneBadgeEvidence`: the real solution to "read across every
  tenant's data without a backdoor."** The first design considered for
  cross-tenant badge computation was a `SECURITY DEFINER` Postgres
  function owned by a `BYPASSRLS` role — narrower than granting `nid_app`
  `BYPASSRLS` outright, but still a standing RLS-bypass primitive, and it
  was correctly refused by this environment's own safety tooling as a
  security-weakening action. The actual fix doesn't bypass RLS at all: a
  denormalized, `PhoneBadgeEvidence` table — same no-tenantId trust
  domain as `Account` — gets one row appended whenever a `VerificationCase`
  resolves `APPROVED` (`resolveCaseActivity`, `apps/workflows`) or a
  `Subject` is created with a phone + `dateOfBirth`
  (`SubjectsService.create`). The row-writer already legitimately holds
  the data inside its own tenant-scoped transaction — no new privilege is
  invented, the read side just never has to cross a tenant boundary at
  query time. `pickStrongestPerClaimType` (`badges/badge-ranking.ts`) is
  shared, unmodified, by both `SubjectsService.getBadges` (one tenant's
  own Subject) and `CrossTenantBadgesService.getBadgesForPhone` (a
  Profile's fanned-out view) — one ranking function, two callers, per
  `docs/HOUSE-RULES.md` rule 1.
- **Booking is two separate models on purpose.** `BusinessHour` is
  display-only ("we're open 9–5"); `AvailabilityRule` is the actual
  bookable-slot input. Conflating them would mean either fake availability
  (hours shown but nothing bookable) or a business unable to display hours
  different from what it accepts bookings for (a doctor who's "in" 9–5 but
  only booking new patients 9–12).
- **Double-booking prevention is a real `SERIALIZABLE` transaction, not
  just a unique constraint.** `@@unique([profileId, startsAt])` on
  `Appointment` is cheap defense-in-depth for the identical-instant case,
  but can't express "no overlap" between appointments of different
  durations. The real guarantee (`appointments.service.ts`) is a Postgres
  `SERIALIZABLE` transaction with an explicit interval-overlap check
  (`startsAt < newEndsAt AND endsAt > newStartsAt`), retried up to 3 times
  on Prisma's `P2034` write-conflict error. **Verified live under genuine
  concurrency**, not just sequentially: 5 simultaneous `curl` requests for
  the identical free slot resolved to exactly one `201` and four `409`s.
- **Timezone-correct availability with zero new dependencies.**
  `AvailabilityRule`/`BusinessHour` minute-of-day values are local to
  `Profile.timezone` (an IANA name). Converting between that and UTC —
  both directions, DST-correctly — needed real timezone-database logic;
  rather than add a dependency, `packages/shared-types/src/timezone.ts`
  does it with the platform's own `Intl` API: format an instant into a
  timezone's wall-clock parts (`getLocalDateParts`), and the inverse
  (`zonedTimeToUtc`) via iterative correction against the zone's own
  actual UTC offset (necessary because DST means the offset itself is a
  function of the instant, not a constant). **Verified against real DST
  behavior**: a 9am America/New_York conversion one day before vs. one day
  after the actual 2026 spring-forward transition produces UTC instants
  exactly one hour apart, not by construction.
- **`@nid/storage` generalized, not forked.** Its `PutDocumentInput` used
  `tenantId`/`methodAttemptId` — KYC-specific names for what the driver
  itself only ever treated as two opaque path-prefix segments. Profile
  photos/banners/gallery images needed the identical disk-backed
  put()/get() behavior for a completely different domain, so the fields
  were renamed to domain-neutral `namespace`/`groupId` (every call site
  updated, `apps/api`'s KYC uploads included) rather than either
  duplicating `LocalStorageDriver` or repurposing tenant-shaped field
  names to mean something else. Exactly the "no shortcuts, genuine reuse"
  the schema comments elsewhere already hold this codebase to.
- **`apps/profile-ui`** — a new Next.js app, two halves:
  - **Public, unauthenticated `/[slug]`**: server-rendered — photo (or
    initials fallback), headline, bio, real verified badges, offers,
    display hours, address + map link, a real computed-availability
    booking widget, custom/social links, a gallery, and a contact form —
    every section conditionally rendered on real data (an owner who hasn't
    added offers gets no empty "Offers" heading) and every visibility
    flag enforced server-side by `apps/api`, not hidden-but-fetchable
    client-side.
  - **Account-authenticated `/dashboard`** (phone + OTP, reusing the
    identical session pattern `apps/login-ui` already established): create
    the profile, edit every field and visibility toggle, upload the photo
    and banner/gallery images, manage services, bookable-hours windows,
    display hours, offers, links, and view/act on real appointments
    (confirm/cancel) and contact messages (mark read).
- **A real bug this caught**: an owner saving the profile-editor form
  with, say, no public email yet sends `publicEmail: ''` — `@IsEmail()`
  rejects that even though the field is `@IsOptional()`, since
  `@IsOptional()` only skips `null`/`undefined`, never `''`. Caught by a
  live Playwright pass through the dashboard (not by typecheck or a mock),
  fixed by converting blank optional fields to `undefined` before sending
  — Prisma's own "field omitted" update semantics, which is exactly what a
  cleared form field means.

**Seeded**: `pnpm db:seed` now also seeds a demo profile (`/demo-clinic`,
`packages/db/prisma/seed.ts`'s `seedDemoProfile`) — an Account, a
published Profile with two services, three weekly availability windows,
matching display hours, an offer, a custom + social link, and one
`PhoneBadgeEvidence` row so the seeded page genuinely shows a verified
badge, the same way a real cross-tenant KYC pass would produce one. Every
step upserts or checks-then-creates by its own natural key, so re-running
the seed is a no-op the second time.

**Verified live**: every layer, against real Postgres and two real running
Next.js/NestJS servers, not mocked. Profile CRUD, slug-conflict rejection
(409), visibility-flag gating (an unset `showPhone` genuinely nulls
`phone` in the public response, not just hides it in a UI), and the
cross-tenant badge read (seeded `PhoneBadgeEvidence` rows at different
levels for the same `claimType` correctly rank strongest-first) were
proven via curl. The whole booking path — service creation, availability
windows, computed free slots respecting real weekly recurrence and
timezone conversion, a real booking, the exact-instant and overlapping-
interval double-booking rejections, the outside-business-hours rejection,
and the 5-way concurrent-race test above — was proven via curl and confirmed
matching in the browser. `apps/profile-ui`'s public page and dashboard
were both driven in real headless Chromium (Playwright): the public
page's booking widget picks a real computed slot and books it end to end,
its contact form delivers a real `ContactMessage`; the dashboard logs in,
creates a profile, edits and publishes it (confirmed live on the public
page immediately after), adds a service, a bookable-hours window, display
hours, an offer, a link, uploads a real banner image (byte-round-tripped
through `@nid/storage`), and confirms/cancels a real appointment and
marks a real contact message read. Full workspace `typecheck`/`lint`/
`test` all pass, including new `timezone.spec.ts` (DST + round-trip) and
`badge-ranking.spec.ts` (strongest-first ranking, self-attested-fallback
never overwriting a stronger badge).

### KYC hardening: manual review, bank_account_title, ECP self-report, MRZ auto-crop

Four independent pieces of hardening on the existing verification-method
pipeline, each landing without touching `verification.workflow.ts` or the
activity dispatch logic — proof that the provider abstraction (docs/HOUSE-RULES.md
rule 1) actually pays off when new methods arrive:

- **Manual-review queue.** `NEEDS_REVIEW` is a terminal Temporal workflow
  state — the workflow has already returned by the time a case sits there,
  so resolving it can't be a signal, only a direct, audited DB transition.
  `POST /v1/verification-cases/:id/resolve` (`ResolveCaseDto {decision,
  reason}`) does exactly that, finally giving `VerificationCase.reviewerId`
  a real writer. `apps/dashboard`'s case-detail page grew a `ResolvePanel`
  (required reason, Approve/Reject) shown only when a case is
  `NEEDS_REVIEW`.
- **`bank_account_title`.** Reuses `RegistryCheckProvider` rather than
  forking a new class — its HTTP contract already fit, just needed an
  optional `accountTitle` field sent only for this method (the vendor
  compares a claimed name against its own bank records; education/employment
  registries resolve identity from `referenceId` alone and never send it).
  Seeded at `IDENTITY` / `REGISTRY_VERIFIED`.
- **`ecp_voter_registration`.** Pakistan's ECP voter-registration lookup
  (send a CNIC via SMS to 8300) is consumer-only — no institutional API
  exists for a third party to query it. `SelfReportedCheckProvider` (new,
  `packages/verification-providers/src/self-reported-check.provider.ts`)
  takes the subject's own report of what the government's reply said and
  *always* resolves to `NEEDS_REVIEW`, never an automated pass — nothing
  independently confirms the report is true, so a human reviewer's
  judgment (the queue above) is the only honest terminal state. PTA's
  SIM-count lookup was deliberately **not** built as a sibling method: it's
  a risk signal ("how many SIMs on this CNIC"), not a pass/fail identity
  claim, and forcing it into this model would misrepresent what it proves.
  Seeded at `IDENTITY` / `DOCUMENT_VERIFIED`.
- **MRZ auto-crop.** `packages/ocr-engine/src/mrz-crop.ts`'s
  `autoCropToMrzBand()` finds a passport's MRZ band with no ML model: a
  TD3 bio-data page's MRZ is, per the ICAO Doc 9303 layout itself, two
  lines of dense, full-width monospace text at the very bottom of the
  page — a genuinely distinctive row-by-row dark-pixel-density signature
  versus the photo/header area above it. `evaluateDocument()` now crops to
  that band (falling back to the full image on a miss) before the
  MRZ-restricted OCR pass, so the photo/header no longer dilutes it.
  Proven with real Jimp-rendered fixture images (`mrz-crop.spec.ts`), not
  mocked pixel data.

**Verified live**: `resolveCase` proven via curl (validation errors,
successful resolve, re-resolve rejection) plus a full Playwright pass
through the dashboard's new panel; `bank_account_title` proven against a
real loopback HTTP server and real case creation; `ecp_voter_registration`
proven at the activity layer against real Postgres (`RUN_DB_TESTS=true`)
and via a real Playwright pass through `apps/verify-ui`'s new
`TextReportStep`; `mrz-crop.ts` proven with real Jimp image encode/decode
round trips (a genuine crop, a no-band fallback, and a photo-region
false-positive rejection). Full workspace `typecheck`/`lint`/`test` pass.

### Organization-verified membership and agent in-person document verification

Two more verification methods, both internal-evidence rather than
vendor-backed — the first provider in this codebase to query nID's own
data instead of an HTTP API or a subject's own submission:

- **`org_membership`.** "This person works at an already-verified
  organization, so they inherit its verification" — a real trusted-employer
  vouching pattern, not a shortcut. `OrganizationMembershipProvider`
  (`packages/verification-providers/src/organization-membership.provider.ts`)
  requires BOTH: the claimed `Organization` has at least one `APPROVED`
  `VerificationCase` for `claimType: IDENTITY` (real KYB, not an assumption
  from the row merely existing), AND an `OrganizationMembership` row
  already confirms this Subject as a member — an org admin's attestation
  via `POST /v1/organizations/:id/members`, never the subject's own
  claimed `organizationId` taken at face value. Missing either resolves to
  `NEEDS_REVIEW` (both are "true but not yet provable," never evidence the
  claim is false), not `FAILED`. New `apps/api` module
  (`modules/organizations`): `POST /v1/organizations` (creates the backing
  `Subject` + `Organization`), `GET /v1/organizations/:id` (derives
  `isVerified`/`verifiedLevel` the same way the provider does), `POST`/`GET
  .../:id/members`. `OrganizationMembership` is a normal tenant-owned
  table with the standard RLS policy (migration
  `20260918160000_add_organization_membership`). Seeded at `IDENTITY` /
  `DOCUMENT_VERIFIED` — the policy's declared level is fixed and
  denormalized onto every case at creation, so it can't dynamically match
  whatever level the Organization's own KYB case actually earned;
  `DOCUMENT_VERIFIED` is the honest floor for "a real, DB-enforced check
  ran."
- **`agent_in_person_document`.** A tenant agent physically holds the
  subject's *original* documents, inspects them, and attests to what they
  saw — first-party evidence from an authenticated tenant actor, the same
  trust level a bank teller's in-person ID check already carries. Unlike
  `SelfReportedCheckProvider`, `AgentAttestedCheckProvider`
  (`packages/verification-providers/src/agent-attested-check.provider.ts`)
  resolves directly to `PASSED`/`FAILED` — the human-judgment step already
  happened out of band. Reachable only through
  `POST /v1/verification-cases/:id/claims/:method/agent-attest`
  (`SubmitAgentAttestationDto {decision, notes}`), tenant API-key
  authenticated like the resolve-case route, never the subject's own
  session token — `agentId` (the tenant API key's id) travels into `raw`
  so every decision is traceable to a real actor. Seeded at `IDENTITY` /
  `DOCUMENT_VERIFIED`.

**Verified live**: `OrganizationMembershipProvider` proven with 6 tests
against real RLS-enforced Postgres (`RUN_DB_TESTS=true`) — missing/unknown
org, unconfirmed membership, unverified org, the real-inheritance PASSED
path, and a tenant-isolation proof (a tenantB Subject genuinely invisible
under tenantA's `app.tenant_id` context). Both new activity-level flows
(`org_membership`'s synchronous resolution, `agent_in_person_document`'s
pending→callback resolution) proven end to end against real Postgres in
`apps/workflows/test/verification-method.activity.spec.ts`, bypassing only
the unreachable Temporal server (same established workaround as every
other method here). The `organizations` module proven with real curl
end-to-end: create an org (unverified), create a person Subject, confirm
membership (traceable `addedByApiKeyId`), directly approve the org's own
KYB case exactly as a real completed KYB flow would, and watch
`GET /v1/organizations/:id` flip to `isVerified: true` with the right
`verifiedCaseId`/`verifiedLevel` — plus negative paths (404 on an unknown
org, 400 on a missing `legalName`, 400 on adding a non-`PERSON` Subject as
a member, 401 with no API key, 400 on an invalid `agent-attest` decision).
Full workspace `typecheck`/`lint`/`test` pass across every touched
package, including the new `@nid/db` dependency `packages/verification-providers`
now has — its first, since every other provider was previously pure
HTTP/self-contained.

### Self-hosted liveness: real face detection, blink detection, and face match

Replaces the "throws in production, dev-mode mock only" stub `LivenessProvider`
shipped with — a $0, self-hosted, MIT-licensed alternative to a $250/mo
vendor (Persona-class) plan, prompted directly by that cost. No vendor
account, no per-check fee, no external network call at runtime.

- **`packages/liveness-engine`** (new). `@vladmandic/face-api` +
  `@tensorflow/tfjs-node` — real face detection (TinyFaceDetector), 68-point
  landmarks, and a 128-d face-recognition descriptor, running on tfjs-node's
  native TensorFlow backend. The model weights (~13MB) ship **inside** the
  `@vladmandic/face-api` npm package itself, unlike the original
  justadudewhohacks/face-api.js — confirmed during development: no download
  step, no external fetch, genuinely self-hosted. Real, published,
  non-ML building blocks on top of that: Eye-Aspect-Ratio (Soukupová &
  Čech, 2016) for `computeEar()`, a real open→closed→open dip-and-recover
  state machine (with hysteresis) for `detectBlink()` — deliberately NOT
  "did EAR ever cross a threshold," which would wrongly count a subject who
  simply keeps their eyes shut the whole capture as a blink — and Euclidean
  descriptor distance (the standard 0.6 same-person cutoff) for
  `matchFaceDescriptors()`. `evaluateLiveness(frames, referenceImageBytes?)`
  orchestrates all of it over a short frame burst: rejects 0-face and
  2+-face frames, rejects the face changing identity mid-capture, runs the
  real blink check, and — when a reference image is supplied — a real
  face-match distance.
- **`LivenessProvider`** (`packages/verification-providers`) now runs this
  for real in production mode (`LIVENESS_DEV_MODE=false`), mapping the
  engine's evaluation to a claim result: any rejection reason (no face,
  multiple faces, identity change, undetectable reference face) or a
  reference mismatch is genuine negative evidence → `FAILED`; a clean
  result with no blink detected is `NEEDS_REVIEW`, not `FAILED` — a capture/
  timing miss is not proof of fraud, the same honesty standard as every
  other ambiguous outcome in this codebase; everything checking out is
  `PASSED`. Dev mode (`LIVENESS_DEV_MODE=true`, still the default) keeps
  working exactly as before for fast local iteration.
- **New payload contract.** Real blink detection needs a BURST of frames,
  not one photo — `liveness-callback-payload.ts` (new) parses
  `framesBytes: Buffer[]` (minimum 3) plus an optional `referenceImageBytes`,
  a different shape from every other upload-driven provider's single-image
  contract. `apps/workflows`' `resolveProviderPayload` gained a generic,
  shape-based (not method-name-based) `storageKeys` array + optional
  `referenceStorageKey` branch alongside the existing single-`storageKey`
  one. `VerificationCasesService.submitLiveness` / `SessionsService.submitLiveness`
  (both apps/api) now accept multiple uploaded frame files, store each as
  its own `DocumentAsset`, and look up the SAME case's `document_ocr`
  attempt's own uploaded `DocumentAsset` (its most recent one) to pass
  along as the face-match reference — liveness never requires document_ocr
  to run first; when none is found, the reference step is simply skipped.
- **`apps/verify-ui`**'s liveness step is now a real webcam capture
  (`LivenessStep`, new): `getUserMedia`, a live mirrored preview, a
  "Blink now" prompt timed to the middle of a 6-frame/~1.8s burst, each
  frame drawn to a canvas and encoded as a real JPEG blob, uploaded as a
  multipart `frames` field — not a single-file `<input type="file">`
  anymore. Fails with a clear, visible message (never silently) when
  `getUserMedia` is unavailable or denied.

**Verified live, several layers deep, nothing mocked at the boundary that
matters**:
- `packages/liveness-engine`'s own suite (25 tests) runs real model
  inference against real photos (bundled demo assets from
  `@vladmandic/face-api` itself) — real face detection, a real multi-face
  group photo genuinely rejected, a real face genuinely matched against
  itself (distance 0) and genuinely NOT matched against a different real
  photo (distance ~0.8, safely above the 0.6 cutoff), and a real blink
  detected end-to-end through the actual orchestrator from a landmark-level
  synthetic closed-eye frame — the one deliberate exception, and its own
  header comment explains why: a PIXEL-level synthetic closed eye (painting
  the eye region black, squashing that patch of pixels) was tried first and
  measurably failed to move this landmark model's inferred eye points at
  all, a genuine anti-spoofing property of the real model worth recording,
  not routing around quietly.
- `LivenessProvider`'s own suite mocks only `evaluateLiveness` itself (the
  same boundary `ImageClaimProvider`'s spec already draws for
  `evaluateDocument`), proving the FAILED/NEEDS_REVIEW/PASSED mapping logic.
- The activity layer's real, non-dev-mode pipeline is proven against real
  Postgres in a dedicated file (`apps/workflows/test/liveness-real.activity.spec.ts`,
  gated on `LIVENESS_DEV_MODE=false` — a separate file from the default
  suite's dev-mode liveness test, since the provider registry is built once
  per process from env at import time and the two modes can't coexist in
  one run): a real faceless burst resolves FAILED, a real single-person
  burst with no blink resolves NEEDS_REVIEW, and a real reference image of
  the same person genuinely matches (distance 0) through the real engine.
- The live HTTP layer was curled end to end against a running `apps/api` +
  real Postgres + real `@nid/storage`: three real photo files uploaded as
  a `frames` multipart field produced three `DocumentAsset` rows whose
  stored bytes MD5-matched the original file exactly (a byte-perfect round
  trip through multer and the storage driver), plus a correctly-located
  `referenceStorageKey` from a seeded prior `document_ocr` upload in the
  same case. (Case resolution itself still can't be observed over HTTP in
  this sandbox — Temporal is unreachable here, the same pre-existing
  limitation every other method in this codebase works around the same
  way, via the activity-level tests above.)
- `apps/verify-ui`'s real capture UI was driven in actual headless
  Chromium (Playwright) with `--use-fake-device-for-media-stream`: the
  camera preview rendered, "Start capture" ran the real burst loop, the
  "Blink now" prompt appeared on schedule, and the browser's real canvas-
  captured JPEG blobs were uploaded and landed as six real, distinctly-
  sized, valid 480×480 JPEG `DocumentAsset` files on disk — proving the
  entire `getUserMedia` → canvas → `FormData` → multer → storage pipeline
  end to end in a real browser, not simulated.

Full workspace `typecheck`/`lint`/`test`/`build` pass across every touched
package, including two more devDependency-only uses of jimp/`@vladmandic/face-api`
test fixtures (`apps/workflows`, mirroring the pattern `packages/liveness-engine`'s
own suite established) and the same `node --experimental-vm-modules` Jest
invocation `packages/ocr-engine` already needed for jimp's ESM-only
`file-type` dependency.

### Attribute-level badges: one tiny badge per real-world fact, not per case

A genuinely finer axis than ClaimType/VerificationLevel's own case-level
badge: a Subject's individual real-world facts (NAME, NATIONAL_ID_NUMBER,
PHONE, EMAIL, DATE_OF_BIRTH, ADDRESS) can each be independently verified,
by whichever method actually proved them — the point being that ONE method
can prove SEVERAL at once (a Pakistani e-stamp check confirms NAME +
NATIONAL_ID_NUMBER + PHONE together, since e-stamp purchase requires the
original CNIC and only accepts a phone number already linked to it) while
another proves exactly one (`otp_sms` proves nothing but PHONE control).
Both axes coexist deliberately — the coarse claimType/level badge answers
"is this Subject's IDENTITY verified, and how strongly," the new one
answers "which specific facts about them do we have real evidence for."

- **Schema.** New `AttributeType` enum and an append-only
  `VerifiedAttribute` table (`tenantId, subjectId, attribute, level,
  method, caseId, verifiedAt`) — the exact same append-only +
  rank-strongest-first pattern `PhoneBadgeEvidence` already established,
  just scoped per (subject, attribute) and RLS'd like every other
  tenant-owned table (VerifiedAttribute lives in VerificationCase's trust
  domain, unlike PhoneBadgeEvidence's cross-tenant one). `Subject` gained
  real address fields (addressLine1/addressLine2/city/region/countryCode/
  latitude/longitude) it never had before — Profile has its own for the
  public-facing side, but Subject (the KYC-side record) had nothing until
  now. `AttributeType.CNIC` was renamed to `NATIONAL_ID_NUMBER` before
  anything depended on it — generic across countries, matching
  `Subject.nationalIdNumber`'s own already-generic column name rather than
  hardcoding one country's term into a multi-country enum.
- **`method-attributes.ts`** (new, `packages/verification-providers`): the
  static, predefined "this method, once PASSED, proves exactly these
  facts, at this strength" map the whole feature is built on — e.g.
  `otp_sms → {PHONE, SELF_ATTESTED}` (possession, not identity — matches
  `VerificationLevel.SELF_ATTESTED`'s own pre-existing doc comment, which
  already named otp_sms as its example), `estamp_registry → {NAME,
  NATIONAL_ID_NUMBER, PHONE, REGISTRY_VERIFIED}` (declared now even though
  that provider itself is still blocked on which province's e-stamp system
  and whether real API access exists — the wiring is correct the moment it
  lands). A method absent from the map (liveness, org_membership, every
  EDUCATION/EMPLOYMENT method) proves none of these attributes — a real,
  deliberate fact about those methods, not an oversight.
- **Wiring.** `apps/workflows`' `resolveCaseActivity` now also writes one
  `VerifiedAttribute` row per attribute for every PASSED method attempt in
  a case — independent of the case's own overall resolution (REJECTED/
  EXPIRED/APPROVED): a method that genuinely passed proved something real
  even if a different, unrelated method later failed in the same
  multi-method case. `apps/api` gained `GET /v1/subjects/:id/attribute-badges`
  (`SubjectsService.getAttributeBadges`, reusing a new sibling ranking
  function `pickStrongestPerAttribute` — kept as its own small function
  rather than generalized with the existing claimType one, since the two
  are structurally identical but genuinely different domain concepts, and
  forcing a shared generic would've cost more clarity than the ~15 lines
  it would have saved).

### Address verification: three real methods for one real attribute

Exactly the three methods described when this was scoped: GPS/current-
location match, a utility bill upload, and postal mail carrying a one-time
code — each independently earning the same ADDRESS attribute badge at a
different strength.

- **`address_gps_match`** (new provider) — compares a subject's
  device-reported current location against their claimed address's
  coordinates (`Subject.latitude/longitude`) via a real haversine
  great-circle distance calculation (`geo-distance.ts`, validated against
  the real, well-known London–Paris distance and a real 1°-latitude
  distance, not just self-consistency). Within ~500m (configurable) →
  PASSED; farther → NEEDS_REVIEW, not FAILED — being away from a claimed
  address right now is a real signal, not proof the claim is false (the
  subject might just not be home, or the address on file might be stale),
  the same honesty standard every other ambiguous outcome in this codebase
  follows. The second provider in this package (after
  OrganizationMembershipProvider) to query nID's own data rather than a
  vendor or an upload.
- **`address_utility_bill`** — zero new provider code: one more
  `ImageClaimProvider` instance, reusing the exact same document-upload
  mechanism `education_document`/`employment_document` already use.
- **`address_postal_otp`** (new provider) — the strongest of the three: a
  real physical letter carrying a one-time code, mailed to the claimed
  address (`Subject.addressLine1/city/region/countryCode`), entered back
  once received. Same code-hash-and-compare mechanism as `otp_sms`
  (generate, hash, deliver, constant-time compare on submission) but
  deliberately not a shared base class with it — the delivery channel, its
  real vendor contract, and critically the wait duration are all genuinely
  different. Dev mode logs the code instead of mailing it; production mode
  makes a real, configurable HTTP call to a real postal/mail-delivery
  vendor (Lob, PostGrid, a national postal service API, ...) and throws a
  clear error if none is configured, the same buy-vendor pattern
  `RegistryCheckProvider` already established.
- **Per-method Temporal timeouts** (new: `method-timeouts.ts`,
  `VerificationWorkflowInput.methodTimeouts`). Physical mail takes DAYS,
  not the ~10 minutes every other method in this codebase completes
  within — leaving the same global default would have made
  `address_postal_otp` a method that could structurally never succeed (the
  case would always expire before a letter could possibly arrive). Now a
  static, predefined per-method override (`address_postal_otp: '7 days'`,
  everything else keeps the shared default), computed by `apps/api` at
  case-creation time and threaded through the workflow input — the
  workflow itself never branches on method name, it just reads whatever
  duration it was handed. Surfaced two new generic, shape-based submission
  routes reusable by any future method needing them:
  `.../claims/:method/code` (otp_sms keeps its own established
  `/otp/submit` route) and `.../claims/:method/location`, on both the
  tenant-API-key and subject-session controllers.
- Generalized `resolveProviderPayload`'s inline-value passthrough from a
  hardcoded `otp_sms`-only `expectedCodeHash` rename into a genuine
  `{...payload, ...resultMeta}` spread, so `address_gps_match`'s expected
  coordinates and any future inline-value method's own state reach
  `handleCallback` the same way `otp_sms`'s `codeHash` now does (renamed
  to match, rather than translated in between for no real reason).

**Verified live, real evidence at every layer**: `geo-distance.spec.ts`
against the real London–Paris distance; `address-gps-match.provider.spec.ts`
and `address-postal-otp.provider.spec.ts` against real Postgres
(`RUN_DB_TESTS=true`) — a subject with claimed coordinates/address versus
one without, dev-mode code generation, production mode's real "no vendor
configured" error; the full activity-layer pipeline proven end to end in
`verification-method.activity.spec.ts` — a real close-by location
resolves PASSED with a real ADDRESS/DOCUMENT_VERIFIED row, a real
genuinely-different-city location resolves NEEDS_REVIEW with **no**
attribute row written (no false badge from an unproven attempt), and a
real postal code round-trip resolves PASSED with a real ADDRESS/
REGISTRY_VERIFIED row. The full HTTP layer proven live against a running
`apps/api` + real Postgres: `POST /v1/subjects` with real address/
coordinate fields round-trips correctly, `GET /v1/subjects/:id/attribute-badges`
returns the real seeded evidence for both a single-attribute case
(`otp_sms` → one PHONE/SELF_ATTESTED badge, coexisting correctly with the
same subject's coarse IDENTITY/SELF_ATTESTED claimType badge) and the
multi-attribute case the whole feature was built around (`estamp_registry`
→ three real REGISTRY_VERIFIED badges — NAME, NATIONAL_ID_NUMBER, PHONE —
from one case, traceable to the same method and case id), plus negative
paths (400 on an out-of-range latitude on both subject creation and
location submission, 400 on submitting a code/location to a method that
isn't a code/location method). Full workspace `typecheck`/`lint`/`test`/
`build` pass across every touched package.

### KYC: the first real fraud/tamper detection step — image forensics

A genuinely new `packages/forensics-engine`, following the same
new-package-per-real-capability pattern as `ocr-engine` and
`liveness-engine`: three independent, non-ML, textbook forensic techniques
— not a proxy heuristic, not a fake "ML model" — layered onto every
`ImageClaimProvider` instance (`document_ocr`, `dob_document`,
`education_document`, `employment_document`, `address_utility_bill`)
automatically, with no new method key and no new `VERIFICATION_METHODS`
entry: this is an anti-fraud signal on top of an existing document upload,
the same category as `liveness` in `method-attributes.ts`'s own doc
comment, not a new attestation.

- **`error-level-analysis.ts`** — real Error Level Analysis: re-saves the
  image at a fixed JPEG quality and diffs it block-by-block (8x8, matching
  JPEG's own DCT block size) against the original. A block from a
  different source/edit history than its surroundings (spliced-in content,
  different sensor noise) reliably shows a different re-compression error
  than the untouched majority. Uses median/MAD (not mean/stddev) to find
  the outlier blocks — deliberately robust to the outlier cluster itself
  (often 10-20% of an image) dragging up a plain mean/stddev baseline.
- **`exif-consistency.ts`** — real EXIF/TIFF metadata parsing (via
  `exifr`, a mature independent library — reading correctness is its
  concern, not reinvented here) split the same way `evaluate-document.ts`
  already splits OCR from decision logic: a thin real-I/O read and a pure,
  fully unit-tested decision function. Flags a Software tag naming a known
  image editor (Photoshop, GIMP, Snapseed, ...) or a DateTimeOriginal/
  ModifyDate mismatch beyond a minute's tolerance. Deliberately does
  **not** flag missing EXIF by itself — messaging apps and most upload
  widgets strip it by default, so absence is the common, innocent case,
  not a signal.
- **`recapture-artifact.ts` + `fft.ts`** — real frequency-domain
  moire/periodicity detection: a from-scratch radix-2 Cooley-Tukey FFT (no
  library, the actual textbook algorithm), applied to a Hann-windowed,
  grayscale-resized 128x128 grid. Re-photographing a screen or a printed
  halftone reliably produces a genuine periodic interference pattern — a
  narrow, unusually strong peak in the mid-frequency band, physically
  distinct from a real single-capture photo's smoothly-decaying spectrum.
  This is the actual DSP technique real forensic tooling uses for this
  question, not a proxy like "how sharp is this" (which would also
  misfire on a perfectly legitimate flatbed scan).
- **`evaluate-forensics.ts`** — combines the three into `CLEAN` /
  `SUSPICIOUS` / `TAMPERED`, corroboration-gated: each signal alone has a
  known, documented false-positive case (a solid ink stamp can trip ELA, a
  scanner's own firmware string can look unfamiliar to the EXIF check), so
  one signal alone only ever reaches `SUSPICIOUS`; `TAMPERED` requires two
  or more independent signals — built on unrelated physics — agreeing.
  Wired into `ImageClaimProvider`: `TAMPERED` overrides even a
  checksum-valid MRZ read to `FAILED` (the checksum only proves the digits
  OCR read were internally consistent, not that the pixels behind them
  weren't manipulated); `SUSPICIOUS` only ever downgrades an
  otherwise-`PASSED` result to `NEEDS_REVIEW`, never fails a case outright,
  and never touches a result OCR already flagged — the same
  PASSED/FAILED/NEEDS_REVIEW honesty discipline every other check in this
  codebase follows.

**Verified live, real evidence at every layer, no mocked "detected
tampering" output anywhere**: `fft.spec.ts` proves the from-scratch FFT
against a known DC-only signal and a known pure sinusoid's exact frequency
bin; `error-level-analysis.spec.ts` proves a real high-frequency patch
spliced into a real smooth JPEG background is found as a real localized
error hotspot (calibrated against real measured JPEG re-compression error
magnitudes, not assumed numbers); `exif-consistency.spec.ts` round-trips a
real, hand-built EXIF/TIFF byte segment (genuine APP1 layout per the EXIF
2.3 spec) through the real `exifr` parser; `recapture-artifact.spec.ts`
proves a real periodic stripe pattern is flagged while a real
gradient-plus-noise "natural photo" is not; `evaluate-forensics.spec.ts`
proves the combination logic's corroboration gate. A final live,
un-mocked smoke run against real synthetic JPEGs confirmed the full
pipeline end to end: a clean photo evaluates `CLEAN` (all three signals
quiet), a genuinely spliced photo evaluates `SUSPICIOUS` with `ela.
suspicious: true` and a real `hotspotRatio` of ~0.098 — one real,
uncorroborated signal, correctly not escalated to `TAMPERED` on its own.
`image-claim.provider.spec.ts` proves the override/downgrade/passthrough
wiring (mocking `@nid/forensics-engine` at the boundary, exactly the same
precedent this file already established for `@nid/ocr-engine`'s own
`evaluateDocument`). Full workspace `typecheck`/`lint`/`test`/`build`
passes across every touched package, including the real-Postgres
`RUN_DB_TESTS=true` activity suite proving the new dependency loads
correctly through the real provider registry.

### KYC: e-stamp CNIC+phone registry verification (Pakistan)

`estamp_registry` — the last piece of the original attribute-badges plan
(`method-attributes.ts` had declared its `NAME`/`NATIONAL_ID_NUMBER`/
`PHONE` mapping since that task, waiting for the provider). Zero new
provider code: one more `RegistryCheckProvider` instance, the exact same
mechanism `bank_account_title` already established — a self-defined HTTP
contract (`POST {apiUrl}` with `{method, referenceId, subjectId, tenantId,
phone?}`, `Bearer {apiKey}`, expects `{status, score?, raw?}` back), never
a fake vendor integration.

Pakistani stamp duty collection is a **devolved, per-province system** —
Punjab's e-Stamping runs through Bank of Punjab, Sindh and the other
provinces through their own excise & taxation departments — so there is no
single national e-stamp API to hardcode, and (same story as
`bank_account_title`'s NSC/Truework, or `ecp_voter_registration`'s ECP)
none of them offer self-serve signup; a real integration needs an actual
institutional agreement with whichever provincial authority/bank a given
deployment operates in. What's genuinely buildable without that agreement,
and what this ships: the real HTTP client, the real request/response
contract, dev-mode for local testing, and a clear thrown error in
production if unconfigured — exactly `RegistryCheckProvider`'s own
established pattern, extended (not forked) to carry a `phone` field
alongside `referenceId` (the CNIC), mirroring exactly how `accountTitle`
already extends the same contract for `bank_account_title` — sent only for
the method that needs it, validated as required only for that method
(`missing_phone`, the same fail-closed shape as `missing_account_title`).
The moment a real agreement exists with any provincial vendor, only
`ESTAMP_REGISTRY_API_URL`/`ESTAMP_REGISTRY_API_KEY` need to change — no
code does.

- `apps/api`: `CreateVerificationCaseDto` needed no new field —
  `estamp_registry` reuses the same `phone` field `otp_sms` already has
  (the same real-world phone number, just consumed two different ways:
  one sends a code to it, the other asks a registry to confirm it's on
  file), and `referenceId` the same way `bank_account_title` already
  reuses it for an account number. `buildMethodInput` grew one more
  branch, same shape as the existing `bank_account_title` branch.
  `estamp-registry` policy seeded (`IDENTITY` / `REGISTRY_VERIFIED`, same
  tier as `bank-account-title`).

**Verified live, no fabricated vendor response anywhere**:
`registry-check.provider.spec.ts` grew five new cases (phone sent/omitted
per method, fail-closed on a missing phone, symmetric to the existing
`accountTitle` coverage) — all passing. `verification-method.activity.spec.ts`
proves the full chain against real Postgres (`RUN_DB_TESTS=true`): a real
CNIC+phone input resolves synchronously through the real provider
registry to `PASSED` in dev mode, `resolveCaseActivity` writes real
`NAME`/`NATIONAL_ID_NUMBER`/`PHONE` `VerifiedAttribute` rows, and the case
resolves to `APPROVED` — genuine end-to-end wiring, not just the
provider-layer unit tests. The seed script was re-run live: the
`estamp-registry` policy row is confirmed present in real Postgres
(`SELECT ... FROM "VerificationPolicy" WHERE name = 'estamp-registry'`).
Full workspace `typecheck`/`lint`/`test`/`build` passes.

### "Login with nID": closing the test-coverage gap

`AccountsService`/`OAuthService` shipped in Phase 0 validated only by a
one-off manual curl pass, never as a regression test — the one feature in
this codebase without automated coverage. `apps/api/test/accounts.service.spec.ts`
and `apps/api/test/oauth.service.spec.ts` close that, following the same
live-Postgres, `RUN_DB_TESTS`-gated, direct-instantiation approach
`apps/workflows/test/verification-method.activity.spec.ts` and
`apps/api/test/tenant-isolation.spec.ts` already established — the real
service classes constructed directly (`new AccountsService(prismaService)`,
`new OAuthService(prismaService)`), no Nest DI bootstrap, no HTTP layer,
against real Postgres.

`AccountsService`: a real OTP challenge is written and hashed correctly;
`OTP_SMS_DEV_MODE=false` throws instead of pretending to send an SMS; the
first correct code both creates the Account and logs it in; a wrong code
is rejected without consuming the real one; the same code is rejected a
second time (single-use within the TTL); an expired code is rejected even
with the right digits; a returning phone reuses the same Account row, never
a duplicate; `resolveSession` returns the real account for a valid token
and rejects an unknown or expired one. (Overwriting the persisted OTP hash
to a known plaintext, rather than scraping the dev-mode log line, mirrors
exactly how `otp_sms`'s own activity test already handles this.)

`OAuthService`: the full happy path end to end — create a login request,
poll `PENDING`, approve as a real authenticated Account, poll `APPROVED`,
claim the one-time code, exchange it for real identity claims — plus every
security-critical negative path: unknown client, unregistered redirect
URI, approving a request that isn't pending, claiming before approval, a
second claim on the same request, a wrong client secret, a mismatched
redirect URI at exchange time, replaying an already-consumed code, an
unknown poll token, and a `PENDING` request past its TTL correctly reading
as `EXPIRED` rather than still approvable.

**Verified live**: both suites run clean against real Postgres
(`RUN_DB_TESTS=true pnpm --filter @nid/api test`) — 21 new tests, all
passing on first run, no adjustment needed. Test data (Accounts, sessions,
OTP codes, the scratch Tenant/OAuthClient) is fully torn down in
`afterAll`, confirmed via a direct Postgres query showing zero leftover
rows. Full workspace `typecheck`/`lint`/`test` passes.

### Dashboard staff auth: TenantStaffMembership replaces raw API-key paste

Closes the last Phase 0 item its own summary flagged and never circled back
to: `apps/dashboard`'s login was a shared tenant API key pasted into a text
field, stored in localStorage — which meant `VerificationCase.reviewerId`
and every manual-review audit-log entry could only ever say "this API key
resolved this case," never which real person did. A shared secret with no
per-person accountability is a real hole in a KYC review trail, not a
cosmetic gap.

- **`TenantStaffMembership`** (new model + migration): the bridge between
  the two trust domains this codebase already has — a real `Account`
  (phone + OTP, the same portable identity `apps/login-ui`/
  `apps/profile-ui` already use) mapped to a `Tenant` it's staff of. Needs
  the same open-SELECT-for-bootstrap RLS exception `TenantApiKey`/
  `OAuthClient`/`VerificationSession` already carry — resolving which
  tenant(s) an Account staffs is how `app.tenant_id` gets determined for a
  staff request in the first place.
- **`TenantActorGuard`** (new, `apps/api/src/core/auth`): a strict
  superset of `ApiKeyGuard` — accepts the exact same tenant API key (same
  hash lookup) OR a real staff `Account` session token, resolved through
  `TenantStaffMembership` to whichever tenant it's for. A caller with
  membership on more than one tenant must send `X-Tenant-Id`; sending it
  with only one membership is still validated, never silently ignored (a
  live test caught exactly this gap during development — see below).
  Deliberately scoped narrow: only the routes a human in `apps/dashboard`
  actually calls (`GET /v1/verification-cases`, `GET .../:id`,
  `POST .../:id/resolve`, `GET /v1/subjects/:id/badges`,
  `GET .../attribute-badges`, `GET /v1/tenants/me`) moved onto it — every
  server-to-server integration route (`create`, the `submit*` endpoints,
  `subjects.create`, `organizations.*`) stays on plain `ApiKeyGuard`,
  unchanged.
- **`TenantStaffModule`** (new): `POST /v1/tenant-staff` (ApiKeyGuard —
  inviting staff is a tenant-admin action) requires the invited phone to
  already have a real, verified `Account` — no "pending invite"
  placeholder state, the same honesty standard as the rest of this
  codebase. `GET /v1/tenant-staff` lists real membership rows.
- **`apps/dashboard`**: the API-key-paste login screen is gone, replaced
  with the same phone+OTP UX `apps/login-ui`/`apps/profile-ui` already
  use. `api-client.ts`'s stored value is now generically a "credential"
  (an API key or a session token — the backend duck-types either), and
  the header shows `(API key)` when a session actually did authenticate
  with one, so it's never ambiguous which kind of access is signed in.
  Seeded a real demo staff `Account` per tenant so the dashboard is
  usable immediately after `pnpm db:seed`.
- `VerificationCase.reviewerId` and its audit-log entries now record
  whichever real actor resolved the case — a `TenantApiKey.id` or a real
  staff `Account.id` — never a hardcoded `'TENANT_STAFF'` actorType stapled
  onto an API key id the way it was before. `OrganizationMembership.addedByApiKeyId`
  deliberately was **not** touched — nothing in `apps/dashboard` calls that
  path yet, so widening it would be speculative, not real.

**Verified live, including a bug a live pass actually caught**: 15 new
tests in `apps/api/test/tenant-staff.spec.ts` (`TenantStaffService`
invite/list, `TenantActorGuard`'s every branch, `SubjectsService.getBadges`
recording the real actor) — all against real Postgres. A full real browser
pass through the actual running dashboard (Playwright, no mocks): phone+OTP
login as the seeded staff Account → real case list → opened a real case →
approved it with a real reason → confirmed `Reviewer:` on the case-detail
page shows the real staff `Account.id`, byte-for-byte the same id
`TenantStaffMembership` was seeded with, not an API key. That same live
pass caught two real bugs before they shipped: (1) `TenantActorGuard`
silently ignored a mismatched `X-Tenant-Id` header when an account
happened to have only one membership — fixed to always validate the
header when present; (2) the case-detail badges panel broke with "Invalid
or revoked API key" because `subjects.controller.ts`'s badges routes were
still `ApiKeyGuard`-only — moved onto `TenantActorGuard` alongside
`verification-cases.controller.ts`. Full workspace
`typecheck`/`lint`/`test`/`build` passes.

### Design pass: a real visual identity for the three end-user-facing apps

The sign-up/login screens across `apps/dashboard`, `apps/profile-ui`, and
`apps/login-ui` worked but looked like unstyled scaffolding — no logomark,
system-default fonts, a bare `<input maxLength={6}>` for OTP entry, no
hover/focus polish. Flagged during a screenshot request and fixed as its
own pass rather than folded silently into feature work.

- **Logomark** (`app/components/logomark.tsx`, identical copy in all three
  apps — this codebase's established convention of no cross-app frontend
  sharing, not an oversight): a hand-drawn SVG "N" letterform in a rounded
  blue square with a green checkmark badge overlapping the corner, not a
  text label. Also serves as `app/icon.svg` in each app — Next's App
  Router auto-serves it as the favicon with zero extra config.
- **`OtpInput`** (`app/components/otp-input.tsx`, same three-way copy):
  replaces the plain 6-digit text field everywhere a phone+OTP form exists
  (`apps/dashboard`'s staff login, `apps/profile-ui`'s owner login,
  `apps/login-ui`'s `PhoneLoginForm`) with six separate boxes — auto-advance
  on digit entry, Backspace steps back and clears, arrow-key navigation,
  and pasting a full code fills every box at once. Real OTP-entry UX, not
  a different-looking version of the same field.
- **Type + surface polish**: self-hosted Inter (`next/font/google`, no
  runtime call to Google's CDN) via each app's `layout.tsx`; `--shadow-sm`/
  `--shadow-md` tokens (light + dark) replacing flat borders on cards;
  focus rings changed from a hard `outline` to a soft `border-color` +
  `box-shadow` glow matching `--accent`; buttons gained a `hover`
  brightness bump and an `active` press-down transform. All additive to
  each app's existing `globals.css` token set — no visual behavior changed
  for anything the design pass didn't touch.
- Every login/authorize screen now leads with the logomark above a
  centered brand label, and the OTP step shows dynamic lead text
  (`Enter the code sent to {phone}`) plus a "Use a different number" reset
  — a pattern that didn't exist before (the old flow had no way back to
  the phone step without reloading the page).

**Verified live**: `typecheck`/`lint`/`build` clean for all three apps
(`dashboard`, `profile-ui`, `login-ui`). A full real-browser Playwright
pass against all three running dev servers: screenshotted the phone step
and OTP step for each app's login/authorize screen, then drove one flow
fully end-to-end — typed a real phone number into `apps/dashboard`'s
redesigned form, read the real dev-mode OTP code back out of the API's
log output, entered it digit-by-digit into the new `OtpInput` boxes (each
keystroke exercising its real auto-advance logic, not just a value set
via JS), submitted, and landed on the real case list with the header
correctly rendering the new logomark next to the tenant name — proving
the redesign didn't just look right, it still authenticates for real.

### KYB: real verification methods for the Organization entity itself

`Organization.isVerified` (`organizations.service.ts`'s `getById()`) always
derived honestly — it looks for a real APPROVED `VerificationCase` at
`claimType: IDENTITY` on the Organization's own Subject, the same
mechanism any Subject's verification uses, since `Subject.type:
ORGANIZATION` was never special-cased out of the generic pipeline. What
never existed was a *real* way to produce that case: the org_membership/
agent_in_person_document validation pass (see above) proved its
inheritance logic by directly flipping a test Organization's case to
APPROVED — an honest stand-in at the time, but never a real KYB method a
tenant could actually call. This closes that gap.

- **`business_registry`** and **`business_registration_document`** — zero
  new provider code, both reuse existing generic mechanisms exactly the
  way `docs/HOUSE-RULES.md` rule 1 asks: `business_registry` is a plain
  `RegistryCheckProvider` instantiation (a company's registration number
  looked up against whichever business-registry vendor/national registrar
  a tenant contracts with — the exact same generic HTTP contract
  `education_registry`/`estamp_registry`/etc. already define, just a new
  key), and `business_registration_document` is a plain `ImageClaimProvider`
  instantiation (OCRs a certificate of incorporation; `ImageClaimProvider`
  already degrades non-MRZ documents to `NEEDS_REVIEW` with extracted text
  rather than a fabricated pass, so a document with no MRZ was never a
  special case to design around). `BUSINESS_REGISTRY_API_URL`/
  `BUSINESS_REGISTRY_API_KEY` env vars, same shape as every other registry
  method.
- **`method-subject-types.ts`** (new, `@nid/verification-providers`) — the
  real gap this pass actually found: nothing stopped a tenant from running
  `document_ocr` (MRZ passport parsing) or `liveness` (face match) against
  an Organization, or `business_registry` against a person, before this
  existed. A static `Record<string, SubjectType[]>` (absent = PERSON-only,
  the default every method carried by construction before Organization-facing
  methods existed), enforced in `VerificationCasesService.create()` right
  after the Subject is loaded — a `BadRequestException` naming the
  offending method, not a silent no-op or a nonsensical PASSED. Also
  settles two existing methods' scope explicitly: `org_membership` stays
  PERSON-only (it verifies a person's membership, never the org itself —
  running it against the Organization's own Subject was never meaningful),
  and `agent_in_person_document` applies to either (a tenant agent
  inspecting a person's ID or an org's certificate of incorporation is the
  same mechanism).
- Two new seeded policies, `org-kyb-document` (`DOCUMENT_VERIFIED`) and
  `org-kyb-registry` (`REGISTRY_VERIFIED`) — mirroring the document/registry
  pairing every other ClaimType already has.

**Verified live**: full workspace `typecheck`/`lint`/`test`/`build` clean.
`packages/verification-providers`: a new `business_registry` case in
`registry-check.provider.spec.ts` (dev mode + a mocked prod-mode HTTP call,
same pattern as every other registry key) and a new
`method-subject-types.spec.ts`. `apps/workflows`: both new methods proven
end to end against real Postgres in `verification-method.activity.spec.ts`
— `business_registration_document` through the real upload→storage→OCR
mock→`resolveCaseActivity` path (bypassing only the unreachable Temporal
server, same established workaround), `business_registry` through the
real synchronous registry-check path — both against a real
`Subject.type: ORGANIZATION` row, the first tests in this codebase to use
one. `apps/api`: a new `organization-verification.spec.ts` proves the
`Subject.type` guard's rejection path (business_registry against a PERSON,
otp_sms and org_membership against an ORGANIZATION, each via the real
service method) and `OrganizationsService.getById()`'s derivation reading
back a case shaped exactly like what the real activity pipeline produces.
Then, since none of that touches Temporal, a real HTTP round trip against
a live `apps/api` closed the loop the tests can't reach: created a real
Organization via `POST /v1/organizations`, confirmed `isVerified: false`
before any case exists, then confirmed both guard directions over real
HTTP (`otp_sms` against the org's Subject, `business_registry` against a
plain `PERSON` Subject) return `400` with the exact message the service
throws — proving the guard isn't just unit-tested but actually wired into
the route a tenant would really call.

### Organization employee invites + verified brand profiles

An Organization can now invite employees who don't have an nID Account
yet, and manage its own brand Profile — the third piece requested
alongside org KYB (above) and the design pass. Deliberately built around
one hard rule the request was explicit about: **account control never
moves off the person.** An Organization never gets its own login; nothing
it does can create, verify, or take over anyone's Account. What it *can*
do is invite a phone number, and the person decides whether that invite
ever means anything.

- **`Subject.accountId`** (new, nullable, indexed — not unique: one
  Account can have many Subjects, one per tenant that's ever KYC'd it) —
  the join key from a tenant's own KYC record back to the person's real
  portable Account, once known. A real bug shipped and was caught by this
  feature's own live-curl validation pass, not a unit test: this was
  first declared `@unique`, which silently broke inviting the same phone
  into a second Organization under a different tenant (`P2002` on the
  second `Subject.update()`) — fixed before merge; see
  `organization-employee-invites.spec.ts`'s own header comment and its
  "same phone into a SECOND organization" test, which exists specifically
  to keep that bug fixed.
- **`OrganizationMembership` gains a real invite lifecycle**: `status`
  (`PENDING` → `ACTIVE`/`DECLINED`) and `isAdmin`. `addMember()`'s
  original direct-attestation path (an already-known Subject, immediately
  confirmed — still used by `agent_in_person_document`-style flows) keeps
  creating `ACTIVE` rows straight away; only the new `invite()` path ever
  creates a `PENDING` one. `OrganizationMembershipProvider` was updated to
  treat `PENDING`/`DECLINED` exactly like no row at all — an invite the
  person hasn't acted on is no more proof of employment than their own
  claimed `organizationId` is.
- **`OrganizationsService.invite()`**: finds-or-creates a `Subject` for
  the phone in that tenant, finds-or-creates a **shell Account**
  (`phoneVerifiedAt` left `null`) if none exists yet, links them, and
  creates a `PENDING` membership. Nothing here ever sets
  `phoneVerifiedAt` — the shell claims itself for real the moment the
  invited phone completes its own OTP through the ordinary
  `accounts.service.ts` flow, which already upserts on phone. Zero new
  code needed there; this is the whole point.
- **`GET /v1/accounts/me/organization-invites`, `POST .../:id/accept`,
  `POST .../:id/decline`** (all `AccountSessionGuard`, never a tenant API
  key) — the person's own, explicit accept/decline. `respondToInvite()`
  gives a mismatched account and a genuinely-missing id the *identical*
  `NotFoundException`, so the endpoint can't be used to probe whether an
  invite id exists. `OrganizationMembership` and `Organization` both
  picked up an open-SELECT bootstrap RLS exception for this (same shape
  TenantApiKey/OAuthClient/TenantStaffMembership already carry) — safe
  for `Organization` because a legal business name/registration number is
  inherently public-record information; deliberately **never** extended
  to `Subject`, which holds real PII (nationalIdNumber, DOB, address) —
  `OrganizationMembership.accountId` is denormalized at invite time
  specifically so the invite-list query never needs to join through
  `Subject` to get there.
- **Cross-org privacy is structural, not a filter someone could forget**:
  every query is scoped to `(organizationId, accountId)` or to the
  caller's own `accountId` — nothing aggregates "every org this account
  belongs to" from an org's own side. Tested directly: two organizations
  under two different tenants, the same person accepted into both,
  `GET /v1/organizations/:id/members` on either side never mentions the
  other.
- **Brand Profile**: `Profile.accountId` is now nullable, `organizationId`
  (nullable, `@unique`) was added, and a migration-level `CHECK`
  constraint (`(accountId IS NOT NULL) <> (organizationId IS NOT NULL)`)
  makes "exactly one owner" a database guarantee, the same DB-enforced
  standard RLS already holds this codebase to elsewhere — never just
  application discipline. `ProfilesService.createForOrganization()` (and
  `getForOrganization`/`updateForOrganization`) require **both** an
  `ACTIVE` + `isAdmin` `OrganizationMembership`
  (`OrganizationsService.requireActiveAdmin()`) **and** the Organization
  actually being verified (`getVerificationStatus()` — the exact
  derivation `getById()` itself uses, extracted so both call sites share
  one query instead of two copies drifting apart). `isAdmin` can only
  ever be set by a tenant's own `invite()` call — an Organization has no
  self-service admin-promotion path yet, deliberately: bootstrapping who
  speaks for an Organization is still the tenant's call. The public
  `/[slug]` projection now branches on owner: a personal profile's badges
  still come from `CrossTenantBadgesService` (phone-keyed); a brand
  profile has no phone at all, so its badges come from the Organization's
  own live KYB status instead — the same `getVerificationStatus()` call,
  never a cached flag.

**Verified live**: full workspace `typecheck`/`lint`/`test`/`build` clean.
16 new tests in `apps/api/test/organization-employee-invites.spec.ts`
against real Postgres — shell-account pre-provisioning, the real
`accounts.service.ts` OTP flow claiming that exact shell, re-invite
idempotency, the cross-tenant `Subject.accountId` bug fix (above),
accept/decline (including the wrong-account and already-responded
rejections), `requireActiveAdmin()`'s full branch coverage (non-member /
PENDING / ACTIVE-non-admin / ACTIVE-admin), and
`createForOrganization()`'s gates (unverified rejected, non-admin
rejected, duplicate rejected, success renders the right public badge).
Beyond the test suite: a full real-HTTP pass against a live `apps/api` —
create a KYB-verified Organization, invite a real phone via curl, run
that phone through the actual `POST /v1/accounts/otp/start` /
`.../verify` endpoints (reading the dev-mode code back out of the API's
own log output, not injected), confirm the shell Account really claimed
itself, accept the invite, create the brand Profile as the now-ACTIVE
admin, and load the public `/[slug]` page and see the real IDENTITY
badge — then a second Organization under a second tenant, same phone,
proving isolation and the non-admin/unverified rejections end to end.
This same live pass is what caught the `Subject.accountId` uniqueness
bug before it ever reached a test file.

### Verified real names and the username system: "one username, forever, and it has to be you"

Two gaps first: nowhere in the schema was a verified name ever stored as a
*value* — `PhoneBadgeEvidence` proves an IDENTITY check happened at some
`VerificationLevel`, never what name it found. And
`VerificationMethodAttempt.raw` was computed by every provider's
`evaluateDocument()`/`VerificationResult` and then thrown away —
`resolveCaseActivity` only ever forwarded it transiently into a
FAILED/NEEDS_REVIEW webhook payload, never persisted it, and an APPROVED
case got `raw: {}`. `packages/ocr-engine`'s MRZ parser (`mrz.ts`) already
extracted `givenNames`/`surname` from a checksum-valid TD3 zone; it just
never reached `evaluate-document.ts`'s output. Both fixed together, because
the username system needs a real value to derive a slug from, not just a
pass/fail flag:

- **`evaluateDocument()`** now surfaces `raw.mrz.givenNames`/`surname` for a
  checksum-valid MRZ (`undefined` on a failed/tampered checksum — never
  surface a name the check itself couldn't trust). Proven against the real
  ICAO Doc 9303 worked example, not a synthetic stand-in, and separately
  against a real Playwright-rendered passport image run through real
  Tesseract OCR end to end (a genuine HTML-injection bug in that rendering —
  unescaped `<` MRZ filler chars parsed as tags by `page.setContent()` —
  surfaced and fixed along the way).
- **`VerificationMethodAttempt.raw Json?`** — the provider result is now
  persisted on every attempt, not just forwarded on the unhappy paths.
- **`PhoneNameEvidence`** (new, alongside `PhoneBadgeEvidence` in the same
  cross-tenant trust domain — phone-keyed, no `Subject` PII, readable via
  `PrismaService.unscoped`): `resolveCaseActivity` writes one row per PASSED
  `document_ocr` attempt that yielded an MRZ name, and updates
  `Subject.givenName`/`familyName` to match. A second, later case with a
  *different* MRZ name appends a new row rather than overwriting — that
  append becomes the signal task #75's govt-rename unlock will read.

On top of that evidence, `apps/api/src/modules/profiles`:

- **`slugifyRealName`/`slugMatchesRealName`** (`profiles/username.ts`) —
  NFKD-normalize and hyphenate a real name into a slug, then accept either
  an exact match or a hyphen-qualified extension of it (`anna-maria-eriksson`
  or `anna-maria-eriksson-nyc`) — never an arbitrary string, "will for sure
  contain the realname in priority" enforced structurally, not by convention.
- **Verified-account gate**: `ProfilesService.requireVerifiedRealName()`
  requires *both* an IDENTITY-claimType badge (`CrossTenantBadgesService`)
  *and* a real `PhoneNameEvidence` row — an account verified some other way
  that never actually confirmed a name (e.g. registry-only) is correctly
  still rejected. `create()`/`update()` apply this to personal profiles;
  `createForOrganization()`/`updateForOrganization()` apply the equivalent
  rule to brand profiles, deriving the slug from `Organization.legalName`
  instead (via the new `OrganizationsService.getVerified()`, throwing if the
  org isn't verified) — reusing the same `slugifyRealName` helpers rather
  than building a parallel "verified org name" capture path, since legalName
  is the one name the org's own KYB (already required to create a brand
  profile at all) practically vouches for.
- **One username per person/org, forever**: `create()`/`createForOrganization()`
  reject a second profile for an owner that already has one
  (`ConflictException`) — there is no route to a second slug, only to
  changing the first.
- **`Profile.usernameSetAt`**: stamped on every slug creation/change, live
  timestamp rather than a stored lock-boolean — matches this codebase's
  existing "derive live, don't cache" standard (`Organization.isVerified`).
  Task #75 will compute the 7-day reconsideration window and permanent lock
  from this field rather than adding a second source of truth.

**Verified live**: full workspace `typecheck`/`lint`/`test`/`build` clean.
New coverage: `packages/ocr-engine`'s MRZ-name-surfacing tests (pass and
tamper-suppressed), `apps/workflows`'s `PhoneNameEvidence`-write tests
(written, not written, appended on a real name change),
`apps/api/src/modules/profiles/username.spec.ts`, and a new live-Postgres
`apps/api/test/profiles.service.spec.ts` covering both gates end to end:
no-badge rejected, badge-without-name-evidence rejected, unrelated slug
rejected, exact-name and hyphen-suffixed slugs accepted, a second profile
for the same owner rejected, a slug-only update re-validated while a
non-slug update isn't, and the organization equivalents (unrelated slug
rejected, legalName-derived slug accepted). Two pre-existing tests in
`organization-employee-invites.spec.ts` used arbitrary timestamp-suffixed
slugs that this new rule correctly now rejects — expected breakage from a
real rule that didn't exist when those tests were written, fixed by
deriving those slugs from the orgs' own `legalName` instead of loosening
the rule.

### Username lock: a week to reconsider, then permanent until a real govt-record name change

"Once username is made, user will be given a week if he wants to
reconsider, after 1 week username will become permanent forever. User
will be able to change only when he has changed his realname in govt
record." Two pieces:

- **`Profile.usernameSourceName`** (new column) — the slugified verified
  name (personal: `PhoneNameEvidence`; brand: `Organization.legalName`)
  the *current* slug was actually derived from, stamped alongside
  `usernameSetAt` on every accepted slug creation/change. This is what
  makes "the govt record changed" a fact the service can check instead of
  a story someone tells it: a fresh call to the exact same
  `requireVerifiedRealName()` (personal) / `getVerified().legalName`
  (brand) lookup `create()` already uses either matches
  `usernameSourceName` (nothing has changed) or doesn't (it has) — no
  separate "did the name change" flag to fall out of sync with reality.
- **`isUsernameLocked()`** (`profiles/username.ts`) — `now() - usernameSetAt
  > 7 days`, computed live off the same timestamp `create()` already
  stamps, not a second stored boolean.

`ProfilesService.assertSlugChangeAllowed()` (new, shared by `update()` and
`updateForOrganization()`; `create()`/`createForOrganization()` have no
existing profile to lock against) combines them: the realname-priority
check runs first as always, then — only if the freshly re-derived
verified-name slug still equals `usernameSourceName` — `isUsernameLocked()`
gates the change. A verified name that has actually moved on from
`usernameSourceName` skips the lock check entirely: that mismatch *is*
the "realname changed in govt record" signal, and it unconditionally
permits exactly one more change, which itself re-stamps both
`usernameSetAt` and `usernameSourceName` to start the cycle over. A
within-window edit (still inside the original 7 days) is unaffected by
any of this and simply resets the clock the same way it already did.

**Verified live**: full workspace `typecheck`/`lint`/`test`/`build`
clean, including a fresh `prisma migrate deploy` applying the new
`usernameSourceName` column against local Postgres. Four new live-Postgres
tests in `profiles.service.spec.ts`: a rename inside the 7-day window
succeeds; a rename after the window with the verified name unchanged is
rejected (`ForbiddenException`) after backdating `usernameSetAt` 8 days;
a rename past the window succeeds once a second, later `PhoneNameEvidence`
row with a genuinely different name exists (the same append-not-overwrite
signal `verification-method.activity.spec.ts` already proves the
workflow produces), and the resulting profile's `usernameSourceName` /
`usernameSetAt` are updated to match; and a post-unlock rename attempt to
a slug that doesn't match the *new* name is still rejected
(`BadRequestException`) — the unlock grants one legitimate change, not a
blank check. Plus three `isUsernameLocked()` boundary tests in
`username.spec.ts` (immediately after set, just under 7 days, just over).

### Profile privacy: the verified real name, private by default like everything else here

"User can manage what to make public and what to keep private, including
name, just like in LinkedIn — privacy 1st." `displayName` was already the
owner's own free choice, shown unconditionally (it's the page's own
headline text, not evidence of anything) — the actual gap was the
*verified* name behind it: `PhoneNameEvidence`/`Organization.legalName`
back the username and the IDENTITY badge, but nothing surfaced the value
itself anywhere a viewer could see it. Rather than "never", the right
default for a verification product is "opt-in" — a doctor or a business
may well want `Verified as Anna Maria Eriksson` next to a stage or brand
`displayName` for the trust signal, someone else may not want their legal
name anywhere near a public page at all. Same shape as every other
contact-channel field on this table (`showPhone`, `showAddress`, ...):

- **`Profile.showRealName`** (new column, `@default(false)`) — off unless
  the owner turns it on, no exception, matching "privacy 1st" literally
  rather than as a slogan.
- **`ProfilesService.getRealName()`** — resolves the actual name value
  (not the slugified form the username gate uses) the exact same way
  `requireVerifiedRealName()` (personal) / `getVerified().legalName`
  (brand) already do, so a viewer can never see anything the KYC evidence
  doesn't actually say. Only ever queried when `showRealName` is true —
  the default code path never touches `PhoneNameEvidence` at all.
  `PublicProfile.realName` carries the result (or `null`).
- **`apps/profile-ui`**: a "Show verified legal name (private by
  default)" toggle alongside the existing show* checkboxes in
  `ProfileEditor.tsx`; the public `/[slug]` page renders `Verified as
  {realName}` under the display name only when present and only when it
  actually differs from `displayName` (no redundant echo when an owner's
  chosen name already matches their legal one).

**Verified live**: full workspace `typecheck`/`lint`/`test`/`build`
clean, including a `prisma migrate deploy` for the new column. Three new
live-Postgres tests in `profiles.service.spec.ts`: `realName` is `null`
through `getPublicBySlug()` by default despite real `PhoneNameEvidence`
existing; it's exposed once `showRealName: true` is set at creation
(personal); and the organization equivalent exposes `legalName` for an
opted-in brand profile.

### Profile privacy: grant one field to one specific person or organization, by name

"User can show only one specific info to only one person or organization
by his own will." The show*/showRealName flags from the previous slice
are binary and public-wide — on for everyone or off for everyone. This is
the orthogonal, private case: a narrow, revocable exception carved out
for exactly one recipient, without touching the public defaults at all.

- **`ProfileFieldGrant`** (new model) — `{profileId, field, granteeAccountId
  XOR granteeOrganizationId, revokedAt}`. Same "exactly one owner" DB
  `CHECK` constraint Profile's own migration already established, and the
  same "revoked, never deleted" convention as `OrganizationMembership`'s
  `DECLINED` — `revokedAt IS NULL` is what "active" means, derived live,
  and the row itself stays as a real record of who was ever granted what.
  `field` is a `ProfileGrantField` enum — deliberately the same set that
  already has a public `show*` flag (`PHONE`/`WHATSAPP`/`EMAIL`/`ADDRESS`/
  `REAL_NAME`), since a grant is a private exception to that same gate,
  never a new category of data invented on the side.
- **The recipient is named by their own nID username**, not an internal
  id or a phone number — `ProfilesService.createGrant()` resolves
  `granteeSlug` to a Profile and grants to whichever of
  `accountId`/`organizationId` that Profile has. Every grantable person or
  org already has exactly one permanent handle (the username system this
  whole feature started with) — reusing it here rather than inventing a
  second identifier is the whole point of building the two together.
- **`OptionalAccountSessionGuard`** (new, alongside `AccountSessionGuard`)
  — the public `GET /v1/profiles/:slug` route must stay reachable
  anonymously, but now also needs to know who's asking. Same Bearer-token
  resolution, except a missing header or an invalid/expired token is
  never an error here, just "anonymous viewer" — the same outcome as no
  header at all. `getPublicBySlug()` takes the resolved viewer `Account`
  (if any), and `toPublicProjection()` resolves every `Organization` that
  Account currently has ACTIVE membership in
  (`OrganizationsService.listActiveOrganizationIds()`, the same
  `accountId`-scoped shape `requireActiveAdmin()` already uses) so an
  org-targeted grant reaches any of its current members, not just
  whichever admin the slug was originally typed at.
- **Strictly additive, never narrowing**: `toPublicProjection()` computes
  `showPhone || grants.has('PHONE')`, and likewise per field — a grant can
  only widen what's already public, never hide something the owner chose
  to show everyone. An anonymous request never even queries
  `ProfileFieldGrant` at all.
- **Owner-side management**: `POST`/`GET`/`DELETE /v1/profiles/me/grants`
  (personal) and the `:id/profile/grants` equivalents on
  `OrganizationProfilesController` (admin-gated, same
  `requireActiveAdmin()` every other org-profile route already enforces).
  `apps/profile-ui` gets a new "Private shares" tab
  (`GrantsManager.tsx`) — pick a field, type the recipient's username,
  share; revoke from the same list.

**Verified live**: full workspace `typecheck`/`lint`/`test`/`build`
clean, including a `prisma migrate deploy` for the new table. Five new
live-Postgres tests in `profiles.service.spec.ts`: a granted field
reaches exactly the named account and nobody else (not anonymous, not a
random third party) and never widens any other field; revoking hides it
again; granting to your own profile is rejected; granting to a
nonexistent username is rejected; and an organization-targeted grant
reaches a second, non-admin ACTIVE member of that org, not only whichever
admin it was granted through. Beyond the test suite: a full real-HTTP
pass against a live `apps/api` — two real accounts through the actual OTP
endpoints, real profiles created over HTTP, an anonymous `GET` and an
authenticated-but-ungranted `GET` both correctly hiding the phone number,
then `POST .../me/grants` and a `GET` authenticated as the grantee
correctly revealing it, then `DELETE .../me/grants/:id` and a final `GET`
confirming it's hidden again — proving the `OptionalAccountSessionGuard`
wiring and the grant lifecycle work over the real HTTP stack, not just
through direct service calls.

- **Phase 2** — sanctions/PEP screening, one
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
