# Engineering rules — read before writing any code

This file is the software-engineering gate for this repository. It exists
because this codebase handles government ID documents, biometrics, and PII,
and because velocity without structure is exactly how that kind of system
fails quietly. These rules are not suggestions — every one below is a hard
requirement, not a style preference. `docs/HOUSE-RULES.md` remains the
detailed rulebook for tenant isolation and the verification-method pattern;
this file is the broader discipline layer above it and takes precedence
wherever the two could be read as conflicting.

If a request conflicts with a rule below, the rule wins. Say so and propose
the compliant alternative — do not silently comply with a request that
would violate one of these, and do not silently skip a rule to move faster.

## Priority: flexibility, resilience, and innovation — inside a fixed floor

The working priority for every decision in this codebase is flexibility,
resilience, and innovation, ranked above raw feature velocity, above
architectural purity for its own sake, and above "the way it's already
done." That priority operates inside one fixed floor, not instead of it:
sections 3 (security) and 4 (stability) below are not weighed against
flexibility/innovation — they're the boundary flexibility/innovation get
to move freely within. This is the same distinction Amazon calls one-way
vs. two-way doors, and it's the actual mechanism that makes "innovate
aggressively" and "zero tolerance on security" simultaneously true instead
of contradictory:

- **Two-way doors — optimize for flexibility and speed, by default, no
  sign-off needed.** A new provider implementation behind an existing
  interface. A UI redesign. A new internal module boundary. Trying two
  approaches to a hard algorithmic problem (the OCR/liveness/forensics
  packages already do this — synthetic-fixture-driven, swappable, easy to
  rip out) and keeping the one that works. A dependency swap behind an
  interface. Reverting any of the above costs one PR. Move fast here,
  prototype, experiment, take the more innovative option even when it's
  less proven — reversibility is the safety net.
- **One-way doors — the section 3/4 floor still applies without
  exception.** A schema change to a table holding PII/KYC/biometric data.
  Anything that crosses a trust boundary (cross-tenant, cross-account, a
  new grant primitive, a new no-RLS table). Deleting or irreversibly
  transforming data. Removing an auth check. Changing what a shipped
  contract means to an existing caller. These are expensive or impossible
  to revert once real data or a real integration depends on them, which is
  exactly why "move fast" doesn't apply to them — not because innovation
  is unwelcome here, but because the cost of being wrong is measured in
  leaked government ID data, not in a reverted PR.
- **Telling the two apart is itself a required step, not a judgment call
  to skip.** Before starting a change, name which kind of door it is. If
  it's arguably both (a new feature that's flexible in its UI but touches
  a PII table), the PII-table part is a one-way door and gates the whole
  change, even if the rest is free to iterate on.

## 0. What "no compromise" means here, concretely

Every rule below is enforced the same way: it either has a mechanical gate
(a lint rule, a migration convention, a test, a required review step) or it
doesn't ship. "We'll harden it later" is not a plan — the OTP brute-force
gap this codebase shipped with (no rate limit on a 6-digit code, closed
2026-09-19) is the concrete lesson: it existed because "add a login flow"
and "make the login flow resistant to brute force" were treated as two
separate, separable tasks. They are not. A feature that touches auth, PII,
or a trust boundary is not done until the hardening in section 3 is done.

## 1. Architecture — every module has one clear shape

