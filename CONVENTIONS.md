# NEWAX Ecosystem — Repo Structure & Naming Conventions

> Applies to every repo in the ecosystem (nID, Communicator, core-newax,
> erp-1, newcom, harvester, AegisDesk), same as `ECOSYSTEM.md`. This is
> the one rulebook for folder layout, naming, renaming, branching,
> worktrees, commits, and merges — not a per-repo variant. If a repo's
> current layout doesn't match yet, see **Known gaps** at the bottom
> instead of inventing a local exception.

## 1. Top-level folder layout (target shape for every repo)

```
<repo>/
  apps/                 # one dir per deployable client surface
    web/                 # browser app (Svelte UI + Rust-core-as-WASM)
    ios/                 # SwiftUI shell
    android/             # Jetpack Compose shell
    windows/             # WinUI 3 (or slint) shell
    <product-app>/       # extra first-class web apps get their own dir,
                          # named for what they do, not their tech
                          # (apps/dashboard, apps/login, not apps/next-app-2)
  services/             # one dir per backend binary (Rust, one per module)
    <module>/
  crates/               # shared Rust libraries
    core/                # shared business-logic core, compiled native + WASM
    proto/               # Rust types generated from proto/
    <module>/            # one crate per bounded module's library code
  packages/             # shared non-Rust libraries (JS/TS/CSS)
    design-tokens/
    shared-types/
    ui-kit/ (if/when one exists)
  proto/                 # .proto schema source of truth, versioned
    <module>/v1/<module>.proto
  migrations/            # SQL migrations, namespaced per module
  docs/
  scripts/               # repo-local automation: build, migrate, release
  infra/                 # Dockerfiles, CI config, deploy manifests
  .github/
  CLAUDE.md
  AGENT.md
  ECOSYSTEM.md
  CONVENTIONS.md          # this file
```

A repo that only ships a backend (no client) omits `apps/`. A repo that
only ships one client surface still uses `apps/<name>/`, not a bare
`frontend/` — the directory name should say what the app *is*
(`apps/dashboard`), not that it's "the frontend."

**JS/TS package manager: pnpm, no exception.** Every repo's `apps/*`
and `packages/*` install through pnpm workspaces
(`pnpm-workspace.yaml` at the repo root, `workspace:*` for internal
deps) — never npm or yarn. One lockfile at the repo root
(`pnpm-lock.yaml`), never a per-app lockfile. See the ecosystem tech
stack plan's "Package manager" section in `CLAUDE.md`/`AGENT.md` for
why.

## 2. Module naming — one name, five places

Every bounded module (the same boundary `ECOSYSTEM.md`'s ownership
table draws — e.g. `conversations`, `broadcasts`, `secrets-vault`,
`sessions`) gets **one canonical kebab-case name**, spelled identically
everywhere it appears:

1. Crate name suffix — `newax-<module>` (e.g. `newax-conversations`)
2. Proto package — `newax.<module>.v1`
3. DB schema / migration namespace — `<module>`
4. Event-bus topic prefix — `<module>.<event-name>`
5. Folder name — `services/<module>/`, `crates/<module>/`,
   `proto/<module>/`

Register the name in `core-newax/registry/module-registry.json` before
using it anywhere else. If you're renaming an existing module, update
all five in the same PR — never leave the name half-migrated.

## 3. Backend separation

- **One Rust crate = one bounded module.** No crate owns two modules'
  worth of logic; no module's logic is split across two crates without
  a specific reason (e.g. a WASM-safe subset vs. a server-only
  superset — name the split explicitly if so: `newax-<module>-core` /
  `newax-<module>-server`).
- **One service = one deployable binary**, in `services/<module>/`,
  depending on its `crates/<module>/` library crate. A module that
  doesn't need its own deployable yet still gets its library crate
  under `crates/`, with the service added only when it's actually
  deployed separately.
- **No direct cross-module DB access or direct repo-to-repo HTTP
  calls** — this restates `ECOSYSTEM.md`'s one rule, structurally: if
  two modules need each other's data, that's a Module Gateway call or
  an event, never a shared table or a raw `reqwest` call into another
  module's crate.

## 4. Frontend separation

- **One platform = one `apps/<platform>` directory**, each a thin
  shell over the shared `crates/core` (native via UniFFI, web via
  `wasm-bindgen`). Platform shells never contain business logic beyond
  view state and navigation — if you're about to write a retry policy
  or a caching rule inside `apps/ios`, it belongs in `crates/core`
  instead.
