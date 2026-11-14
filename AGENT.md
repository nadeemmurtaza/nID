# nID — Agent Notes

This file carries the same ecosystem-wide architecture plan as `CLAUDE.md`
in this repo, for agents/tools that read `AGENT.md` instead. See
`ECOSYSTEM.md` for how this repo relates to the other six repos in the
NEWAX ecosystem. nID is the single identity provider for the whole
ecosystem (login, MFA/2FA, OAuth sessions, secrets vault) — it must never
own business data from another domain.

## Repo Structure & Naming Conventions

See `CONVENTIONS.md` for the ecosystem-wide rules on folder layout,
module/service naming, file naming, renaming, branches, worktrees,
commits, and merge strategy — identical across every NEWAX repo. The
2026-11-14 audit decided `apps/api` vs. `apps/rust-api`
(`apps/rust-api` wins, `apps/api` deprecated — see
`apps/api/README.md`) and tracked what's left to actually remove
Prisma; see `CONVENTIONS.md`'s "Decided, migration tracked" section.

See `COMMUNICATION.md` for how this repo is meant to talk to
Communicator and the rest of the ecosystem (Module Gateway/gRPC, the
NATS event bus, per-ID ownership — nID owns tenant/org/customer
identity), how modules talk to each other inside this one repo, and
how third-party platforms fit in. None of the cross-repo pieces exist
yet — see its audit note.

## NEWAX Ecosystem — Technology Stack & Architecture Plan

> Applies to every repo in the ecosystem (nID, Communicator, core-newax,
> erp-1, newcom, harvester, AegisDesk). Optimization order, in priority:
> **1) lowest RAM, 2) minimum garbage/allocation, 3) lowest battery drain
> (mobile), 4) maximum throughput/latency, 5) maximum security.**
> Speed-to-market is explicitly *not* in this list — every choice below
> trades dev velocity for runtime efficiency on purpose.

### Backend

- **Language:** Rust. No exceptions for new services — it's already the
  standard in this ecosystem (`crates/`, `apps/`, `Cargo.toml` at the
  root here). No GC, no runtime, predictable allocation.
- **HTTP/RPC framework:** `tonic` (gRPC) + `tonic-web`/Connect handler on
  the same binary. Async via `tokio`.
- **Schema:** Protobuf (`.proto`) is the single source of truth for every
  API contract, shared across all services and all client platforms.
  Codegen, not hand-written DTOs, on every side.
- **Wire protocols by consumer** (one schema, three transports from the
  same Rust binary — no separate proxy process):
  - Native clients (iOS, Android, Windows): real gRPC over HTTP/2,
    persistent connections — fewer TLS handshakes, lower radio/battery
    cost on mobile.
  - Browser clients: **Connect protocol** (buf.build), not plain
    grpc-web. Connect speaks Protobuf-or-JSON over plain HTTP/1.1 or
    HTTP/2 directly from the Rust server — no Envoy/grpc-web proxy, no
    second schema, no extra RAM-hungry process to run and secure.
  - Service-to-service inside the ecosystem: gRPC via the Module Gateway
    in `core-newax` only. No repo calls another repo's API directly —
    see `ECOSYSTEM.md`.
- **Database:** PostgreSQL. Row-level security, mature TLS/auditing, no
  surprises. Not Mongo/MySQL unless a specific service proves a
  document-shaped workload needs it.
- **ORM / query layer:** `SQLx`, compile-time checked raw SQL. No Prisma
  (no real Rust support — the community client is unmaintained — and its
  Node-side engine/connection-pool model is exactly the RAM and GC
  overhead this ecosystem is optimizing away). `SeaORM` is the only
  fallback, and only where SQLx's lack of ORM ergonomics is a real
  blocker, not a convenience preference.
