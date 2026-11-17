# NEWAX Ecosystem — Cross-Project Communication & Identity Sync

> Applies ecosystem-wide (nID, Communicator, core-newax, erp-1, newcom,
> harvester, AegisDesk), same as `ECOSYSTEM.md` and `CONVENTIONS.md`.

## The premise, corrected first

"Synchronized in real time within no time" isn't an achievable target
and isn't what you actually want. nID and Communicator are separate
databases in separate repos; any update to one has to cross a process
boundary before the other can see it, and that crossing takes a
non-zero number of milliseconds no matter what transport you pick.
What you actually want, and what this doc specifies, is: **exactly one
owner per ID, sub-second propagation to everyone else, and no window
where two modules disagree about who an ID belongs to.** That's
achievable. "Zero latency, two independent databases" is not — anyone
who promises you that is hiding a distributed transaction, and
distributed transactions are themselves a security and reliability
liability (they hold locks across a network boundary, which is exactly
the kind of cross-repo coupling `ECOSYSTEM.md`'s "no repo calls
another repo directly" rule exists to prevent).

## Who owns which ID (restates `ECOSYSTEM.md`, made concrete)

| ID | Owner | Everyone else |
|---|---|---|
| `tenant_id`, `org_id`, account/session identity | **nID** | holds a synced, read-only copy |
| `customer_id` / `consumer_id` (end-customer identity) | **nID** | same — a "customer" is a person, and people are identity, which is nID's domain regardless of which module first saw them |
| `product_id`, catalog/inventory | **erp-1** (per `ECOSYSTEM.md`'s ownership table) | Communicator's commerce-adjacent features (orders, carts shown in conversations) hold a synced copy, never a second source of truth |
| conversation/contact/message IDs | **Communicator** | nID/erp-1 never need these; if they ever do, same pattern in reverse |

One module authors an ID. Every other module that needs it keeps a
materialized, eventually-consistent copy it updates only by consuming
that owner's change events — never by querying the owner's database
directly, and never by treating its own copy as authoritative.

## 1. Cross-repo communication (nID ↔ Communicator ↔ erp-1 ↔ ...)

Per `ECOSYSTEM.md`'s one rule, this always goes through `core-newax`'s
Module Gateway (sync) or event bus (async) — never repo-to-repo
directly. This section names the concrete technology for each, since
`ECOSYSTEM.md` names the components but not what they run on.

### Synchronous: two distinct roles, two distinct technologies — do not blur them

This ecosystem uses **gRPC for two different jobs**, and the rule is
strict precisely because the two jobs look similar and are not:

**Role 1 — module-to-module calls themselves: `tonic` + Protobuf,
always, no exceptions.** Any time one module's logic needs another
module's logic — whether both live in the same repo (nID calling nID,
Communicator calling Communicator) or across repos (nID calling
Communicator) — that call is a `tonic` gRPC client against a
`.proto`-defined contract. Never a raw REST call between two internal
services, never an ad hoc JSON-over-HTTP endpoint "just for this one
caller," never a direct Rust function call once the callee has its
own crate+service (that's a layering violation even if it compiles —
see the strict rule in `CONVENTIONS.md`). This is what `tonic` is
for everywhere in this ecosystem: it's the inter-module RPC layer,
full stop, not optional infrastructure to add "later."

**Role 2 — the edge in front of all of it: Pingora, not Envoy.** The
Module Gateway named in `ECOSYSTEM.md` is the thing a request (or
another service's gRPC stream) hits *first* — it terminates TLS,
load-balances across however many instances of a service are running,
and routes each incoming gRPC stream to the right backend module.
That's a distinct job from Role 1 and gets a distinct technology:
**[Pingora](https://github.com/cloudflare/pingora)**, Cloudflare's
Rust proxy framework, chosen over Envoy for the same reason this
ecosystem is Rust end to end — Envoy is a mature, more feature-complete
proxy with a bigger ecosystem (xDS, broad service-mesh tooling), and
that maturity is real; it's also a C++ binary with Envoy's own memory
footprint and operational model bolted onto a stack that is otherwise
Rust everywhere for exactly the RAM/GC reasons in the tech-stack plan.
Pingora already speaks HTTP/2 and proxies gRPC natively, is what
Cloudflare runs at a scale that proves the pattern works, and keeps
the gateway in the same language, same allocator behavior, same
operational story as every service behind it. Use Pingora unless a
specific gap (e.g. an xDS-driven dynamic-routing need Pingora doesn't
cover) forces Envoy for one deployment — that's a deliberate
exception to request, not a default to fall back to.
- **Transport security: mTLS, mandatory, no exceptions**, terminated
  at Pingora for external/edge traffic and carried through to each
  backend service. Every service presents a client certificate; the
  gateway and every peer verify it. Certificates are short-lived and
  minted/rotated by nID (the ecosystem's identity provider, extended
  to service identity, not just human identity) and delivered only
  through each environment's secrets vault — never committed, never
  passed as a bare API key in an env var that outlives rotation.
- **Authorization on top of transport security:** a short-lived
  service JWT (also minted by nID, ~15 minute TTL) carried per-call,
  scoped to which module-to-module calls it's allowed to make. mTLS
  proves *which service* is calling; the JWT proves *what it's
  allowed to do* — don't rely on network identity alone to authorize
  an action.
- **This is the right place for "give me the current state"**, not for
  "tell everyone this changed" — that's the event bus below. A sync
  call that fans out to notify five other services is the wrong
  pattern; publish one event instead.

### Asynchronous: the event bus — **NATS JetStream**

This is the actual mechanism for "ID changed, propagate it," and the
concrete pick, since `ECOSYSTEM.md` names "the event bus" without
saying what it runs on:

- **Why NATS over Kafka:** per this ecosystem's lowest-RAM priority,
  Kafka's JVM footprint and ZooKeeper/KRaft operational weight are not
  justified at this scale. NATS JetStream is a single small Go binary,
  sub-100ms setup, with built-in persistence, at-least-once delivery,
  and replay — everything this needs, none of the weight Kafka adds.
- **Why NATS over a bespoke Postgres outbox/polling table:** polling
  adds latency proportional to the poll interval and burns CPU/garbage
  on empty polls; NATS pushes, so propagation is bounded by actual
  network latency (tens of milliseconds), not a polling schedule.
- **Subject naming mirrors `CONVENTIONS.md`'s module-naming rule
  exactly:** `newax.<module>.<entity>.<event>`, e.g.
  `newax.identity.tenant.updated`, `newax.identity.customer.merged`,
  `newax.catalog.product.updated`. The module name in the subject is
  the same canonical name as the crate/proto-package/DB-schema — one
  name, now six places instead of five.
- **Security:** NATS's built-in decentralized JWT auth, issued by
  nID — a service gets a NATS account/user JWT scoped to exactly the
  subjects it may publish or subscribe to (Communicator can subscribe
  to `newax.identity.*` but has no business publishing to it). TLS on
  every connection, same certificate-rotation story as the gateway.
- **Idempotency is mandatory, not optional:** at-least-once delivery
  means a consumer may see the same event twice. Every event carries
  an idempotency key (its own event ID is sufficient); every consumer
  upserts keyed on that ID so a duplicate delivery is a no-op, not a
  double-charge or a double-notification.
- **Implementation note:** the gateway and bus themselves belong in
  `core-newax` (outside this session's repo access) — nID and
  Communicator each need a thin client (publish, subscribe, verify)
  against them, not to build them. Flagging the technology choice here
  so both repos' clients are built against the same assumptions.

## 2. Internal communication (within one module, inside one repo)

Nothing changes here, and nothing should: this ecosystem is
modular-monolith-first (`core-newax` ADR 0001). Two modules living in
the same deployed binary talk to each other as **direct function
calls** — no network hop, no serialization, no protocol garbage. A
Rust module calling another Rust module in the same `backend-rs` /
`apps/rust-api` binary does not need gRPC, an event, or a queue; it
needs a function call across a crate boundary.

The moment a module is actually split into its own deployable service
(a real operational reason — independent scaling, independent deploy
cadence — not "it felt more organized"), it stops being "internal" and
becomes exactly the cross-repo case in §1, gRPC/events included, even
if it still lives in the same repo's `services/` directory.

## 3. Third-party platforms (Shopify, Meta, TikTok, and the rest)

No choice to make here — third parties dictate their own protocol, and
every one of them speaks REST + signed webhooks, not gRPC. The
decision is how to contain that, not what transport to use:

- **Inbound:** one dedicated route per provider
  (`/webhooks/<provider>`), signature/HMAC-verified *before* any
  other processing — reject on a bad signature, don't parse the body
  first. Communicator's existing `hmac`/`sha2` dependencies for Meta
  and TikTok webhook verification are already doing this correctly;
  keep that pattern, don't invent a second one per provider.
- **A verified webhook becomes an internal event, not a direct
  mutation.** The webhook handler's only job is "verify, translate to
  our event shape, publish to the bus." Nothing downstream should
  contain provider-specific branching — that stays isolated in the
  adapter.
- **Outbound calls to third parties** use plain authenticated REST
  (API key or OAuth token, always from the secrets vault, never
  hardcoded), with retry/backoff, and are queued rather than made
  synchronously inline with a user-facing request wherever the
  provider's latency isn't something a user should wait on.

## Audit note (2026-11-14, last updated 2026-11-15): what's actually implemented vs. this plan

Honest status, not papered over — see each repo's `CLAUDE.md`/`AGENT.md`
for the corresponding tech-stack compliance note:

- **Intra-repo gRPC exists now, cross-repo still doesn't.** Both repos
  now have real `tonic`/`prost`/`.proto` infrastructure and real split
  services — see `CONVENTIONS.md`'s "crates/services split" table for
  the current, authoritative list (14 Communicator modules, 6 nID
  modules as of this update; that count moves forward, so read the
  table there rather than a count repeated here). Each is a standalone
  gRPC binary with the monolith as a thin client. **This is intra-repo
  only** (a module split out of `backend-rs` / `apps/rust-api`, still
  called only from within that same repo, with one documented
  exception — see `CONVENTIONS.md`'s `reply-integration` note for the
  one case so far where a split module had genuine in-process coupling
  from elsewhere in its own monolith, resolved as a direct crate
  dependency, never gRPC). nID and Communicator still don't call each
  other over any mechanism — the Module Gateway (§1) and NATS event
  bus are still not built, and both still need `core-newax`, which
  this session can't reach.
- **Interim stand-in, not the real Module Gateway:** each split
  service is dialed directly by URL (`<MODULE>_SERVICE_URL`, each
  defaulting to `127.0.0.1:<port>` — see `CONVENTIONS.md`'s table for
  the actual port per module) — no Pingora in front, no mTLS, no
  service JWT, no service discovery. This is a deliberate, flagged
  shortcut to prove the gRPC split pattern (Role 1 above) works end to
  end without being blocked on standing up Pingora (Role 2) first,
  which belongs in `core-newax`. Do not mistake it for the real
  gateway, and do not extend this direct-dial pattern to cross-repo
  calls — that still goes through Pingora once it exists, never
  repo-to-repo directly.
- **§2 and §3 are otherwise still how both repos work** — modules not
  yet split stay in-process, and REST+HMAC webhook adapters still
  handle third parties (Communicator's Meta/TikTok integration).
  Nothing to change there; this doc just makes the existing pattern
  explicit.

### Update 2026-11-16: a first real async-path slice, still not the real bus

`core-newax` is still not reachable from this repo — same situation
as above, re-checked, not just assumed stale. What changed:

- **`crates/event-bus`** is a real NATS JetStream publish client,
  explicitly flagged (see its own doc comment) as a local-dev stand-in
  for `core-newax`'s bus, not the bus itself — same treatment
  `CONVENTIONS.md` requires for the `<MODULE>_SERVICE_URL` gRPC
  interim. Connection failure never blocks the write that triggered a
  publish (nID stays the source of truth regardless of whether the
  event bus is even running).
- **Event contract**: `proto/nid/events/v1/identity_events.proto`
  defines `TenantEvent`, `OrganizationEvent`, `BrandEvent`,
  `CustomerEvent` on subjects `newax.identity.<entity>.<created|
  updated|deleted>`, matching this doc's naming rule. Communicator
  keeps a manually-synced copy of this `.proto` (`crates/identity-
  sync`'s doc comment explains why, and that it needs to move once
  `core-newax` can host one shared copy).
- **Published from nID**: tenant create/update
  (`crates/tenants`), organization create (`crates/organizations`),
  brand create/update/delete (`apps/rust-api/src/modules/brands`,
  still unsplit per `CONVENTIONS.md`'s table), and (as of this same
  day, second pass) account-derived `customer_id` events —
  `crates/accounts`'s `register`/`verify_otp`/`delete_account`. See
  `RULE_VIOLATIONS_AUDIT.md` for what was deliberately left out
  (`login`, `verify_email`) and why.
- **Consumed by Communicator**: `crates/identity-sync` /
  `services/identity-sync`, a durable JetStream pull consumer (not a
  gRPC service) that upserts `synced_tenant`/`synced_organization`/
  `synced_brand`/`synced_customer`, deduped on each event's
  `event_id` via `identity_sync_processed_event`
  (`backend-rs/migrations/0073_identity_sync.sql`) — never treated as
  this repo's source of truth for those IDs.
- **Not done**: the Module Gateway/Pingora synchronous path (§1's
  "Role 2") is still unbuilt — this slice is the async path only, as
  scoped going in. Also not done: running this against a live NATS
  server (none was available in this session) — both sides compile
  (`cargo check --workspace` in nID; the new crates/services in
  Communicator) but the publish→consume round trip is unverified at
  runtime. And a pre-existing, unrelated, previously-undocumented
  violation was found and flagged rather than fixed: Communicator
  already had unused webhook-based tenant/org/brand sync scaffolding
  that itself bypasses this doc's event-bus mandate — see both repos'
  `RULE_VIOLATIONS_AUDIT.md`.
