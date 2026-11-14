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

### Synchronous: Module Gateway

- **Protocol: gRPC (`tonic`) + Connect**, Protobuf-schema'd, per the
  ecosystem tech-stack plan in `CLAUDE.md`/`AGENT.md`. Use this for
  "I need this value now to finish handling this request" calls —
  e.g. Communicator validating a session against nID before answering
  an API call.
- **Transport security: mTLS, mandatory, no exceptions.** Every
  service presents a client certificate; the gateway and every peer
  verify it. Certificates are short-lived and minted/rotated by nID
  (the ecosystem's identity provider, extended to service identity,
  not just human identity) and delivered only through each
  environment's secrets vault — never committed, never passed as a
  bare API key in an env var that outlives rotation.
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

## Audit note (2026-11-14): what's actually implemented vs. this plan

Honest status, not papered over — see each repo's `CLAUDE.md`/`AGENT.md`
for the corresponding tech-stack compliance note:

- **Nothing in §1 exists yet.** No `tonic`/`prost`/`.proto` in either
  repo, no NATS, no Module Gateway client. Today, nID and Communicator
  don't talk to each other over any mechanism — this is a plan for
  new infrastructure, not a description of something running.
- **§2 and §3 are already how both repos actually work** — modular
  monolith with in-process calls, and REST+HMAC webhook adapters for
  third parties (Communicator's Meta/TikTok integration). Nothing to
  change there; this doc just makes the existing pattern explicit.