- **Caching, two tiers, add the second only when actually needed:**
  - In-process: `moka` (Rust, concurrent LRU/TTL) inside the service —
    zero network hop, zero extra process, lowest RAM for a
    single-instance deployment.
  - Shared/distributed: Redis, only once there are multiple backend
    instances that must agree on cached state (likely true for nID
    specifically, since session validation is called by every other
    repo — but still don't add it until a second instance is real).
- **Security baseline (by construction, not bolted on) — extra weight
  here since nID is the identity provider for the whole ecosystem:**
  - Memory safety from Rust itself — no buffer overflows/UAF class of
    bugs.
  - SQL injection closed by SQLx's compile-time query verification, not
    by a runtime sanitizer.
  - mTLS between services wherever traffic crosses a process boundary
    (every other repo validating sessions against nID, the Module
    Gateway, the event bus).
  - Secrets vault: every other service's API keys/env secrets, scoped
    per-service, fetched at boot, never committed to any repo.

### Frontend — per platform, same Rust core, different native shell

The core strategy is **Shared Core, Thin Native UI**, extended to the web
via WebAssembly so there is still exactly one logic implementation, not
"mobile+desktop in Rust, web in a second stack":

- **Core logic module:** Rust, compiled natively for iOS/Android/Windows
  and to **WASM** for the browser. Business rules, caching rules, and
  networking (the gRPC/Connect client) live here once, bound into every
  platform via `UniFFI` (native) or `wasm-bindgen` (web). This is the
  piece that keeps behavior identical across platforms and keeps the
  footprint small everywhere.

#### Design system (shared global CSS tokens)

Canonical token file: `packages/design-tokens/tokens.css` (package
`@newax/design-tokens`), consumed by every Next.js app in this repo
(`dashboard`, `login-ui`, `profile-ui`, `verify-ui`) via
`@import "@newax/design-tokens/tokens.css";` at the top of each app's
`app/globals.css`. Same palette, typography, spacing, layout, radius,
elevation and motion tokens as every other NEWAX repo — Communicator's
`packages/design-tokens/tokens.css` is the identical copy, same
package name (`@newax/design-tokens`), same folder. Until `core-newax`
hosts this as a real shared package (the correct long-term home, per
this ecosystem's "build once, reuse everywhere" rule), the package is
duplicated byte-for-byte across repos: edit one, copy to the others,
never fork the values. The file also defines
compatibility aliases (`--bg`, `--fg`, `--accent`, etc.) so the short
variable names already used across these four apps keep resolving
without a rewrite — new code should read the canonical `--color-*`,
`--text-*`, `--space-*`, `--radius-*`, `--elevation-*`, `--layer-*`,
`--motion-*` names directly.

- **iOS:** Swift/SwiftUI shell, calling the Rust core via UniFFI. ARC,
  no GC pauses, no bridge overhead.
- **Android:** Kotlin/Jetpack Compose shell, same UniFFI bridge into the
  same Rust core.
- **Windows:** C#/WinUI 3 as the default; if the C# GC proves to be a
  real RAM/latency cost in profiling, prototype a Rust-native UI
  (`slint` or `egui`) to remove the last non-Rust layer on desktop.
- **Web:** Svelte (compiles away — no virtual-DOM diffing garbage at
  runtime, unlike React) driving the Rust-core-as-WASM module in-browser
  directly, talking Connect to the backend. This is deliberately *not*
  Flutter: Flutter's Dart runtime carries its own garbage collector,
  which directly conflicts with this ecosystem's "minimum garbage"
  requirement — Impeller fixes rendering jank, not allocation pressure.
  A single cross-platform Dart/Flutter codebase is the faster-to-ship
  choice and was considered and rejected here specifically because
  runtime efficiency outranks speed-to-market for this project.

#### Package manager: pnpm, everywhere, no exception

Both repos' JS/TS tooling runs on **pnpm workspaces** (`pnpm-workspace.yaml`
at the repo root, `apps/*` + `packages/*`), not npm. This repo already
used pnpm; Communicator used npm and has been converted to match:

- **Lowest RAM/disk, by construction:** pnpm keeps one global
  content-addressable store and hard-links packages into each
  `node_modules`, instead of npm's copy-per-project. Less disk churn,
  less duplicate install garbage across `apps/*`/`packages/*`.
- **No phantom dependencies:** pnpm's non-flat `node_modules` means
  code can only import what its own `package.json` actually declares
  — a correctness property npm's flat hoisting doesn't give you.
- **Real monorepo primitives:** `workspace:*` protocol, `pnpm -r
  --filter`, and content-addressable linking are built for exactly
  the `apps/*` + `packages/*` shape both repos use — npm workspaces
  support the shape but not the efficiency.
- Keep using `pnpm install` / `pnpm -r --filter` here, same as always
  — this section exists so the choice (and why Communicator now
  matches it) is recorded once, ecosystem-wide.

#### Tech-stack compliance audit (2026-11-14)

Honest status against the plan above, not papered over:

- **Backend wire protocol: not compliant.** Neither `apps/api` nor
  `apps/rust-api` speaks gRPC/Connect — both are REST/JSON today, no
  `tonic`/`prost`/`.proto` anywhere in this repo. The plan above is
  the target for new cross-repo communication (see
  `COMMUNICATION.md`), not a description of what's running.
- **Database: mixed compliance — decided, not yet executed.**
  `apps/rust-api` uses SQLx + PostgreSQL, as planned. **`packages/db`
  genuinely depends on `@prisma/client` at runtime** (not just
  `.prisma` as modeling notation — the real ORM, used by `apps/api`,
  `apps/workflows`, `packages/verification-providers`, and
  `packages/billing`). This directly contradicts the "no Prisma"
  decision and is the biggest tech-stack gap this audit found. **The
  decision: `apps/rust-api` is canonical; `apps/api` is deprecated**
  (see `apps/api/README.md`) — both bind the same `API_PORT` and serve
  the same Next.js clients via `NEXT_PUBLIC_NID_API_URL`, which is
  exactly why `apps/rust-api`'s module-by-module auth-audit work could
  port `apps/api`'s modules one for one. What's **not** done yet:
  route-for-route parity hasn't been verified file-by-file, and
  `apps/workflows`/`verification-providers`/`billing` still need
  porting off Prisma onto SQLx before `packages/db` can actually be
  removed — real migrations touching live identity-verification
  workflows, not something to force through as a side effect of a
  naming audit. Don't build new features on `apps/api`; build them on
  `apps/rust-api`.
- **Workflow orchestration: undocumented but real.** `apps/workflows`
  depends on Temporal (`@temporalio/core-bridge`). This was never
  part of the ecosystem tech-stack plan — recorded here as a factual
  correction, not a recommendation to change it.
- **Cache: not implemented.** No `moka`, no Redis, in this repo today.
- **Frontend: not compliant, and not a quick fix.** All four apps
  (`dashboard`, `login-ui`, `profile-ui`, `verify-ui`) are Next.js/
  React, not Svelte, and talk REST, not Connect. These are real,
  already-shipped apps — re-platforming them is a dedicated project,
  not an audit fix. Treat the Svelte/WASM plan as the target for new
  client surfaces until a migration is explicitly decided.

### Why this combination and not the obvious alternatives

- **Not Prisma** — wrong language ecosystem for a Rust backend, and its
  Node-side engine is the opposite of low-RAM/low-GC.
- **Not Flutter** — Dart's GC conflicts with the explicit
  minimum-garbage requirement; only reconsider this if speed-to-market
  is explicitly re-prioritized above runtime efficiency.
- **Not grpc-web via an Envoy proxy** — adds a second always-on process,
  more RAM, more attack surface, and a translation hop Connect avoids by
  serving browsers straight from the same Rust binary that serves gRPC.
- **Shared Rust core via UniFFI/WASM, not four separate reimplementations**
  — one schema (Protobuf), one logic implementation (Rust), four thin
  native shells. The cost is real: this is more upfront engineering than
  one Flutter codebase. That tradeoff is intentional given this
  ecosystem's stated priorities (RAM, GC, battery, security over
  dev speed).
