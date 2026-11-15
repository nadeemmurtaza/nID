# Module Split Playbook (nID)

Step-by-step instructions for converting one `apps/rust-api` monolith
module (a `modules/<module>/{mod.rs,dto.rs,handlers.rs,routes.rs,service.rs}`
folder) into a real, independently-deployable `tonic` gRPC service —
the pattern `CONVENTIONS.md` calls "the crates/services split."

This file is **specific to this repo** (unlike `CONVENTIONS.md`,
`COMMUNICATION.md`, `ECOSYSTEM.md`, and `ecosystem-stack.md`, which
stay identical across `nID` and `Communicator` — see "Repo Structure &
Naming Conventions" in this repo's `CLAUDE.md`/`AGENT.md`).
Communicator has its own `MODULE_SPLIT_PLAYBOOK.md` for its
`backend-rs` module shape, which differs enough (file-per-module vs.
folder-per-module, plain `PgPool` already in most services vs. this
repo's `DbPool` wrapper, pinned dependency versions vs. workspace
inheritance) that a single shared playbook kept forcing "nID does X,
Communicator does Y" branches into every section. Don't copy this
file into Communicator, and don't copy Communicator's over this one —
if a cross-repo-relevant convention changes (port-block boundaries,
the overall "two distinct roles" model), that belongs in
`CONVENTIONS.md`/`COMMUNICATION.md` instead, with just a pointer here.

Follow this document top to bottom for every module you split. Do not
skip steps because a module "looks simple" — the steps that look
skippable (the coupling grep, the registration edits, the final
`cargo check`) are exactly the ones that silently break the build two
modules later if skipped.

---

## 0. Required reading, in this order

Read these once before your first split, and re-skim §3 and §10 of
`CONVENTIONS.md` before every module after that (they are the parts
that actually change your next action):

1. **`ECOSYSTEM.md`** — what this repo is, how it relates to the other
   six repos in the ecosystem, and the "one rule" for cross-repo
   identity ownership (nID owns tenant/org/customer identity — this
   matters more here than in Communicator, since most of this repo's
   remaining unsplit modules are identity/access-control modules).
   Context only; you will not act on this file directly while
   splitting a module.
2. **`ecosystem-stack.md`** — the full technology stack decision and
   its compliance audit. The relevant part for this playbook is the
   Backend section's gRPC bullet and the "Module separation: started,
   not finished" audit line, which is what this playbook is closing
   out, module by module.
3. **`CONVENTIONS.md`** — the actual rulebook. Read in full once; the
   parts you will return to on every module are:
   - §1 folder layout (`crates/<module>/`, `services/<module>/`,
     `proto/nid/<module>/v1/<module>.proto`)
   - §2 "one name, five places" (module name used identically as crate
     suffix, proto package, DB schema/table prefix, event-bus topic
     prefix, and folder name — see §2 below for how this playbook
     applies it to crate/service/proto folder names specifically,
     including the naming drift already present and what to do about
     it)
   - §3 backend separation (module separation is mandatory for all new
     work; old monolith modules are a migration backlog, not a
     template)
   - The **"crates/services split: in progress, tracked here"**
     section — the live table of every module already split, their
     ports, and the "Known shortcut, flagged" note about the
     `127.0.0.1:<port>` direct-dial stand-in. **You will add a row to
     this table for the module you just split, in both repos, in its
     own commit, before you consider the module done — see §12.**
   - The **"Not every module is a split candidate"** note — this
     repo's own `badges` module is the documented example (shared
     badge-ranking helpers used in-process by `profiles`, no routes of
     its own).
4. **`COMMUNICATION.md`** — defines the "two distinct roles": Role 1
   is `tonic`+Protobuf for module-to-module calls (this is what you
   are building), Role 2 is the Pingora Module Gateway that will one
   day sit in front of all of it (you are not building this; the
   direct `127.0.0.1:<port>` dial is its temporary, explicitly-flagged
   stand-in). Also defines ID ownership — relevant here since this
   repo owns tenant/org/customer identity for the whole ecosystem.

If any of these files disagree with this playbook on a point of
convention, **the other file wins** — update this playbook to match
and say so in your commit message.

---

## 1. Pick a module

### 1.1 Candidate shape

