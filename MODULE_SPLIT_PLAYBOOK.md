# Module Split Playbook

Step-by-step instructions for converting one monolith module (a
Communicator `backend-rs` route+service pair, or an nID
`apps/rust-api` dto/handlers/routes/service module) into a real,
independently-deployable `tonic` gRPC service — the pattern
`CONVENTIONS.md` calls "the crates/services split."

This file is **identical across `nID` and `Communicator`** (same rule
as `CONVENTIONS.md`, `COMMUNICATION.md`, `ECOSYSTEM.md`,
`ecosystem-stack.md` — see "Repo Structure & Naming Conventions" in
each repo's `CLAUDE.md`/`AGENT.md`). If you edit it, copy the edited
file into the other repo byte-for-byte in the same work session and
commit it there too.

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
   identity ownership. Context only; you will not act on this file
   directly while splitting a module.
2. **`ecosystem-stack.md`** — the full technology stack decision and
   its compliance audit. The relevant part for this playbook is the
   Backend section's gRPC bullet and the "Module separation: started,
   not finished" audit line, which is what this playbook is closing
   out, module by module.
3. **`CONVENTIONS.md`** — the actual rulebook. Read in full once; the
   parts you will return to on every module are:
   - §1 folder layout (`crates/<module>/`, `services/<module>/`,
     `proto/<repo>/<module>/v1/<module>.proto`)
   - §2 "one name, five places" (module name used identically as crate
     suffix, proto package, DB schema/table prefix, event-bus topic
     prefix, and folder name — see §1 below for how this playbook
     applies it to crate/service/proto folder names specifically,
     including the naming drift already present and what to do about
     it)
   - §3 backend separation (module separation is mandatory for all new
     work; old monolith routes/services are a migration backlog, not a
     template)
   - The **"crates/services split: in progress, tracked here"**
     section — the live table of every module already split, their
     ports, and the "Known shortcut, flagged" note about the
     `127.0.0.1:<port>` direct-dial stand-in. **You will add a row to
     this table for the module you just split, in both repos, in its
     own commit, before you consider the module done.**
   - The **"Not every module is a split candidate"** note (the
     `badges`-shaped exception — see §2 below).
4. **`COMMUNICATION.md`** — defines the "two distinct roles": Role 1
   is `tonic`+Protobuf for module-to-module calls (this is what you
   are building), Role 2 is the Pingora Module Gateway that will one
   day sit in front of all of it (you are not building this; the
   direct `127.0.0.1:<port>` dial is its temporary, explicitly-flagged
   stand-in). Also defines ID ownership if your module touches
   tenant/org/customer identity.

If any of these files disagree with this playbook on a point of
convention, **the other file wins** — update this playbook to match
and say so in your commit message.

---

## 1. Pick a module

### 1.1 Candidate shape

A real split candidate has the monolith's standard shape for its repo:

- **Communicator (`backend-rs`)**: a pair —
  `backend-rs/src/routes/<module>.rs` (axum handlers) and
  `backend-rs/src/services/<module>.rs` (business logic + types),
  wired together by `use crate::services::<module>;` in the routes
  file and registered as `pub mod <module>;` in both
  `backend-rs/src/routes/mod.rs` and `backend-rs/src/services/mod.rs`,
  with its routes mounted in `backend-rs/src/main.rs`.
- **nID (`apps/rust-api`)**: a folder —
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
# Communicator — look for the module calling another module's service
grep -n "crate::services::" backend-rs/src/services/<module>.rs | grep -v "crate::services::<module>"

# nID — same idea, one level of module nesting
grep -n "crate::modules::" apps/rust-api/src/modules/<module>/*.rs | grep -v "crate::modules::<module>::"

# Both — check whether anything OTHER than the route file and main.rs
# constructs or calls into this module's service in-process. This is
# the check that caught reply-integration's coupling from
# reply_engine.rs — never skip it.
grep -rln "services::<module>\|<Module>Service::new" backend-rs/src --include="*.rs" \
  | grep -v "routes/<module>.rs\|services/<module>.rs\|routes/mod.rs\|services/mod.rs\|main.rs"
```

Three outcomes:

- **Nothing found anywhere** → clean, proceed with this playbook as
  written.
- **Found in the module's own route file only** → still clean (that's
  the expected caller); proceed.
- **Found somewhere else** (another service file, like
  `reply_engine.rs` calling `ReplyIntegrationService` directly) → this
  is real in-process coupling. You still split the module, but see
  §9 "Handling discovered in-process coupling" below instead of
  stopping.

### 1.3 Modules that are NOT split candidates

Some "modules" in the monolith are pure shared libraries with no
routes/handlers of their own — e.g. nID's
`apps/rust-api/src/modules/badges` (badge-ranking helper functions
plus `CrossTenantBadgesService`, called in-process by
`profiles/service.rs`, with no HTTP surface). Converting one of these
to a standalone gRPC service is wrong: it belongs inlined as a
library dependency, not behind a network call for every use. Check
for a `handlers.rs`/`routes.rs` (nID) or a route file registered in
`main.rs` (Communicator) before starting — if there isn't one, skip
the module and note why in `CONVENTIONS.md`'s tracking section (see
the existing `badges` note there for the exact wording pattern).

### 1.4 Prefer the smallest clean candidate

Among the zero-coupling candidates, split the smallest one next
(`wc -l` the route+service files, or the whole module folder for
nID). This keeps each PR reviewable and keeps the "convert one module,
verify, commit" loop fast. Do not batch multiple modules into one
commit.

---

## 2. Naming — "one name, five places," and the drift to watch for

Per `CONVENTIONS.md` §2, the module's name should be identical
everywhere it appears. **In practice, this session's own history
drifted**: the first few modules split in each repo used kebab-case
for the crate/service folder (`crates/kb-documents`,
`services/kb-documents`, `crates/tenant-staff`), while every module
split afterward used snake_case to match the proto package and Rust
module conventions (`crates/conversation_search`,
`services/cx_qa_scoring`, `crates/departments` is the exception that's
already snake-free since it has no underscore). **Snake_case is the
rule going forward** — it matches the proto package name
(`newax.<module>.v1`, always snake_case) and avoids a mismatch between
the crate's directory name and its module path. Do not "fix" the
already-kebab-case folders as a side effect of an unrelated module's
split; that's a separate, scoped cleanup if anyone decides to do it.

Concretely, for a module named `my_module`:

| Where | Spelling | Example |
|---|---|---|
| Proto package | `newax.my_module.v1` | always snake_case |
| Proto file path | `proto/<repo>/my_module/v1/my_module.proto` | snake_case folder + filename |
| Crate folder | `crates/my_module/` | snake_case |
| Crate package name (`Cargo.toml` `name =`) | `newax-my-module` | kebab-case (Cargo convention) |
| Crate lib name (`Cargo.toml` `[lib] name =`, Communicator only) | `newax_my_module` | snake_case (this is the Rust `use` path) |
| Service folder | `services/my_module/` | snake_case |
| Service package/binary name | `svc-my-module` | kebab-case |
| `crates/proto` registration module | `pub mod my_module { pub mod v1 { ... } }` | snake_case |
| Env var prefix | `MY_MODULE_SERVICE_URL`, `MY_MODULE_PORT` | SCREAMING_SNAKE_CASE |

nID's `crates/*` crates have no `[lib]` section in `Cargo.toml` (see
§4.2) — the crate name itself (hyphenated in `name =`) is what Rust
exposes as the `use` path with hyphens turned to underscores
automatically, so `newax-tenant-staff` is used as
`newax_tenant_staff` in code without a separate `[lib] name` line.
Communicator's crates do set `[lib] name = "newax_my_module"`
explicitly — follow whichever pattern the most recently split module
in that repo used, since both compile, and consistency inside one
repo matters more than matching the other repo's `Cargo.toml` shape.

---

## 3. Folder/worktree layout you will create

For a module named `my_module`, you create exactly these new paths
(nothing else — never touch files outside them except the specific
edits in §7 and §8):

```
proto/<repo>/my_module/v1/my_module.proto      # new
crates/my_module/Cargo.toml                    # new
crates/my_module/src/lib.rs                    # new (moved logic)
services/my_module/Cargo.toml                  # new
services/my_module/build.rs                    # new
services/my_module/src/main.rs                  # new
```

Plus edits (never full rewrites) to three files that already exist:

```
crates/proto/src/lib.rs      # add one `pub mod my_module { pub mod v1 { ... } }` block
crates/proto/build.rs        # add one path to the PROTOS const/list
<the monolith's route or service file>   # rewritten as a thin gRPC client (§8)
```

And removal of the old in-process logic (§8.3):

```
backend-rs/src/services/<module>.rs           # Communicator: deleted (git mv to crates/<module>/src/lib.rs is fine — see note)
backend-rs/src/services/mod.rs                 # Communicator: `pub mod <module>;` line removed
apps/rust-api/src/modules/<module>/service.rs  # nID: rewritten in place as a gRPC client, NOT deleted
                                                # (handlers.rs/dto.rs/routes.rs/mod.rs stay untouched)
```

You never need to touch `[workspace] members` in the root
`Cargo.toml` of either repo — both already use the globs
`"crates/*"` and `"services/*"`, so a new crate/service directory is
picked up automatically the moment it has a `Cargo.toml` in it. Verify
this is still true before you start (`grep -A5 "\[workspace\]"
Cargo.toml`); if someone ever changes it to an explicit list, you will
need to add your two new entries there too.

---

## 4. Writing the proto file

### 4.1 Decide: fully-typed messages, or a JSON envelope?

Look at what the monolith's **route handlers** currently return, not
the service's internal types:

- If every handler does `Ok(Json(some_concrete_struct))` (the struct
  is a real `#[derive(Serialize)]` type, not `serde_json::Value`) →
  write fully-typed `.proto` messages mirroring those structs field
  for field. This is the common case
  (`cx_qa_scoring`, `tone_of_voice`, `ab_testing`, `departments`,
  `subjects`, `invitations`, `account_verification` all did this).
- If most handlers do `Ok(Json(serde_json::to_value(x)?))` or already
  return `Json<serde_json::Value>` — i.e. the original code itself
  treats the payload as dynamic JSON, not a fixed shape — use the
  pragmatic envelope instead:
  ```protobuf
  message JsonResponse {
    string json = 1;
  }
  message Empty {}
  ```
  and make every RPC that would otherwise need a dozen near-duplicate
  message types just return `JsonResponse`, with the service crate
  doing `serde_json::to_string(&real_struct)` and the client side
  doing `serde_json::from_str`. `kb_documents`, `embed_widget`,
  `help_center`, large parts of `monitoring`, `reply_integration`,
  `unified_analytics`, and `in_app_messaging` all used this — it is
  not a lesser pattern, it is the right one when the source was
  already dynamic. **Never invent a fixed shape the original code
  didn't have.**
- A module can mix both within one `.proto` file — type the RPCs whose
  source type was concrete, envelope the ones that weren't. Several
  modules did exactly this (e.g. `monitoring`'s `GetDashboardSummary`
  returning `JsonResponse` while every other RPC in the same service
  is fully typed).

### 4.2 Proto file skeleton

```protobuf
syntax = "proto3";

package newax.my_module.v1;

service MyModuleService {
  rpc DoThing(DoThingRequest) returns (DoThingResponse);
  // one rpc per route handler, same order as the handlers appear
  // in the monolith's route file — makes the main.rs diff easy to
  // read against the proto file side by side.
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

- One `.proto` file per module, one `service` block per module (never
  split one module's RPCs across two services).
- RPC names are PascalCase verbs matching the source function name
  (`get_summary` → `GetSummary`, `list_qa_rules` → `ListQaRules`).
- A `serde_json::Value` field inside an otherwise-typed message
  becomes a `string ..._json = N;` field (see `rules_json`,
  `config_json`, `metadata_json`, `forbidden_phrases_json` across
  existing protos) — never try to represent arbitrary JSON as a proto
  `map` or `Struct` type; stringify it and re-parse on both ends.
- A `Vec<String>` becomes `repeated string`; a `HashMap<String, f64>`
  becomes `map<string, double>` (used once, in `ab_testing`'s
  `VariantStats` — proto maps work fine when the value type is a
  scalar, just not when it needs to be `optional`).
- Request messages that exist purely to carry an ID take the pattern
  `message IdRequest { string id = 1; }` and are reused across every
  RPC in the module that just needs one ID — don't make a new
  single-field message per RPC.

---

## 5. Writing the crate (`crates/my_module/`)

### 5.1 `Cargo.toml`

Communicator pattern (plain crates-dir member, no workspace
inheritance — this repo's `backend-rs`/`crates`/`services` don't use
`[workspace.dependencies]`):

```toml
[package]
name = "newax-my-module"
version = "0.1.0"
edition = "2021"

[lib]
name = "newax_my_module"
path = "src/lib.rs"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"                                   # only if the module uses JSON values
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres"] }
chrono = { version = "0.4", features = ["serde"] }  # only if the module uses timestamps
uuid = { version = "1", features = ["v4"] }         # only if the module generates IDs
anyhow = "1"                                        # only if the source used anyhow::Error
rand = "0.8"                                        # only if the source used rand (e.g. ab_testing)
```

nID pattern (this repo's root `Cargo.toml` declares
`[workspace.dependencies]` — reuse them with `{ workspace = true }`
instead of pinning versions again):

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
Communicator's or nID's crates happen to have elsewhere.

### 5.2 `src/lib.rs` — moving the logic

This is almost always a **near-verbatim copy** of the monolith's
service file/`service.rs`, with exactly one structural change: the
struct's database handle changes from the monolith's wrapper type to
a plain pool, and every method stops taking `&AppState`/no-longer
needs the wrapper's extra methods:

- **Communicator**: `pub struct XService { pool: PgPool }` — this is
  usually *already* the shape (most Communicator services already
  take `&PgPool` or `Pool<Postgres>` directly, not `&AppState`), so
  often nothing changes here beyond copying the file. Check: does
  `fn new(pool: &PgPool)` or `fn new(pool: Pool<Postgres>)` already
  exist? If the source instead has free functions taking `&AppState`
  (e.g. `tone_of_voice`, `ab_testing`'s predecessors, `monitoring`
  before its split), change every `&AppState` parameter to `&PgPool`
  and every `state.db` reference to the parameter name directly — the
  function bodies themselves don't change.
- **nID**: `pub struct XService { db: DbPool }` becomes `pub struct
  XService { db: PgPool }`. Every `let mut conn = self.db.get().await?`
  (a pooled connection from the wrapper) becomes just using `&self.db`
  directly with sqlx's `Executor` trait (sqlx accepts `&PgPool`
  anywhere it accepts a connection). If the original used
  `self.db.inner().begin()` for an explicit transaction (because it
  needed to run `SELECT set_config('app.tenant_id', ...)` for
  row-level security before further queries in the same transaction —
  see `subjects`), keep the transaction: call `self.db.begin().await?`
  on the plain `PgPool` instead, which does the same thing.
- DTOs/request types that lived in the monolith's `dto.rs` (nID) do
  **not** move to the crate as-is if they used `serde` attributes
  tied to the HTTP wire format (`#[serde(rename_all = "camelCase")]`,
  `#[serde(default)]`). The crate's request/response structs are
  plain Rust structs with **no serde attributes** (they are never
  (de)serialized directly — the proto layer and the monolith's own
  `dto.rs` handle the wire formats on their respective sides). Give
  them `#[derive(Debug, Default)]` instead where the original used
  `Deserialize`.
- Keep any `#[cfg(test)] mod tests` block from the source file — it
  moves with the rest of the code unchanged.
- Preserve bugs. If the source code has an existing bug (e.g.
  `compliance_dashboard`'s `update_gdpr_request`, which builds a
  dynamic `UPDATE ... SET` query with N placeholders but only ever
  binds `binds[0]`), **do not fix it while migrating**. The module
  split must be behavior-preserving; file a separate note if you spot
  something worth fixing later, but fix it in its own commit, not
  bundled into the split.

---

## 6. Writing the service (`services/my_module/`)

### 6.1 `Cargo.toml`

```toml
[package]
name = "svc-my-module"
version = "0.1.0"          # or version.workspace = true for nID
edition = "2021"           # or edition.workspace = true for nID

[[bin]]
name = "svc-my-module"
path = "src/main.rs"

[dependencies]
newax-my-module = { path = "../../crates/my_module" }
tonic = "0.12"
prost = "0.13"
tokio = { version = "1", features = ["full"] }      # or { workspace = true } for nID
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres"] }
serde_json = "1"      # needed whenever main.rs itself calls serde_json (JSON envelope RPCs,
                       # or a `json_ok`/`parse_json` helper) — not just because the crate needs it
serde = { version = "1", features = ["derive"] }   # only if main.rs defines a generic
                                                      # `json_ok<T: serde::Serialize>` helper
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
dotenvy = "0.15"

[build-dependencies]
tonic-build = "0.12"
```

### 6.2 `build.rs`

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure().compile_protos(
        &["../../proto/<repo>/my_module/v1/my_module.proto"],
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
use newax_my_module as logic;          // or `use newax_my_module::{Thing, MyModuleService};`
use sqlx::postgres::PgPoolOptions;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

pub mod proto {
    tonic::include_proto!("newax.my_module.v1");
}

use proto::{
    my_module_service_server::{MyModuleService, MyModuleServiceServer},
    // ... every message type main.rs constructs or destructures
};

struct Svc {
    pool: sqlx::PgPool,   // Communicator; nID's struct instead wraps the logic
                          // crate's own service struct directly, see below
}

fn to_status<E: ToString>(e: E) -> Status {
    Status::internal(e.to_string())
}

// one conversion function per message type that needs mapping between
// the logic crate's plain struct and the generated proto struct —
// name them `<thing>_to_proto` / `<thing>_from_proto` consistently.

#[tonic::async_trait]
impl MyModuleService for Svc {
    async fn do_thing(&self, req: Request<proto::DoThingRequest>) -> Result<Response<proto::DoThingResponse>, Status> {
        let r = req.into_inner();
        let result = logic::do_thing(&self.pool, &r.some_field).await.map_err(to_status)?;
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

    // Communicator always reads DATABASE_URL only.
    // nID reads APP_DATABASE_URL first, falling back to DATABASE_URL.
    let database_url = std::env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL must be set (shared Communicator Postgres instance)")?;
    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;

    let port: u16 = std::env::var("MY_MODULE_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(PORT);
    let addr = format!("0.0.0.0:{port}").parse()?;

    info!(port, "svc-my-module starting (gRPC)");
    Server::builder()
        .add_service(MyModuleServiceServer::new(Svc { pool }))
        .serve(addr)
        .await?;
    Ok(())
}
```

nID's version constructs the logic crate's own service struct once
and stores *that* in `Grpc { service: MyModuleService }`, rather than
holding the raw pool and re-constructing the logic service per call —
either works, but match whatever the most recently split module in
that repo does (nID's `departments`/`subjects`/`invitations`/
`account_verification` all hold the constructed service; Communicator's
modules all hold the raw pool and call
`logic::MyModuleService::new(&self.pool)` per request). Consistency
within a repo matters more than cross-repo uniformity here.

### 6.4 Port allocation

Ports are a single incrementing counter **per repo**, not shared
across repos (Communicator and nID each started their own block:
Communicator at 50061, nID at 50071). **Check `CONVENTIONS.md`'s
tracking table for the highest port already used in your target
repo and take the next integer** — do not leave gaps, and do not
reuse a port even if the module that used it was later renamed.

Env var name: `<MODULE_SCREAMING_SNAKE>_PORT` for the service's own
listen port, and `<MODULE_SCREAMING_SNAKE>_SERVICE_URL` for the
client-side override (used only by the monolith's thin-client code in
§8, defaulting to `http://127.0.0.1:<port>`).

---

## 7. Registering the module in `crates/proto`

`crates/proto` is the one shared crate that generates **client-only**
stubs for every split module, so the monolith (and any other module
that needs to call this one) depends on one pre-generated copy instead
of each caller regenerating its own.

Edit `crates/proto/src/lib.rs`, appending (never reordering existing
entries):

```rust
pub mod my_module {
    pub mod v1 {
        tonic::include_proto!("newax.my_module.v1");
    }
}
```

Edit `crates/proto/build.rs`, appending one path to the list (the
exact variable name differs slightly between repos — Communicator
calls it `PROTOS`, nID the same — but both are a `&[&str]` passed to
one `compile_protos` call with `.build_server(false)`):

```rust
"../../proto/<repo>/my_module/v1/my_module.proto",
```

Do not add a new `tonic_build::configure()` call — there is exactly
one, covering every module's proto file in one compile pass.

---

## 8. Rewriting the monolith side

The old in-process logic is replaced by a thin gRPC client with the
**exact same public function/handler signatures** as before, so
nothing downstream of it needs to change.

### 8.1 Communicator: rewrite the route file

The route file (`backend-rs/src/routes/<module>.rs`) becomes the gRPC
client. Pattern:

```rust
//! <original doc comment>
//!
//! Thin gRPC client forwarding to svc-my-module; REST shape unchanged.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use crate::db::AppState;   // or crate::AppState, whichever the original used

use newax_proto::my_module::v1::{
    my_module_service_client::MyModuleServiceClient,
    // ... every request/response message this file constructs
};

async fn client() -> Result<MyModuleServiceClient<tonic::transport::Channel>, (StatusCode, String)> {
    let url = std::env::var("MY_MODULE_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:<PORT>".to_string());
    MyModuleServiceClient::connect(url)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("my-module service unavailable: {e}")))
}

fn grpc_err(e: tonic::Status) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.message().to_string())
}

// Re-declare every response type the handlers return, with
// #[derive(Serialize)] (and Deserialize on request bodies), EXACTLY
// matching the field names/shape the old service module used — this
// is what keeps the REST contract byte-identical. If you used fully
// typed proto messages, write `_to_grpc`/`_from_grpc` conversion
// functions here, mirroring the ones in services/my_module/src/main.rs
// but in the opposite direction.

pub async fn get_summary(State(_state): State<AppState>) -> Result<Json<Summary>, (StatusCode, String)> {
    let mut c = client().await?;
    let resp = c.get_summary(Empty {}).await.map_err(grpc_err)?.into_inner();
    Ok(Json(/* converted resp */))
}
// ... one handler per original handler, same fn name, same signature,
// same route attributes if any were declared inline, same behavior on
// error (same StatusCode mapping the original used — check whether
// the original distinguished 404 vs 400 vs 500 by message content and
// preserve that exact logic in the new grpc_err/not_found_err helpers).
```

The `State(state)` parameter becomes `State(_state)` (still present,
now unused, because axum's router type still expects it — do not
remove the parameter, prefix it with `_` instead).

If the module used a JSON envelope (§4.1), the handler bodies collapse
to:

```rust
pub async fn get_summary(State(_state): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let mut c = client().await?;
    let resp = c.get_summary(Empty {}).await.map_err(grpc_err)?.into_inner();
    Ok(Json(serde_json::from_str(&resp.json).unwrap_or_default()))
}
```

### 8.2 nID: rewrite `service.rs` only

Unlike Communicator, nID's `service.rs` is rewritten **in place as a
gRPC client** — `handlers.rs`, `dto.rs`, `routes.rs`, and `mod.rs` are
**not touched at all**. The struct keeps its exact name and
constructor signature:

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

async fn client() -> Result<MyModuleServiceClient<tonic::transport::Channel>> {
    let url = std::env::var("MY_MODULE_SERVICE_URL").unwrap_or_else(|_| "http://127.0.0.1:<PORT>".to_string());
    MyModuleServiceClient::connect(url).await.map_err(|e| anyhow!("my-module service unreachable: {e}"))
}

impl MyModuleService {
    pub fn new(db: DbPool, env: AppEnv) -> Self {
        Self { db, env }
    }

    pub async fn do_thing(&self, /* same params as before */) -> Result</* same return type */> {
        let mut c = client().await?;
        let resp = c.do_thing(/* grpc request built from params */)
            .await
            .map_err(|e| anyhow!(e.message().to_string()))?;
        Ok(/* converted resp */)
    }
    // ... one method per original method, identical signature
}
```

