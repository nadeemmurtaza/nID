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

## Known gaps (fix opportunistically, not required to block on)

These are real deviations from the layout in §1 as of 2026-11-14 —
listed so nobody "fixes" them by accident while touching unrelated
code, and so a deliberate migration (if ever done) has a checklist:

- **Communicator**: `backend-rs/` should become `services/<module>/`
  + `crates/<module>/` once it's split by module (it's currently one
  monolithic crate — fine for now per the modular-monolith-first ADR,
  but the folder name should drop the generic `backend-rs` label when
  it splits). Root-level `cargo_check*.log` files and `.ps1` scripts
  are prototype debugging artifacts that belong in `scripts/` (scripts)
  or nowhere (logs) rather than the repo root. `erp-schema/*.prisma`
  is schema-*modeling* only (not the Prisma client/ORM we ruled out in
  the tech-stack plan) — rename the directory so that's unambiguous,
  or migrate the models into the Rust/SQLx migration flow. `src/
  communicator-archive/` and `frontend/shopify-otp-widget/`,
  `frontend/store-otp-widget/` read as legacy/experimental — if they're
  not live, they belong under a top-level `archive/`, not mixed into
  `src/`/`frontend/`.
- **nID**: `apps/api` (TypeScript) and `apps/rust-api` (Rust) both
  exist — under §2's one-name rule, two backends for the same module
  boundary need either a merge or a clearly different module name for
  each, not a `-rust-` suffix distinguishing them by implementation
  language. `crates/` currently holds only 3 Rust library crates (`billing`,
  `shared-types`, `storage`); the verification engines
  (`forensics-engine`, `liveness-engine`, `ocr-engine`,
  `verification-providers`, `workflow-contracts`) are confirmed
  TypeScript (jest + tsconfig in each), correctly under `packages/` by
  language — but they read as engines/services, not shared libraries,
  so confirm whether any should move to `apps/` or `services/` once
  nID's backend is split by module rather than staying lumped into
  `apps/api` + `apps/rust-api`.

None of the above is being changed by this document — it only records
the gap so a future migration PR has a true checklist instead of
rediscovering these by hand.