A real split candidate is a folder:
`apps/rust-api/src/modules/<module>/{mod.rs,dto.rs,handlers.rs,routes.rs,service.rs}`
— `service.rs` holds the business logic and a `pub struct
<Module>Service { db: DbPool, env: AppEnv }`, `handlers.rs` holds the
axum handlers plus a `pub struct <Module>State { pub service:
<Module>Service, ... }`, `routes.rs` builds the router, `dto.rs` has
the request/response types. Constructed once in
`apps/rust-api/src/main.rs`.

### 1.2 The zero-coupling check (mandatory, every time)

Before you write a single new file, confirm the module has **no
in-process Rust calls into or out of another module's logic** (route
registration and shared DB tables are fine; direct function/struct
calls across module boundaries are the thing you're checking for):

```bash
# Look for the module calling another module's logic
grep -n "crate::modules::" apps/rust-api/src/modules/<module>/*.rs | grep -v "crate::modules::<module>::"

# Check whether anything OTHER than the module's own handlers.rs and
# main.rs constructs or calls into this module's service in-process.
grep -rln "modules::<module>::service::<Module>Service\|<Module>Service::new" apps/rust-api/src --include="*.rs" \
  | grep -v "modules/<module>/"
```

Three outcomes:

- **Nothing found anywhere** → clean, proceed with this playbook as
  written.