- **Multiple web apps in one repo** (nID's `dashboard`, `login-ui`,
  `profile-ui`, `verify-ui` pattern) each get their own `apps/<name>/`,
  named for the surface they present to a user, never for a port
  number or a framework detail.
- **Generated bindings are never hand-edited and never the canonical
  source** — UniFFI/wasm-bindgen output lives in a gitignored
  `Generated/`-style subfolder inside the consuming app, regenerated
  from `crates/core` on build.

## 5. File naming

| Kind | Convention | Example |
|---|---|---|
| Rust module files | `snake_case.rs`, one file per non-trivial type | `broadcast_scheduler.rs` |
| Rust module roots | `mod.rs` / `lib.rs` only as the root, never a dumping ground | — |
| React components | `PascalCase.tsx` | `MessageThread.tsx` |
| React hooks | `camelCase.ts`, prefixed `use` | `useMessageThread.ts` |
| Other TS/JS modules | `kebab-case.ts` | `api-client.ts` |
| Tests | colocated, `*.test.ts(x)` / `*_test.rs` | `broadcast_scheduler_test.rs` |
| CSS | `kebab-case.css`, one global tokens import per app, no second source of truth | `globals.css` |
| Proto | `snake_case.proto`, one file per service, path `proto/<module>/v1/` | `proto/conversations/v1/conversations.proto` |
| SQL migrations | `<timestamp>_<verb>_<snake_case_description>.sql`, never edited after merge | `20261114193000_add_broadcast_schedule.sql` |
| Scripts | `kebab-case.sh`/`.ps1`, verb-first | `run-migrations.ps1`, not `migrations.ps1` |
| Env vars | `UPPER_SNAKE_CASE`, namespaced by module | `CONVERSATIONS_DATABASE_URL` |

No `utils.rs`, `helpers.ts`, or `misc.*` grab-bags past ~150 lines —
split by what the code actually does.

## 6. Renaming policy

A rename is a tracked decision, not a drive-by edit:

