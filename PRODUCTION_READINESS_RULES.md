# Production Readiness Rules — Scale, Database, Reliability

Twenty binding rules for not crashing under real load — identical
across every NEWAX repo, same status as `CONVENTIONS.md`. The
scenario these exist to prevent: a prototype that works fine in dev,
gets real traffic, and falls over because nothing below was in
place. Treat every rule here as a pre-launch checklist item for any
service that will see production traffic, not aspirational advice.

Rate limiting appears once, here, as item 7 — `SECURITY_RULES.md`'s
item 5 points back to this one instead of restating it; it's both a
scale control and a security control.

## Scale

1. **Vertical vs. horizontal, decided deliberately.** Know which way
   a service scales before it needs to: vertical (bigger machine) is
   simpler and fine for low/predictable load; horizontal (more
   machines) is what survives a real traffic spike. Don't default to
   vertical just because it's less setup — decide based on the
   service's actual load shape.
2. **Load balancer in front of anything with more than one
   instance.** The moment a service runs on more than one machine, a
   load balancer — not a hand-picked "primary" instance — decides
   which one handles each request, and health-checks instances out of
   rotation when they're unhealthy (ties to `Health checks` below).
3. **Design for multiple servers from the start.** No service should
   assume it's the only instance running — no in-memory state that
   silently breaks the moment a second instance exists (session data,
   in-process caches, schedulers that would double-fire). If
   something needs to be shared across instances, it belongs in Redis
   or the database, not a process-local variable.
4. **Auto scaling, not manual scaling.** Capacity should respond to
   actual load automatically (CPU/memory/queue-depth-based scaling
   rules), not require someone to notice traffic is up and manually
   spin up servers after the fact.
5. **CDN in front of static and cacheable content.** Images, JS/CSS
   bundles, and any response that's the same for every user go
   through a CDN, not the origin server, for every request.
6. **Redis cache for anything expensive and frequently re-read.** A
   query or computation that's read far more often than it changes
   gets cached in Redis with a sane TTL — don't hit the database for
   the same unchanged answer on every request.
7. **Rate limiting on every public endpoint.** Every API route the
   outside world can call has a rate limit — per-user and per-IP —
   so one client (malicious or just buggy) can't take down the
   service for everyone else.
8. **Queue + background jobs for anything slow.** Work that isn't
   needed to answer the current request (sending an email, processing
   an upload, generating a report) goes on a job queue, not inline in
   the request/response cycle — a slow background task should never
   make a user wait on an HTTP response.

## Database

9. **Index every column a query filters or sorts on.** A query that
   does a full table scan in production because the right column was
   never indexed is the single most common cause of "it worked in
   dev, it's crawling in prod." Check `EXPLAIN` on anything that looks
   slow before assuming the database itself is the problem.
10. **Connection pooling, always.** Never open a new raw connection
    per request — use a connection pool (pgbouncer, the database
    client's built-in pool, etc.) sized to the database's actual
    connection limit, or a traffic spike will exhaust connections and
    take the whole database down with it.
11. **DB replication for read-heavy load.** Once read traffic is
    significant, read replicas take the read load off the primary so
    writes don't queue up behind reads. Route read-only queries to a
    replica, not the primary, once this is in place.
12. **Sharding when a single database can't hold the data or the
    write load anymore.** Know the plan for splitting data across
    multiple database instances by a partition key before a single
    database actually becomes the bottleneck — retrofitting sharding
    under live load is far harder than designing the partition key in
    from the start.
13. **Pagination + limits on every list endpoint.** No endpoint
    returns an unbounded result set — every list/search query has a
    page size and a hard max, so one query can't return (or let a
    client request) a million rows at once.
14. **Backup + failover, tested, not assumed.** Automated database
    backups exist, and a failover path to a replica/backup actually
    gets tested — a backup that was never restored from, or a
    failover that was never exercised, is unverified, not real.

## Reliability

15. **Health checks on every service.** Every service exposes a real
    health-check endpoint that verifies it can actually do its job
    (DB connection works, not just "the process is running"), and the
    load balancer/orchestrator uses it to route around unhealthy
    instances.
16. **Timeouts + retries on every outbound call.** Every call to
    another service, database, or third-party API has an explicit
    timeout (never "wait forever") and a bounded retry policy with
    backoff — not an unbounded retry loop that hammers a struggling
    dependency harder.
17. **Circuit breaker on dependencies that can fail.** When a
    downstream dependency is failing repeatedly, stop calling it for a
    cooldown period instead of letting every request pile up waiting
    on a call that's going to fail anyway — fail fast instead of
    dragging the whole request down with a dependency that's already
    down.
18. **Monitoring + alerts, before the incident, not after.** Error
    rates, latency, queue depth, and resource usage are tracked and
    someone is actually paged when they cross a threshold — "we'll
    notice if something breaks" is not a monitoring strategy.
19. **Load test with k6 (or equivalent) before launch.** Don't learn
    the system's actual breaking point from real users finding it —
    run a load test against realistic traffic shapes and volumes
    before launch, and again before any change expected to
    meaningfully increase load.
20. **Graceful degradation when something fails.** When a
    non-critical dependency is down (recommendations, a third-party
    widget, an optional enrichment call), the core product keeps
    working with that piece missing or simplified — one failing
    dependency should never take the whole app down. (For how this
    shows up to the user specifically, see `SAAS_UX_PATTERNS.md`'s
    "Graceful Error Recovery" — that's the UI-facing half of this
    same principle.)