- **A capability with more than one real-world implementation is a
  provider behind an interface and a config allowlist, never an `if` on a
  type/name.** This is `docs/HOUSE-RULES.md` rule 1
  (`VerificationMethodProvider`), and it is not scoped to verification
  methods — the same shape applies to storage drivers (`StorageDriver`),
  and applies to every future integration point: notification channels,
  payment processors, a new OCR/liveness/forensics vendor swapped in
  later. If you're about to write `if (kind === 'x') { ... } else if
  (kind === 'y')` for something that will ever have a third case, it's a
  provider, not a branch.
- **Controllers are thin.** A controller's job is: parse/validate the
  request (DTO + `class-validator`), resolve the actor (guard), and
  delegate to a service. No business logic, no direct Prisma calls, no
  cross-module data access in a controller.
- **A module reaches another module's data through that module's own
  service, not by importing its Prisma model directly.** If `ModuleA`
  needs something only `ModuleB` computes, `ModuleB` exports a service
  method for it — don't duplicate the query or reach around the
  abstraction.
- **New tables get RLS in the same migration that creates them** —
  `docs/HOUSE-RULES.md` rule 2, restated because it's the single most
  consequential architectural rule in this codebase. A tenant-owned table
  with no RLS policy is a data breach waiting on a missing `WHERE`
  clause. If a table is a deliberate exception (no `tenantId` at all,
  like `Account`/`Profile`/`ProfileFieldGrant`), that exception is written
  down in the schema comment at the point it's created, not discovered
  later by an auditor.
- **A contract, once a client depends on it, changes by addition, not
  breaking mutation.** DTOs, Temporal workflow input/output shapes, HTTP
  response bodies: add optional fields, don't repurpose or remove
  existing ones without a documented migration path for every caller.

## 2. Scalability — designed for it, not prematurely built for it

- **Services are stateless at the process level.** No module-level
  in-memory `Map`/cache used as shared state across requests unless it's
  explicitly scoped and commented as "this is fine to lose/diverge per
  process" (e.g. a per-process warm cache that's safe to be cold). Real
  shared state lives in Postgres. This is what makes "add a load
  balancer" a config change later instead of a rewrite — see section 5.
- **Long-running or multi-step work is a Temporal workflow, never a cron
  job, an in-memory queue, or a poller against a status column** —
  `docs/HOUSE-RULES.md` rule 5.
- **Heavy computation (OCR, forensic image analysis, face matching,
  anything CPU- or IO-heavy) runs off the request thread**, via a
  Temporal activity, the same way every verification method already
  does. A new expensive operation does not get bolted onto a synchronous
  HTTP handler because it's convenient during development.
- **Any list endpoint over a table that grows with usage is paginated
  from the day it ships** — not retrofitted once someone's `findMany()`
  times out in production.
- **We do not stand up literal infrastructure (API gateway, load
  balancer, dedicated metrics/tracing stack) ahead of a concrete trigger
  that needs it.** This repo is a modular monolith (one NestJS API, a
  handful of Next.js frontends) — building for a fleet of microservices
  it doesn't have yet is its own failure mode, the mirror image of the
  left half of the picture you sent. The trigger for each: a load
  balancer when there's a second API replica to balance across; a gateway
  when there's more than one backend service needing shared auth/routing.
  Until then, the discipline above (stateless services, provider
  abstractions, clean module boundaries) is what makes adding them later
  a deployment change, not a redesign.

## 3. Security by design — the part with zero tolerance

- **Every auth-sensitive endpoint ships with brute-force protection and a
  revocation path on day one.** Concretely: any code path that checks a
  secret (OTP, password, token) against user input needs an attempt
  limit/lockout before it merges, not after a review catches it. Any code
  path that issues a long-lived credential (a session token) needs a way
  to revoke it before it merges. This is not optional hardening — it's
  part of "the login flow," not a separate ticket.
- **A no-RLS / cross-tenant table's authorization is re-derived live at
  read time, never cached or denormalized in a way that can go stale.**
  If a feature grants access to a set of principals (an org's members, a
  role), that set needs a real offboarding/removal path *before* the
  grant feature ships, not after someone notices ex-members never lose
  access. A permission that can only grow is a bug, not a simplification.
- **Any new identity-binding primitive (phone number, email, external
  ID) used to resolve "who is this" must account for that binding being
  reassigned/recycled by whatever issues it**, before it ships as the
  sole binding for an account.
- **Any change that crosses a trust boundary — cross-tenant, cross-
  account, a new auth flow, a new grant/permission primitive, a new
  no-RLS table — gets a security-review pass (the `security-review`
  skill) before merge, not sometime after launch.** This is the direct,
  standing fix for this codebase having shipped an entire build's worth
  of cross-tenant/no-RLS features before running that review once.
  "We'll review it later" is exactly the gap that produced the OTP
  finding — later is not a gate, it's the absence of one.
- **Inbound webhook/callback verification is constant-time; outbound
  webhooks are HMAC-signed** — `docs/HOUSE-RULES.md` rule 4, unchanged.
- **Secrets never hardcoded, never logged, always read from env behind
  `core/config`** — `docs/HOUSE-RULES.md` rule 6, unchanged. A client-
  submitted score/result is never trusted; every decision is computed
  server-side from the provider's raw response.
- **Every read of Subject/Organization/Attempt/DocumentAsset PII is
  audited, not just writes** — `docs/HOUSE-RULES.md` rule 3, unchanged.

## 4. Stability & reliability

- **The existing definition of done is the hard gate, not a suggestion**
  (`docs/HOUSE-RULES.md` rule 8):
  ```
  pnpm typecheck
  pnpm lint
  pnpm test
  pnpm db:validate
  ```
  A change that doesn't pass all four isn't done, regardless of how
  urgent it feels.
- **A schema migration is verified against a real, running Postgres
  before it's considered shipped** — not just `prisma validate`. Apply
  it, run the affected service's live-DB test suite against it. This
  repo already has the pattern (`RUN_DB_TESTS=true`, the non-Docker
  `apt-get postgresql` workaround documented in `README.md` for sandboxed
  environments) — use it every time, don't skip it because the change
  "looks small."
- **A feature's core state transition is proven against something real**
  — real Postgres, a real HTTP request, a real browser (Playwright) for
  anything user-facing — not only a mocked unit test. This is this
  repo's own established "verified live" standard; keep holding it to
  that bar rather than letting it quietly slide to "typecheck passed."
- **No empty catch blocks, no silently swallowed errors.** If an error is
  genuinely safe to ignore, say why in a comment; otherwise it's logged
  or rethrown.

## 5. Flexibility, resilience, and innovation — the primary lens

This section is not "nice engineering hygiene" — per the priority
statement above, it's the default orientation for how work gets done here,
constrained only by sections 3 and 4.

**Flexibility**
- **Prefer boring, swappable primitives over hardwiring a vendor or a
  specific implementation.** The verification-provider pattern and
  `StorageDriver` are the existing examples — every future integration
  point (a real SMS vendor, S3-compatible storage, a payments processor,
  a different OCR/liveness/forensics vendor) is added the same way: an
  interface, a config-driven allowlist, dev-mode mock alongside the real
  implementation. This is what turns "we chose wrong" into a config
  change instead of a migration project.
- **Extensibility is designed in; the extension itself is built when
  something concretely needs it, not speculatively.** The shape that
  makes a future addition cheap (clean module boundaries, provider
  interfaces, stateless services, additive contracts) is mandatory now;
  the addition itself (an actual load balancer, an actual second vendor
  integration) waits for its actual trigger — see section 2.
- **Default to the reversible option when two designs solve the same
  problem equally well.** Between an interface-behind-a-flag and a
  hardcoded choice that's marginally simpler today, take the flag. The
  marginal cost is small; the option value compounds.

**Resilience**
- **A build-vs-buy call, once made, is revisited explicitly, by name, not
  silently reversed inside an unrelated commit.** If a "buy" decision
  gets reversed to "build" (or vice versa), the commit/PR says so
  directly — what changed, why, and what the tradeoff is now — instead of
  the reversal being discoverable only by reading between two unrelated
  paragraphs in `docs/PHASES.md`.
- **A dependency or vendor this system leans on gets a documented fallback
  or exit path before it becomes load-bearing**, proportional to how hard
  it'd be to leave: a free/self-hosted library (Tesseract, face-api) needs
  none; a paid vendor behind a provider interface already has its exit
  path (swap the provider); a vendor NOT yet behind an interface is itself
  a flag this codebase is in a one-way-door-shaped spot and should be
  fixed opportunistically, not left as accepted debt.
- **Failure inside one provider/module degrades that capability, not the
  system.** A `NEEDS_REVIEW` outcome instead of a crash, a single method
  failing in a multi-method `VerificationPolicy` without failing case
  creation itself, a vendor outage returning `verified: false` rather than
  taking down the request — this codebase's existing honesty discipline
  (never fabricate PASSED/FAILED) is also a resilience property: a
  system that fails to an honest "unknown" is one that survives a
  dependency going bad.

**Innovation**
- **New algorithmic/ML-adjacent approaches are welcome and expected to be
  tried, inside a two-way door.** `packages/ocr-engine`,
  `liveness-engine`, and `forensics-engine` are the precedent: real,
  independently swappable implementations, each provable against real
  fixtures, none requiring the others to change. The bar for trying a new
  technique is "can I prove it against something real and rip it out
  cleanly if it doesn't work" — not "is this the safe, obvious choice."
- **A prototype/spike is explicitly allowed to skip the full section-4
  bar temporarily, but is labeled as a prototype and never reaches
  production data un-hardened.** Move fast to learn whether an idea
  works; don't quietly let the fast version become the shipped version
  once it touches a real Subject/Account/PII table — that's where it
  becomes a one-way door and section 3/4 close back in.
- **A "we've always done it this way" objection is not, on its own, a
  reason to keep doing it that way.** It's a reason to ask what the
  original constraint was and whether it still holds — see the
  build-vs-buy point above for the concrete version of this.

## 6. Where this file and `docs/HOUSE-RULES.md` overlap

`docs/HOUSE-RULES.md` is authoritative on the specifics it already covers
(RLS/tenant isolation, the provider pattern, audit logging, webhook
verification, the `apps/api` tsc/esbuild constraint, the definition-of-done
commands). This file does not restate those in full — read both before
adding a module. Where this file adds a rule `docs/HOUSE-RULES.md` doesn't
have yet (sections 3's auth-hardening-on-day-one and live-permission-
re-derivation rules, in particular), treat it as equally binding, not as a
lesser or aspirational layer.