`db` and `env` are kept as dead, `#[allow(dead_code)]`-annotated
fields even though the gRPC client version never uses them — removing
them would change `MyModuleService::new`'s signature, which would
ripple into `main.rs`'s construction call for no benefit.

### 8.3 Delete the old in-process logic (Communicator only)

Communicator's old `backend-rs/src/services/<module>.rs` is deleted
outright (its content already moved verbatim into
`crates/<module>/src/lib.rs` — `git mv` followed by edits, or a plain
`rm` after copying, produces the same result; git will often detect
the rename on its own and show it as `R` in `git status`). Remove its
`pub mod <module>;` line from `backend-rs/src/services/mod.rs`.

nID has no equivalent deletion step — `service.rs` is rewritten, not
removed (§8.2).

---

## 9. Handling discovered in-process coupling

If §1.2's grep found a real caller outside the module's own route
file (the `reply_integration` case — `reply_engine.rs` called
`ReplyIntegrationService` directly), do not let that block the split.
Instead:

1. Add the new crate (`crates/<module>`) as a normal Rust dependency of
   the monolith binary itself (`backend-rs/Cargo.toml` or
   `apps/rust-api/Cargo.toml`), the same way `newax-proto` is already
   a dependency there.
2. Change the other caller's `use crate::services::<module>::...`
   (or `crate::modules::<module>::...`) import to
   `use newax_<module>::...` instead, and update the type path at each
   call site. The caller keeps calling the logic in-process — it does
   **not** go through gRPC — because this is an internal monolith
   call, not a cross-service call; routing it through gRPC would add
   latency and a new failure mode for zero benefit.