- **Found only inside `main.rs`'s construction call** → still clean
  (that's the expected caller); proceed.
- **Found somewhere else** (another module's `service.rs` calling this
  one directly) → this is real in-process coupling. You still split
  the module, but see §9 "Handling discovered in-process coupling"
  below instead of stopping. This repo's remaining unsplit modules
  (`sessions`, `tenants`, `organizations`, `oauth`, etc.) are expected
  to have real coupling of this kind far more often than Communicator
  does — map it out before assuming a module is clean.

### 1.3 Modules that are NOT split candidates

Some modules are pure shared libraries with no routes/handlers of
their own, called in-process by other services. `badges`
(`apps/rust-api/src/modules/badges`) is the documented example:
badge-ranking helper functions (`pick_strongest_per_claim_type`,
`pick_strongest_per_attribute`) plus `CrossTenantBadgesService`,
called in-process by `profiles/service.rs`, with no
`handlers.rs`/`routes.rs` of its own. Converting one of these to a
standalone gRPC service is wrong: it belongs inlined as a library
dependency, not behind a network call for every use. Check for a
`handlers.rs`/`routes.rs` pair before starting — if there isn't one,
skip the module and note why in `CONVENTIONS.md`'s tracking section
(see the existing `badges` note there for the exact wording pattern).

### 1.4 Prefer the smallest clean candidate

Among the zero-coupling candidates, split the smallest one next
(`wc -l` the whole module folder's `.rs` files). This keeps each
commit reviewable and keeps the "convert one module, verify, commit"
loop fast. Do not batch multiple modules into one commit.

---

## 2. Naming — "one name, five places," and the drift to watch for

Per `CONVENTIONS.md` §2, the module's name should be identical
everywhere it appears. **In practice, this repo's own history
drifted**: the first two modules split used kebab-case for the
crate/service folder (`crates/tenant-staff`, `services/tenant-staff`;
`permissions` has no underscore either way so it didn't show the
drift), while every module split afterward used snake_case to match
the proto package and Rust module conventions
(`crates/account_verification`, `services/invitations`,
`crates/departments` and `crates/subjects` are underscore-free so
they don't show it either, but `account_verification` and
`invitations`/`invitation`-shaped modules going forward should use
snake_case). **Snake_case is the rule going forward** — it matches
the proto package name (`newax.<module>.v1`, always snake_case) and
avoids a mismatch between the crate's directory name and its module
path. Do not "fix" the already-kebab-case `tenant-staff` folder as a
side effect of an unrelated module's split; that's a separate, scoped
cleanup if anyone decides to do it.

Concretely, for a module named `my_module`:

| Where | Spelling | Example |
|---|---|---|
| Proto package | `newax.my_module.v1` | always snake_case |
| Proto file path | `proto/nid/my_module/v1/my_module.proto` | snake_case folder + filename |
| Crate folder | `crates/my_module/` | snake_case |
| Crate package name (`Cargo.toml` `name =`) | `newax-my-module` | kebab-case (Cargo convention) |
| Service folder | `services/my_module/` | snake_case |
| Service package/binary name | `svc-my-module` | kebab-case |
| `crates/proto` registration module | `pub mod my_module { pub mod v1 { ... } }` | snake_case |
| Env var prefix | `MY_MODULE_SERVICE_URL`, `MY_MODULE_PORT` | SCREAMING_SNAKE_CASE |

This repo's `crates/*` crates have **no `[lib]` section** in
`Cargo.toml` — the crate name itself (hyphenated in `name =`) is what
Rust exposes as the `use` path with hyphens turned to underscores
automatically, so `newax-my-module` is used as `newax_my_module` in
code without a separate `[lib] name` line. Don't add one; it's not
needed and every existing crate here omits it.

---

## 3. Folder layout you will create

For a module named `my_module`, you create exactly these new paths
(nothing else — never touch files outside them except the specific
edits in §7 and §8):

```
proto/nid/my_module/v1/my_module.proto   # new
crates/my_module/Cargo.toml               # new
crates/my_module/src/lib.rs                # new (moved logic)
services/my_module/Cargo.toml              # new
services/my_module/build.rs                 # new
services/my_module/src/main.rs               # new
```

Plus edits (never full rewrites) to three files that already exist:

```
crates/proto/src/lib.rs      # add one `pub mod my_module { pub mod v1 { ... } }` block
crates/proto/build.rs        # add one path to the PROTOS const
apps/rust-api/src/modules/my_module/service.rs   # rewritten as a thin gRPC client (§8)
```

`handlers.rs`, `dto.rs`, `routes.rs`, and `mod.rs` for the module are
**never touched** — that is the entire point of keeping
`<Module>Service`'s public shape identical.

You never need to touch `[workspace] members` in the root
`Cargo.toml` — it already uses the globs `"apps/rust-api"`,
`"crates/*"` and `"services/*"`, so a new crate/service directory is
picked up automatically the moment it has a `Cargo.toml` in it. Verify
this is still true before you start (`grep -A6 "\[workspace\]"
Cargo.toml`); if someone ever changes it to an explicit list, you will
need to add your two new entries there too.

---

## 4. Writing the proto file

### 4.1 Decide: fully-typed messages, or a JSON envelope?

Every module split in this repo so far (`permissions`, `tenant-staff`,
`departments`, `account-verification`, `subjects`, `invitations`) has
used **fully-typed proto messages**, because nID's `dto.rs` response
types are already concrete `#[derive(Serialize)]` structs, never
`serde_json::Value`. Expect to do the same for the remaining modules
unless you actually find a handler returning dynamic JSON — check the
module's `handlers.rs` return types before assuming, the same way
Communicator's playbook does, rather than defaulting to typed out of
habit.

If you do find a module that returns `Json<serde_json::Value>`
genuinely dynamically, use the envelope instead:

```protobuf
message JsonResponse {
  string json = 1;
}
message Empty {}
```

with the crate doing `serde_json::to_string(&real_struct)` and the
client side doing `serde_json::from_str`. Never invent a fixed shape
the original code didn't have.

### 4.2 Proto file skeleton

```protobuf
syntax = "proto3";

package newax.my_module.v1;

service MyModuleService {
  rpc DoThing(DoThingRequest) returns (DoThingResponse);
  // one rpc per handlers.rs function, same order as they appear in
  // handlers.rs — makes the service.rs diff easy to read against the
  // proto file side by side.
}

message Empty {}

// Prefer `optional` for every field that was `Option<T>` in the
// source Rust struct — proto3 only treats a field as "unset vs
// default" when you mark it `optional`; without it, you cannot tell
// an explicit empty string/0 from "the source had None".
message DoThingRequest {
  string required_field = 1;
  optional string optional_field = 2;
}

message DoThingResponse {
  string id = 1;
  // ... mirror the source struct's fields, in the source struct's
  // field order, 1-indexed, no gaps.
}
```

Rules that have held across every module split so far:

- One `.proto` file per module, one `service` block per module.
- RPC names are PascalCase verbs matching the source function name
  (`get_by_id` → `GetById`, `send_email_invite` → `SendEmailInvite`).
- A handler's caller identity/authorization parameters
  (`account_id`, `tenant_id`, `caller_id`, `actor_type`/`actor_id`)
  are **always explicit request fields** — the gRPC service has no
  access to the HTTP session/auth extractors (`AccountSession`,
  `AuthenticatedApiKey`, `AuthenticatedActor`) that `handlers.rs`
  used, so `service.rs`'s gRPC client must pass those values through
  on every call instead of relying on ambient context. This is the
  single most common mistake to check for when writing the proto:
  if a `service.rs` method took `account_id: &str` as an explicit
  parameter before, the generated request message needs that same
  field — don't assume the server can recover it another way.
- A `serde_json::Value` field inside an otherwise-typed message
  becomes a `string ..._json = N;` field — never try to represent
  arbitrary JSON as a proto `map` or `Struct` type; stringify it and
  re-parse on both ends.
- Request messages that exist purely to carry an ID take the pattern
  `message IdRequest { string id = 1; }` and are reused across every
  RPC in the module that just needs one ID — don't make a new
  single-field message per RPC. Where a module's methods need
  *several* different ID-shaped combinations (e.g. `subjects`' calls
  all need `tenant_id` plus one or two more IDs depending on the
  call), it's fine to have a handful of small, purpose-named request
  messages (`GetByIdRequest`, `GetBadgesRequest`) rather than forcing
  every RPC into one shape.

---

## 5. Writing the crate (`crates/my_module/`)

### 5.1 `Cargo.toml`

This repo's root `Cargo.toml` declares `[workspace.dependencies]` —
reuse them with `{ workspace = true }` instead of pinning versions
again:

```toml
[package]
name = "newax-my-module"
version.workspace = true
edition.workspace = true

[dependencies]
sqlx = { workspace = true }
anyhow = { workspace = true }
serde = { workspace = true }
chrono = { workspace = true }   # only if needed
```

Only list the dependencies the moved code actually uses — check the
source file's existing `use` statements, don't copy every dependency
this repo's crates happen to have elsewhere.

### 5.2 `src/lib.rs` — moving the logic

This is a **near-verbatim copy** of the monolith's `service.rs`, with
one structural change: `pub struct XService { db: DbPool, env: AppEnv }`
becomes `pub struct XService { db: PgPool }` (drop `env` entirely
unless the moved logic actually reads a field off it — check first,
most of this repo's services only ever stored it, never read it).

- Every `let mut conn = self.db.get().await?` (a pooled connection
  from the `DbPool` wrapper) becomes just using `&self.db` directly
  with sqlx's `Executor` trait (sqlx accepts `&PgPool` anywhere it
  accepts a connection) — drop the `let mut conn =` line and replace
  every `&mut *conn` in the moved queries with `&self.db`.
- If the original used `self.db.inner().begin()` for an explicit
  transaction (because it needed to run `SELECT
  set_config('app.tenant_id', ...)` for row-level security before
  further queries in the same transaction — see `subjects`), **keep
  the transaction**: call `self.db.begin().await?` on the plain
  `PgPool` instead, which does the same thing. Do not drop the RLS
  `set_config` call or the transaction wrapper — that's a security
  property, not incidental plumbing.
- DTOs/request types that lived in `dto.rs` do **not** move to the
  crate as-is if they used `serde` attributes tied to the HTTP wire
  format (`#[serde(rename_all = "camelCase")]`, `#[serde(default)]`).
  The crate's request/response structs are plain Rust structs with
  **no serde attributes** on the request side (they are never
  deserialized directly — the proto layer and the monolith's own
  `dto.rs` handle the wire formats on their respective sides); keep
  `#[derive(Serialize)]` on response structs if you want the crate
  itself testable via `serde_json::to_string` in a `#[cfg(test)]`
  block, but give request structs `#[derive(Debug, Default)]` instead
  of `Deserialize`.
- Keep any `#[cfg(test)] mod tests` block from the source file — it
  moves with the rest of the code unchanged.
- Preserve bugs. The module split must be behavior-preserving; file a
  separate note if you spot something worth fixing later, but fix it
  in its own commit, not bundled into the split.

---

## 6. Writing the service (`services/my_module/`)

### 6.1 `Cargo.toml`

```toml
[package]
name = "svc-my-module"
version.workspace = true
edition.workspace = true

[[bin]]
name = "svc-my-module"
path = "src/main.rs"

[dependencies]
newax-my-module = { path = "../../crates/my_module" }
tonic = "0.12"
prost = "0.13"
tokio = { workspace = true }
sqlx = { workspace = true }
anyhow = { workspace = true }
serde_json = { workspace = true }   # only if the module uses JSON values
tracing = { workspace = true }
tracing-subscriber = { workspace = true }
dotenvy = { workspace = true }

[build-dependencies]
tonic-build = "0.12"
```

### 6.2 `build.rs`

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/nid/my_module/v1/my_module.proto"],
        &["../../proto"],
    )?;
    Ok(())
}
```

Note this is the **server-side** build script — it does *not* call
`.build_server(false)` (that flag belongs only to `crates/proto`'s
build script, §7, which generates client-only code for every other
module to depend on).

### 6.3 `src/main.rs` skeleton

```rust
use newax_my_module::{MyModuleService, /* any response structs you convert */};
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.my_module.v1");
}