- Update the canonical name in all five places from §2 in the same PR.
- Update `core-newax/registry/module-registry.json`.
- If the rename crosses an ownership boundary (moves what a module is
  responsible for, not just what it's called), add one line to the
  relevant repo's `ECOSYSTEM.md` "Known misplacements" section.
- This is still raw-prototype phase (per each repo's own `CLAUDE.md`):
  skip deprecation shims/aliases for an internal rename. Only keep a
  compatibility alias when the rename crosses a boundary another team
  or client already depends on today (e.g. a published proto field).

## 7. Branches

Pattern: `<type>/<module>/<short-kebab-description>`

- `type` ∈ `feat`, `fix`, `chore`, `refactor`, `docs`
- `module` is the canonical name from §2, or `ecosystem` for a
  cross-module change (like the design-tokens rollout)
- Example: `feat/conversations/broadcast-scheduling`,
  `fix/secrets-vault/token-rotation`

Exception: a branch assigned by the CCR tooling for this session
(`ccr-...`) keeps its assigned name — don't rename it to fit this
pattern.

No long-lived branches (`develop`, `staging-main`, etc.) — this
ecosystem is modular-monolith-first (`core-newax` ADR 0001); branches
are short-lived and merge back to `main`.

## 8. Worktrees

One `git worktree` per module under active parallel work, named to
match its branch:

```
../worktrees/<repo>-<module>-<short-desc>
```

Branch first, then add the worktree for that branch — never worktree
directly off `main` for a throwaway experiment. Remove the worktree
when its branch merges or is abandoned; don't let stale worktrees
accumulate.

## 9. Commits

[Conventional Commits](https://www.conventionalcommits.org/), scoped by
module:

```
<type>(<module>): <imperative summary>

<body explaining why, not what — the diff already shows what>
```

Example: `feat(conversations): add broadcast scheduling`. Multi-module
commits (design-tokens-style rollouts) use `ecosystem` as the scope.

## 10. Pull requests & merging

- PR title mirrors the primary commit's conventional-commit line.
- One module per PR where practical; a cross-module PR is justified
  only for genuinely cross-cutting changes.
- Draft until ready for review (standing rule, not new here).
- **Squash merge to `main`** — one commit per shipped change in
  `main`'s history, scoped and readable without opening the PR.

## Resolved (2026-11-14 audit)

- **Communicator**: `backend-rs/` staying one crate is **not a gap** —
  it's correct per the modular-monolith-first ADR; it only needs to
  split, and drop the generic `backend-rs` name, once a module
  actually needs its own deployable. Root-level `cargo_check*.log`
  files and one-off, hardcoded-local-path migration-fix `.ps1`
  scripts were deleted outright (debug cruft, not reusable tooling).
  The two genuinely reusable `.ps1` scripts and the launcher `.bat`
  files moved to `scripts/`, with their hardcoded
  `C:\Users\...\Downloads\...` and sibling-repo (AegisDesk) paths
  removed. `erp-schema/` (plus its exact duplicate under
  `backend-rs/erp-schema/`) moved to `docs/schema-reference/` with a
  README making explicit it's modeling notation only, never a live
  Prisma client. `src/communicator-archive/` and `python-archive/`
  moved under a top-level `archive/`. `shopify-otp-widget/` and
  `store-otp-widget/` are **live**, not archived (referenced from
  `backend-rs/src/services/store_connection.rs` and
  `docs/SHOPIFY_STORE_OTP_SETUP.md`) — promoted to their own
  `apps/shopify-otp-widget/` and `apps/store-otp-widget/` (each is an
  independently deployed client surface embedded on third-party
  sites, exactly what `apps/*` is for), out from under `apps/web/`.

## Module separation is mandatory for all new work (strict rule, 2026-11-15)

This is no longer "the plan" or "the target shape" — it's a standing
rule, binding on every future change in every NEWAX repo, the same
way §1–10 above are:

1. **New backend capability = new crate + new service, from the
   first line of code.** Nothing new gets added to `backend-rs`'s or
   `apps/rust-api`'s top-level `src/routes`/`src/services`/`src/modules`
   as a shortcut "for now." Scaffold `crates/<module>/` (business
   logic) and `services/<module>/` (the `tonic` binary) per §2's
   one-name rule before writing the first handler. The ~87 modules
   still inside the two monoliths are a migration backlog, not a
   template to keep copying.
2. **Module-to-module calls are always `tonic` + Protobuf, never a
   direct function call across a module boundary once the callee has
   its own crate.** This holds whether the caller is in the same repo
   or a different one. See `COMMUNICATION.md`'s "two distinct roles"
   section — this is Role 1, and it is not optional infrastructure to
   bolt on later. A module still living in the monolith may call
   another in-monolith module directly (that's the modular-monolith
   ADR, unchanged); the moment either side has its own service, the
   call is gRPC, full stop.
3. **The edge gateway is Pingora** (Cloudflare's Rust proxy
   framework), not Envoy, not a hand-rolled reverse proxy — see
   `COMMUNICATION.md`'s Role 2. It terminates TLS, load-balances, and
   routes incoming gRPC streams to the right backend service. Envoy
   is a deliberate, requested exception for a specific gap, never a
   default.
4. **Every `.proto` contract is reviewed like a public API**, because
   it is one the moment a second caller exists — a breaking field
   change needs the same care as a breaking REST response shape
   change, more so once another repo depends on it.
5. **No new interim shortcuts without flagging them the way the
   current one is flagged.** The direct-`127.0.0.1:<port>`-dial used
   by the three pilot services (see below) is an explicitly named,
   explicitly temporary stand-in for Pingora — written down as such
   in `COMMUNICATION.md`, not left for someone to mistake for the
   real thing. Any future shortcut gets the same treatment: named,
   dated, and tied to what it's standing in for.

## crates/services split: in progress, tracked here (2026-11-15)

**See `MODULE_SPLIT_PLAYBOOK.md` for the full step-by-step procedure**
(required reading list, folder layout, naming, proto/crate/service
file contents, how to rewrite the monolith side, verification, commit
discipline, and a final checklist) — this section is just the live
tracking table and status summary, not the how-to.

The pattern in §3 is now proven working, not just specified —
thirty real modules split so far, each a standalone `tonic` gRPC
service
with its old monolith route handlers reduced to a thin client, each
verified with `cargo check --workspace`:

| Module | Repo | Crate | Service | Port |
|---|---|---|---|---|
| kb-documents | Communicator | `crates/kb-documents` | `services/kb-documents` | 50061 |
| system-health | Communicator | `crates/system-health` | `services/system-health` | 50062 |
| embed-widget | Communicator | `crates/embed-widget` | `services/embed-widget` | 50063 |
| help-center | Communicator | `crates/help-center` | `services/help-center` | 50064 |
| scheduled-tasks | Communicator | `crates/scheduled-tasks` | `services/scheduled-tasks` | 50065 |
| monitoring | Communicator | `crates/monitoring` | `services/monitoring` | 50066 |
| conversation-search | Communicator | `crates/conversation_search` | `services/conversation_search` | 50067 |
| reply-integration | Communicator | `crates/reply_integration` | `services/reply_integration` | 50068 |
| cx-qa-scoring | Communicator | `crates/cx_qa_scoring` | `services/cx_qa_scoring` | 50069 |
| tone-of-voice | Communicator | `crates/tone_of_voice` | `services/tone_of_voice` | 50070 |
| permissions | nID | `crates/permissions` | `services/permissions` | 50071 |
| tenant-staff | nID | `crates/tenant-staff` | `services/tenant-staff` | 50072 |
| departments | nID | `crates/departments` | `services/departments` | 50073 |
| ab-testing | Communicator | `crates/ab_testing` | `services/ab_testing` | 50074 |
| account-verification | nID | `crates/account_verification` | `services/account_verification` | 50075 |
| compliance-dashboard | Communicator | `crates/compliance_dashboard` | `services/compliance_dashboard` | 50076 |
| subjects | nID | `crates/subjects` | `services/subjects` | 50077 |
| unified-analytics | Communicator | `crates/unified_analytics` | `services/unified_analytics` | 50078 |
| invitations | nID | `crates/invitations` | `services/invitations` | 50079 |
| oauth | nID | `crates/oauth` | `services/oauth` | 50080 |
| accounts | nID | `crates/accounts` | `services/accounts` | 50081 |
| roles | nID | `crates/roles` | `services/roles` | 50082 |
| booking | nID | `crates/booking` | `services/booking` | 50083 |
| organization-profiles | nID | `crates/organization_profiles` | `services/organization_profiles` | 50084 |
| verification-cases | nID | `crates/verification_cases` | `services/verification_cases` | 50085 |
| access | nID | `crates/access` | `services/access` | 50086 |
| organizations | nID | `crates/organizations` | `services/organizations` | 50087 |
| sessions | nID | `crates/sessions` | `services/sessions` | 50088 |
| tenants | nID | `crates/tenants` | `services/tenants` | 50089 |
| profile-content | nID | `crates/profile_content` | `services/profile_content` | 50090 |

`reply-integration` is the one case so far where a split module had
genuine in-process coupling from elsewhere in the monolith
(`backend-rs/src/services/reply_engine.rs` called
`ReplyIntegrationService` directly, not through a route): resolved by
having `reply_engine.rs` depend on the new `newax-reply-integration`
crate directly as a library, not by routing an internal monolith call
through gRPC.

Remaining: **~56 more modules in Communicator's `backend-rs`**
(70 routes/90 services, 142k lines total) and **~3 more in nID's
`apps/rust-api`** (brands, profiles, badges). This is not a mechanical find-and-replace — each
module needs its cross-module Rust calls identified and either kept
in-process (if it stays in the monolith) or turned into a gRPC call
(if both sides split). Low-coupling modules (zero
`crate::services::`/`crate::modules::` cross-references, confirmed by
grep before converting) go fastest; most of nID's remaining modules
(sessions, tenants, organizations, oauth, etc.) call each other
directly today and need that coupling mapped out before they can
split safely. Convert and verify one module at a time, commit each
once `cargo check --workspace` is clean — never a batch no one
checked compiles.

**Not every module is a split candidate.** nID's
`apps/rust-api/src/modules/badges` is a pure shared library (badge-
ranking helpers + `CrossTenantBadgesService`) used in-process by
`profiles/service.rs`, with no routes/handlers of its own. Converting
it to a standalone gRPC service would be wrong — it belongs inlined,
not behind a network call. Skip modules like this; look for the
dto/handlers/routes/service shape (or Communicator's routes+services
pair) before starting one.

**Known shortcut, flagged, not to copy into cross-repo code:** split
services are currently dialed by a hardcoded `127.0.0.1:<port>` URL
(env-overridable), no mTLS, no service discovery — a stand-in for the
real `core-newax` Module Gateway from `COMMUNICATION.md`, acceptable
*within* one repo for now, never a substitute for the gateway once
nID and Communicator actually need to call each other.

## Decided, migration tracked (partially executed)

- **nID**: `apps/api` (TypeScript/NestJS + Prisma) and `apps/rust-api`
  (Rust/SQLx) are not an open question anymore — **`apps/rust-api` is
  canonical, `apps/api` is deprecated** (see `apps/api/README.md`).
  They share one `API_PORT` and one client contract
  (`NEXT_PUBLIC_NID_API_URL`), which is exactly why `apps/rust-api`'s
  module-by-module auth audit could port `apps/api`'s modules one for
  one. Removing `apps/api` for real needs: (1) file-by-file route
  parity confirmed, not just the shared-contract inference above, and
  (2) `apps/workflows`, `packages/verification-providers`, and
  `packages/billing` ported off `packages/db`'s Prisma client onto
  SQLx. That second part touches live identity-verification workflows
  — a real migration with its own testing needs, not a naming-audit
  side effect. Until it's done, don't build new features on
  `apps/api`.

  **2026-11-15: schema ownership cut over for `apps/rust-api`.**
  `crates/db-schema` now holds SQLx-native migrations and
  `apps/rust-api` applies them at boot (`DATABASE_URL`, the
  DDL-owning role — never `APP_DATABASE_URL`), instead of depending on
  `prisma migrate deploy`. The baseline migration
  (`20261115000000_baseline_from_prisma.sql`) is a `pg_dump
  --schema-only` snapshot of the schema Prisma's migrations had
  already built — a tool cutover, not a schema change. `packages/db/
  prisma` stays in the repo and must still be updated in lockstep for
  any schema change, because `apps/workflows`,
  `packages/verification-providers`, and `packages/billing` still
  read/write this same database through the Prisma client directly.
  Porting those three off Prisma (onto their own Rust services,
  consistent with how every other nID module has been split — see
  `MODULE_SPLIT_PLAYBOOK.md`) is the remaining, much larger piece;
  it is not started. Going forward: write new schema changes as a
  `crates/db-schema/migrations/*.sql` file first, then hand-port the
  same DDL into a new Prisma migration for those three services —
  don't let the two schemas drift.
- `crates/` currently holds only 3 Rust library crates (`billing`,
  `shared-types`, `storage`); the verification engines
  (`forensics-engine`, `liveness-engine`, `ocr-engine`,
  `verification-providers`, `workflow-contracts`) are confirmed
  TypeScript (jest + tsconfig in each), correctly under `packages/` by
  language — but they read as engines/services, not shared libraries,
  so confirm whether any should move to `apps/` or `services/` once
  nID's backend is actually split by module rather than staying
  lumped into `apps/api` + `apps/rust-api`. Blocked on the same
  migration above, not a separate decision.

## Design anti-patterns — strictly forbidden, no exceptions (2026-11-15)

These are banned in every UI surface across the ecosystem — marketing
pages, product screens, dashboards, emails, docs sites, everything —
in both repos, with no exceptions and no "just this once." They are
listed because they are the default output of generic AI-assisted
design, not because any one of them is independently catastrophic;
the rule is strict precisely so nothing in this ecosystem reads as
generic AI-assisted design. If a design calls for one of these,
redesign instead of asking for an exception.

Most items below name a visual/copy cliché to never use. A few
(marked explicitly) are the inverse — a thing that must never be
missing.

1. **No harsh gradients.** No loud, high-contrast, multi-stop
   gradients as backgrounds or fills. `tokens.css` defines no gradient
   tokens for a reason — if a surface needs visual interest, use the
   palette's flat semantic colors or `--elevation-*`, not a gradient.
2. **No Lucide icons.** Do not pull in `lucide-react` or any Lucide
   icon set. If this ecosystem adopts an icon set, it will be a
   deliberate, documented decision here — not a default import.
3. **No pure white (`#ffffff`) background fields.** The canvas is
   `--color-page` (warm cream, `#faf9f6`), never `#fff`. `#ffffff` is
   reserved for `--color-surface` (cards/panels sitting on the cream
   canvas) and the explicitly-named fixed surfaces in `tokens.css`
   (`--color-qr-backing`, etc.) — never the page background itself.
4. **No rainbow coloring.** Do not cycle through the full chart/accent
   palette decoratively (e.g. a row of icons each in a different
   chart color for no semantic reason). Color carries meaning in this
   design system or it isn't used.
5. **No drop shadows.** Flat, flush surfaces only — `--elevation-*`
   tokens exist for the few places real elevation is earned (modals,
   overlays), not for routine cards/buttons/images. If you reach for
   a shadow to make something "pop," that's the tell to stop and use
   a border or background-color change from `tokens.css` instead.
6. **No "3 feature cards in a row."** The generic three-equal-column
   icon+heading+paragraph feature grid is banned as a layout
   primitive. If three things need explaining, explain them in a
   layout that reflects their actual relationship (sequence, hierarchy,
   comparison), not a default grid.
7. **No emojis.** Not in UI copy, not in product text, not in commit
   messages or PR descriptions (see `CONVENTIONS.md` §9/§10 and this
   repo's own emoji policy in the system-level instructions) — this
   rule just makes it explicit for design surfaces too.
8. **No "liquid glass" / glassmorphism effects.** `tokens.css` does
   define `--color-surface-glass*`/`--color-border-glass` tokens for
   the few places a translucent overlay is load-bearing (e.g. a sticky
   header over scrolled content) — that is not a license to add
   frosted-glass blur panels decoratively. Default to opaque surfaces;
   treat the glass tokens as the exception, not the starting point.
9. **No em dashes.** In UI copy or documentation prose written for
   this ecosystem, use a period, comma, or parenthetical instead of
   "—". (This file and the other ecosystem docs predate this rule and
   use em dashes throughout; it applies going forward, not
   retroactively — see the "Renaming policy" style precedent in §6 for
   how this repo treats rules like this.)
10. **No Inter, Geist, or Space Grotesk.** These three typefaces are
    the default of every generic AI-generated interface and are
    banned specifically, by name, regardless of how the rest of the
    design looks. **`tokens.css`'s current `--font-sans` is `'Inter'`
    — that is now a known, flagged violation of this rule, not an
    exception to it.** Replacing it is a deliberate font-choice
    decision for whoever owns the design system next, not something to
    silently swap the next time any file touches `tokens.css`.
11. **No colored left stripe.** No card/row/alert pattern that signals
    category or status with a thin colored bar down the left edge.
    Use the semantic background/border/icon tokens instead.
12. **No fake testimonials.** Never fabricate a customer quote,
    reviewer name, star rating, or logo wall. If there is no real
    testimonial yet, the section doesn't ship yet — it does not ship
    with placeholder content standing in for real content.
13. **No bento grids.** No asymmetric-tile "bento box" dashboard/
    marketing layout. Pick a layout driven by the actual content's
    size and importance, not a trendy grid shape.
14. **No terminal window mockups.** No decorative fake terminal/code
    editor chrome used as a visual prop (window chrome, blinking
    cursor, syntax-highlighted fake command output) unless the product
    itself is literally a terminal.
15. **No "it's not X, it's Y" copywriting.** Banned as a sentence
    structure in any marketing or product copy, regardless of what
    fills in X and Y.
16. **No checkmark bullet lists.** No ✓/✔ icon used as a generic list
    marker for feature lists. If a list needs bullets, use a plain
    bullet or no marker at all; reserve a checkmark for an actual
    completed/passed state.
17. **No "3 pricing tiers."** The generic Basic/Pro/Enterprise
    three-column pricing table is banned as a layout primitive, same
    reasoning as item 6. Price the actual plan structure that exists,
    in whatever layout that structure actually needs.
18. **Never ship without real product demos.** (Inverse rule.) A
    marketing or landing surface must show the actual product —
    real screenshots, a real recorded walkthrough, a live embed —
    never a stock photo, an abstract illustration, or a mockup standing
    in for the product itself.
19. **No soft/large corner radius.** This design system's shape
    language is sharp and small: `--radius-sm`/`--radius-md` are 4px,
    `--radius-lg` is 8px, `--radius-xl` is 12px. Do not reach for a
    large, soft "friendly SaaS" radius (16px+, or anything approaching
    a pill on a non-pill element) — `tokens.css` already encodes the
    correct scale; use it as written.
20. **No purple-and-black color scheme.** Do not build a UI (or a
    one-off marketing page, pitch deck, etc.) around a purple+black
    palette — it is the other default of generic AI-generated
    branding. This ecosystem's brand is the cream/off-black/orange
    palette already in `tokens.css`.
21. **Never ship without skeleton loaders.** (Inverse rule.) Any view
    that fetches data before it can render must show a skeleton
    placeholder matching the eventual layout while loading — never a
    bare spinner, a blank screen, or a layout-shifting pop-in once data
    arrives.
22. **No radial gradient "orbs."** No soft, blurred, radial-gradient
    color blobs used as decorative background elements (the
    "AI startup hero background" cliché).
23. **No dot grids.** No dotted-grid decorative background pattern.
24. **No sparkle icons.** No ✨/sparkle/magic-wand icon used to signify
    "AI" or "new" or "magic." If a feature is AI-powered, say so in
    words; don't reach for the sparkle glyph as a shorthand.
25. **No animated arrows.** No decorative arrow that bounces, slides,
    or pulses to draw attention (e.g. a "scroll down" chevron
    animation, an animated arrow pointing at a CTA).
26. **Never ship without Terms of Service.** (Inverse rule.) Any
    product surface that creates accounts, takes payment, or stores
    user data must link a real Terms of Service document before it is
    considered shippable — not a placeholder link, not a "coming
    soon."
27. **Never ship without a Privacy Policy.** (Inverse rule.) Same as
    item 26, for the Privacy Policy. Both are a legal and product
    requirement here, not a design nice-to-have — treat a missing one
    as a launch blocker, the same severity as a missing auth check.
28. **No hover animations.** No transform/scale/glow/color-shift
    transition triggered purely by `:hover` as decoration. State
    changes that communicate something real (focus rings, pressed
    states, disabled states) are not "hover animations" in this sense
    and are unaffected by this rule — the ban is on movement/effects
    added just because a cursor is over an element.
29. **No neon colors.** No oversaturated, glowing neon color used
    anywhere in the palette or in one-off accents. `tokens.css`'s
    accent is a saturated orange, but it is a flat brand color, not a
    neon effect — don't push any color toward a neon/glow treatment.
30. **No "basic pastel" colors.** No generic desaturated
    pastel palette (the other common default "safe" AI color scheme)
    substituted in place of this ecosystem's actual palette.
31. **No long onboarding tutorials.** Never teach the product with a
    multi-step walkthrough overlay, a wall of instructional text
    before first use, or a lecture-style onboarding flow the user
    must sit through before touching anything. Teach by doing
    instead: let the user act, and surface small, contextual hints
    tied to the thing they're actually doing right then — a short
    tooltip on the control they just touched, a one-line inline note
    next to the result they just produced, never a separate "Learn
    how this works" screen shown up front. Good products don't have a
    tutorial; they have moments.

These rules bind every future design decision in this ecosystem
regardless of what any other document, generated mockup, or default
framework/library styling would otherwise suggest. When a tool,
template, or dependency's defaults conflict with a rule here (e.g. a
component library that ships drop shadows or Inter by default),
override the default — do not adopt it because it was the path of
least resistance.

## Untangle before you touch anything (strict rule, 2026-11-15)

Before changing a single line in any refactor, cleanup, or
"fix this mess" task:

1. **Find every knot first.** Map the whole tangled area before
   writing any fix: every place logic was copy-pasted instead of
   shared, every hidden link between files (a function in one module
   silently depending on a global, a side effect, or a specific call
   order in another), and every piece of dead code nothing actually
   calls. Do this as its own pass — reading and tracing, not editing
   — before any code changes.
2. **Redesign once, for all the knots found, not once per knot.**
   When several knots trace back to the same root cause (the same
   duplicated logic copied three times, the same hidden coupling
   repeated across call sites), fix the root cause with one
   redesign that resolves all of them together. Do not patch each
   knot in isolation — a string of one-off patches is how the knots
   got there in the first place, and it leaves the next knot's root
   cause untouched.
3. **Comb it again, and again.** After the redesign, re-run the same
   knot-finding pass over the same area from scratch. If it finds
   anything left — a knot the redesign missed, or a new one the
   redesign introduced — resolve it and comb again. Repeat until a
   full pass turns up nothing. One clean pass that still finds
   something is not done.
4. **Prove the app still works.** A redesign that removes every knot
   but changes behavior is a regression, not a fix. After the last
   clean comb, verify the app actually still works end to end for
   the paths that touched the changed area — not just that it
   compiles or that types check — before calling the work finished.