3. Document the resolution in `CONVENTIONS.md`'s tracking section (see
   the existing `reply-integration` paragraph there for the exact
   wording pattern) so the next person who hits this doesn't have to
   re-derive the same decision.

---

## 10. Verification (mandatory before every commit)

```bash
# Communicator
cd backend-rs/.. && SQLX_OFFLINE=true cargo check --workspace

# nID
cd apps/rust-api/.. && cargo check --workspace
```

Both must finish with `Finished` and **zero lines starting with
`error`** (warnings are fine and expected — the baseline is in the
hundreds and stays roughly flat; check the warning count didn't jump
unexpectedly, which usually means something didn't get wired up).

Never commit a module split that hasn't been checked this way. Never
batch two modules' changes into one `cargo check` pass and one
commit — if something fails, you need to know which module broke it.

---

## 11. Commit and push

One commit for the module split itself:

```
Split <module> out of <backend-rs|apps/rust-api> into a real gRPC service

<N> of ~<total> <backend-rs|apps/rust-api> modules now split. Port
<port>, <fully typed proto|JSON-envelope RPCs> (<one-line reason for
the choice, e.g. "all response shapes were already concrete structs"
or "every route already round-tripped through serde_json::Value">).
Zero cross-module coupling (<what you checked>); REST paths/payload
shapes unchanged.
```

If §9 applied, add a paragraph naming the discovered coupling and how
it was resolved, matching the `reply-integration` commit's wording
pattern.

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
own commit:

1. In `CONVENTIONS.md`'s "crates/services split: in progress, tracked
   here" section:
   - Bump the "eighteen real modules split so far" count (in both the
     prose sentence and by adding a table row).
   - Add one row to the table: `| my-module | <Communicator|nID> |
     \`crates/my_module\` | \`services/my_module\` | <port> |`.
   - Decrement the "~N more modules in Communicator's `backend-rs`"
     and/or "~N more in nID's `apps/rust-api`" remaining counts by one,
     whichever repo you split in.
   - If §9 applied, add the discovered-coupling paragraph.
   - If §1.3 applied (skipped a non-candidate module), add a note
     about it instead of a table row, matching the existing `badges`
     note's wording.
2. Copy the edited `CONVENTIONS.md` into the other repo byte-for-byte:
   ```bash
   cp CONVENTIONS.md ../<other-repo>/CONVENTIONS.md
   diff CONVENTIONS.md ../<other-repo>/CONVENTIONS.md   # must print nothing
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
- [ ] Chose fully-typed vs JSON-envelope per §4.1, based on what the
      *handlers* actually returned, not guessed
- [ ] `proto/<repo>/<module>/v1/<module>.proto` written: one service
      block, RPC order matches handler order, every `Option<T>` field
      marked `optional`, every `serde_json::Value` field is a
      `string ..._json` field
- [ ] `crates/<module>/Cargo.toml` lists only the dependencies the
      moved code actually uses
- [ ] `crates/<module>/src/lib.rs` is the moved logic, taking a plain
      `PgPool` (not `AppState`/`DbPool`), with no serde wire
      attributes on its request/response structs, test module
      preserved, no bugs silently fixed
- [ ] `services/<module>/Cargo.toml`, `build.rs`, `src/main.rs`
      written; port taken from `CONVENTIONS.md`'s table + 1, not
      reused
- [ ] `crates/proto/src/lib.rs` and `crates/proto/build.rs` both
      updated, appended (not reordered)
- [ ] Communicator: route file rewritten as gRPC client, same handler
      names/signatures/status-code-mapping logic; old
      `services/<module>.rs` deleted; `services/mod.rs` line removed
- [ ] nID: `service.rs` rewritten as gRPC client in place, same struct
      name/constructor signature; `handlers.rs`/`dto.rs`/`routes.rs`/
      `mod.rs` untouched
- [ ] `cargo check --workspace` run (with `SQLX_OFFLINE=true` for
      Communicator) and confirmed zero errors
- [ ] Module-split commit made and pushed to the session's branch
- [ ] `CONVENTIONS.md` updated in both repos (count, table row,
      remaining-count decrement, any coupling/skip note) and pushed as
      its own commit, with the two copies verified byte-identical via
      `diff`