use proto::{
    my_module_service_server::{MyModuleService as MyModuleRpc, MyModuleServiceServer},
    // ... every message type main.rs constructs or destructures
};

struct Grpc {
    service: MyModuleService,
}

fn to_status(e: anyhow::Error) -> Status {
    let msg = e.to_string();
    if msg.contains("not found") {
        Status::not_found(msg)
    } else if msg.contains("Only tenant owners") || msg.contains("do not have access") {
        Status::permission_denied(msg)
    } else if msg.contains("already") {
        Status::already_exists(msg)
    } else {
        Status::internal(msg)
    }
}

// one conversion function per message type that needs mapping between
// the logic crate's plain struct and the generated proto struct —
// name them `<thing>_to_proto` consistently.

#[tonic::async_trait]
impl MyModuleRpc for Grpc {
    async fn do_thing(&self, req: Request<proto::DoThingRequest>) -> Result<Response<proto::DoThingResponse>, Status> {
        let r = req.into_inner();
        let result = self.service.do_thing(&r.account_id, &r.tenant_id, &r.some_field).await.map_err(to_status)?;
        Ok(Response::new(do_thing_to_proto(result)))
    }
    // ... one method per rpc in the .proto service block, same order
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_new("info,svc_my_module=debug").unwrap())
        .init();

    let database_url = std::env::var("APP_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .map_err(|_| "APP_DATABASE_URL (or DATABASE_URL) must be set")?;
    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;

    let port: u16 = std::env::var("MY_MODULE_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(PORT);
    let addr = format!("0.0.0.0:{port}").parse()?;

    let grpc = Grpc { service: MyModuleService::new(pool) };

    info!(port, "svc-my-module starting (gRPC)");
    Server::builder()
        .add_service(MyModuleServiceServer::new(grpc))
        .serve(addr)
        .await?;
    Ok(())
}
```

Note the two env-var fallback (`APP_DATABASE_URL` first, then
`DATABASE_URL`) — this is nID-specific; Communicator's services only
ever read `DATABASE_URL`. Every module split in this repo so far
constructs the logic crate's own service struct **once at startup**
and stores it in `Grpc { service }`, rather than re-constructing it
per request — keep doing that (it's the opposite of Communicator's
convention, which re-constructs per request; see that repo's playbook
if you need to know why — the short version is both are fine with
`PgPool`'s cheap clone, so each repo just kept doing what its first
split module did).

### 6.4 Port allocation

Ports are a single incrementing counter **for this repo only** —
Communicator has its own, separate block starting at 50061; this
repo's block started at 50071 and is not shared with Communicator's
numbering. **Check `CONVENTIONS.md`'s tracking table for the highest
nID port already used and take the next integer** — do not leave
gaps, and do not reuse a port even if the module that used it was
later renamed.

Env var name: `<MODULE_SCREAMING_SNAKE>_PORT` for the service's own
listen port, and `<MODULE_SCREAMING_SNAKE>_SERVICE_URL` for the
client-side override (used only by `service.rs`'s gRPC client in §8,
defaulting to `http://127.0.0.1:<port>`).

---

## 7. Registering the module in `crates/proto`

`crates/proto` is the one shared crate that generates **client-only**
stubs for every split module, so `apps/rust-api` (and any other
module that needs to call this one) depends on one pre-generated copy
instead of each caller regenerating its own.

Edit `crates/proto/src/lib.rs`, appending (never reordering existing
entries):

```rust
pub mod my_module {
    pub mod v1 {
        tonic::include_proto!("newax.my_module.v1");
    }
}
```

Edit `crates/proto/build.rs`, appending one path to the `PROTOS`
const (a `&[&str]` passed to one `compile_protos` call with
`.build_server(false)`):

```rust
"../../proto/nid/my_module/v1/my_module.proto",
```

Do not add a new `tonic_build::configure()` call — there is exactly
one, covering every module's proto file in one compile pass.

---

## 8. Rewriting `service.rs`

Unlike `handlers.rs`/`dto.rs`/`routes.rs`/`mod.rs` (never touched),
`service.rs` is rewritten **in place as a gRPC client**. The struct
keeps its exact name and constructor signature so
`handlers.rs`/`main.rs` need zero changes:

```rust
//! <Module> service -- gRPC client for `svc-my-module`.
//!
//! Business logic moved to `crates/my_module`, served by
//! `services/my_module` (see CONVENTIONS.md's crates/services split).
//! Same public shape so `handlers.rs` needed zero changes.

use anyhow::{anyhow, Result};
use newax_proto::my_module::v1::{my_module_service_client::MyModuleServiceClient, /* ... */};

use crate::core::config::AppEnv;
use crate::core::db::DbPool;
use crate::modules::my_module::dto::{/* the existing dto.rs response/request types */};

pub struct MyModuleService {
    #[allow(dead_code)]
    db: DbPool,
    #[allow(dead_code)]
    env: AppEnv,
}

fn thing_from_proto(x: newax_proto::my_module::v1::DoThingResponse) -> DoThingResponse {
    // field-by-field conversion from the generated proto type back to
    // the dto.rs type handlers.rs already expects
    DoThingResponse { /* ... */ }
}

async fn client() -> Result<MyModuleServiceClient<tonic::transport::Channel>> {
    let url = std::env::var("MY_MODULE_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:<PORT>".to_string());
    MyModuleServiceClient::connect(url).await.map_err(|e| anyhow!("my-module service unreachable: {e}"))
}

impl MyModuleService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn do_thing(&self, account_id: &str, tenant_id: &str, /* same params as before */) -> Result</* same return type */> {
        let mut c = client().await?;
        let resp = c.do_thing(/* grpc request built from params, passing account_id/tenant_id explicitly -- see §4.2 */)
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(thing_from_proto(resp.into_inner()))
    }
    // ... one method per original method, identical signature
}
```

`db` and `env` are kept as dead, `#[allow(dead_code)]`-annotated
fields even though the gRPC client version never uses them — removing
them would change `MyModuleService::new`'s signature, which would
ripple into `main.rs`'s construction call for no benefit.

There is **no deletion step** for nID modules — `service.rs` is
rewritten in place, not removed, and nothing else in the module
folder changes.

---

## 9. Handling discovered in-process coupling

If §1.2's grep found a real caller in another module's `service.rs`
(expected to be common for this repo's remaining modules — `sessions`,
`tenants`, `organizations`, `oauth`, etc. call each other directly
today), do not let that block the split. Instead:

1. Add the new crate (`crates/<module>`) as a normal Rust dependency of
   `apps/rust-api/Cargo.toml`, the same way `newax-proto` is already a
   dependency there.
2. Change the other caller's `use crate::modules::<module>::...`
   import to `use newax_<module>::...` instead, and update the type
   path at each call site. The caller keeps calling the logic
   in-process — it does **not** go through gRPC — because this is an
   internal monolith call, not a cross-service call; routing it
   through gRPC would add latency and a new failure mode for zero
   benefit.
3. Document the resolution in `CONVENTIONS.md`'s tracking section (see
   the existing `reply-integration` paragraph there — a Communicator
   example, but the same wording pattern applies here) so the next
   person who hits this doesn't have to re-derive the same decision.

