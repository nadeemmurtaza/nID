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

The pattern in §3 is now proven working, not just specified —
eighteen real modules split so far, each a standalone `tonic` gRPC
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

`reply-integration` is the one case so far where a split module had
genuine in-process coupling from elsewhere in the monolith
(`backend-rs/src/services/reply_engine.rs` called
`ReplyIntegrationService` directly, not through a route): resolved by
having `reply_engine.rs` depend on the new `newax-reply-integration`
crate directly as a library, not by routing an internal monolith call
through gRPC.

Remaining: **~56 more modules in Communicator's `backend-rs`**
(70 routes/90 services, 142k lines total) and **~15 more in nID's
`apps/rust-api`**. This is not a mechanical find-and-replace — each
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

**Known shortcut, flagged, not to copy into cross-repo code:** split
services are currently dialed by a hardcoded `127.0.0.1:<port>` URL
(env-overridable), no mTLS, no service discovery — a stand-in for the
real `core-newax` Module Gateway from `COMMUNICATION.md`, acceptable
*within* one repo for now, never a substitute for the gateway once
nID and Communicator actually need to call each other.

## Decided, migration tracked (not yet executed)

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