---

## 10. Verification (mandatory before every commit)

```bash
cargo check --workspace
```

This must finish with `Finished` and **zero lines starting with
`error`** (warnings are fine and expected — the baseline is in the
tens and stays roughly flat, plus one pre-existing
`proc-macro-error2` future-incompatibility note unrelated to any
split; check the warning count didn't jump unexpectedly otherwise,
which usually means something didn't get wired up).

Never commit a module split that hasn't been checked this way. Never
batch two modules' changes into one `cargo check` pass and one
commit — if something fails, you need to know which module broke it.

---

## 11. Commit and push

One commit for the module split itself:

```
Split <module> out of apps/rust-api into a real gRPC service

<N> of ~20 apps/rust-api modules now split. Port <port>, fully typed
proto. Zero cross-module coupling confirmed by grep before converting;
handlers.rs/dto.rs/routes.rs needed zero changes -- only service.rs
became a gRPC client, same public shape as before.
```

If §9 applied, add a paragraph naming the discovered coupling and how
it was resolved.

Push to the branch the session is already using
(`ccr-7fbf3c72-4tqu4w` as of this writing — confirm the current
branch name before pushing, it is session-assigned and will differ in
future sessions):

```bash
git push -u origin <branch>
```

---

## 12. Update `CONVENTIONS.md` in BOTH repos (separate commit)

This is not optional and not deferrable to "later" — do it in the
same work session, immediately after the module-split commit, as its
own commit. `CONVENTIONS.md` itself (unlike this playbook) stays
identical across both repos, so this is the one step in this document
that still touches Communicator's working copy:

1. In `CONVENTIONS.md`'s "crates/services split: in progress, tracked
   here" section:
   - Bump the "nineteen real modules split so far" count (in both the
     prose sentence and by adding a table row).
   - Add one row to the table: `| my-module | nID |
     \`crates/my_module\` | \`services/my_module\` | <port> |`.
   - Decrement the "~N more in nID's `apps/rust-api`" remaining count
     by one.
   - If §9 applied, add the discovered-coupling paragraph.
   - If §1.3 applied (skipped a non-candidate module), add a note
     about it instead of a table row, matching the existing `badges`
     note's wording.
2. Copy the edited `CONVENTIONS.md` into the Communicator checkout
   byte-for-byte:
   ```bash
   cp CONVENTIONS.md ../Communicator/CONVENTIONS.md
   diff CONVENTIONS.md ../Communicator/CONVENTIONS.md   # must print nothing
   ```
3. Commit and push in **both** repos, same message:
   ```
   Add <module> to CONVENTIONS.md's split-tracking table
   ```

The tracking table is the only source of truth for "what port is free
next" and "how many modules are left" — if it drifts out of sync with
reality, every subsequent split inherits the confusion. Treat updating
it as part of the module split, not a follow-up chore.

---

## 13. Final checklist

Copy this list into your own working notes for each module and tick
every line before calling the module done. Do not skip a line because
an earlier module "probably" got it right — verify this module,
every time.

- [ ] Confirmed the module has the standard candidate shape (§1.1),
      not a shared-library non-candidate (§1.3)
- [ ] Ran the zero-coupling grep (§1.2) and recorded the result
      (clean, or coupling found and resolved per §9)
- [ ] Confirmed the handlers return concrete structs (fully-typed
      proto is the default here) rather than assuming it (§4.1)
- [ ] `proto/nid/<module>/v1/<module>.proto` written: one service
      block, RPC order matches `handlers.rs` order, every caller
      identity param (`account_id`/`tenant_id`/etc.) is an explicit
      request field, every `Option<T>` field marked `optional`
- [ ] `crates/<module>/Cargo.toml` lists only the dependencies the
      moved code actually uses, via `{ workspace = true }`
- [ ] `crates/<module>/src/lib.rs` is the moved logic, taking a plain
      `PgPool` (not `DbPool`), any RLS `set_config`+transaction
      pattern preserved exactly, test module preserved, no bugs
      silently fixed
- [ ] `services/<module>/Cargo.toml`, `build.rs`, `src/main.rs`
      written; port taken from `CONVENTIONS.md`'s table + 1, not
      reused; `APP_DATABASE_URL`-then-`DATABASE_URL` fallback used
- [ ] `crates/proto/src/lib.rs` and `crates/proto/build.rs` both
      updated, appended (not reordered)
- [ ] `service.rs` rewritten as gRPC client in place, same struct
      name/constructor signature; `handlers.rs`/`dto.rs`/`routes.rs`/
      `mod.rs` untouched
- [ ] `cargo check --workspace` run and confirmed zero errors
- [ ] Module-split commit made and pushed to the session's branch
- [ ] `CONVENTIONS.md` updated in both repos (count, table row,
      remaining-count decrement, any coupling/skip note) and pushed as
      its own commit, with the two copies verified byte-identical via
      `diff`
