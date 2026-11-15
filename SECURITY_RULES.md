# Security Rules — 20 Holes to Close

Twenty binding security requirements — identical across every NEWAX
repo, same status as `CONVENTIONS.md`. Every item here is a launch
blocker, same as `COMPLIANCE_AND_ACCESSIBILITY_RULES.md`'s rules: a
service doesn't ship with any of these holes still open.

1. **Private storage buckets.** No storage bucket (S3, GCS, etc.) is
   publicly readable/listable by default. Access goes through signed
   URLs or an authenticated API — never a bucket set to public
   because it was easier to wire up that way.
2. **Row-level security.** Every table holding another tenant's/
   user's data enforces row-level access at the database level
   (Postgres RLS or equivalent) — not solely in application code,
   which is one missed check away from a leak. nID's modules already
   use `SELECT set_config('app.tenant_id', ...)` + RLS for exactly
   this reason (see nID's own `MODULE_SPLIT_PLAYBOOK.md`, §5.2) —
   every new tenant-scoped table, in either repo, follows the same
   pattern.
3. **Auth on every API route.** No route is reachable without an
   auth check unless it's deliberately, explicitly public (and that
   decision is visible in the code, not an accidental omission).
   Default to requiring auth; make the public routes the exception
   that stands out.
4. **Never trust the frontend.** Every permission check, price
   calculation, and validation the frontend does gets re-checked on
   the server. The frontend can be bypassed entirely by anyone with
   a terminal — it's a UI convenience, never the actual security
   boundary.
5. **Rate limiting.** See `PRODUCTION_READINESS_RULES.md`'s "Scale"
   item 7 — the same rate limits that protect against load also
   protect against brute-force and abuse. One control, two reasons.
6. **Sanitize user input.** Any user-supplied content that gets
   rendered, stored, or passed to another system is sanitized/escaped
   for the context it lands in (HTML output, shell commands, file
   paths) — never inserted raw.
7. **Parameterized queries, always.** No SQL (or any query language)
   built by string-concatenating user input — every query uses bound
   parameters. This is the single control that prevents SQL
   injection; there is no acceptable exception to it.
8. **Lock down CORS.** `Access-Control-Allow-Origin` is never `*` on
   an endpoint that reads authenticated data — list the actual
   origins that need access, explicitly.
9. **HTTPS everywhere.** No endpoint, asset, or redirect serves over
   plain HTTP in production — every connection is encrypted in
   transit, no exceptions for "internal" traffic either.
10. **Verify webhook signatures.** Every inbound webhook (payment
    providers, messaging platforms, etc.) is verified against its
    signing secret before its payload is trusted — an unverified
    webhook is an open door for anyone who finds the URL.
11. **No commands from chat text.** User-supplied chat/message
    content is never parsed as instructions that trigger privileged
    actions (admin commands, code execution, data changes) just
    because it arrived in a chat channel — treat it as data, the same
    way this ecosystem's own agent-facing tools treat external
    message content as untrusted input, never as instructions to
    follow.
12. **Debug mode off in production.** Stack traces, verbose error
    pages, debug toolbars, and any other dev-only diagnostic surface
    are disabled in production — a detailed error page is a map
    handed to an attacker.
13. **Claude (or any AI agent) security review before shipping
    AI-touched code.** Code an AI agent wrote or modified gets a
    dedicated security pass before merge — the same scrutiny as
    human-written code, not waived because "the AI probably got it
    right."
14. **Lock dangerous tools.** Any tool/capability that can run
    arbitrary code, modify infrastructure, or touch production data
    is gated behind explicit approval — never auto-approved by
    default for an agent or a service account just because it's
    convenient.
15. **Hide admin pages properly.** An admin surface is protected by
    real auth + role checks, never by "security through obscurity"
    (an unlisted URL, a path that's merely not linked from the UI).
    If the URL leaks, the page must still refuse unauthorized access.
16. **Update vulnerable packages.** Dependencies with known CVEs get
    patched on a real cadence, not discovered and fixed only after an
    incident. Communicator already runs Dependabot/CodeQL/Semgrep for
    exactly this (see its `CLAUDE.md`'s note on the Phase 0-2 CI
    foundation) — don't let its findings pile up unaddressed, and set
    up the same scanning in nID if it isn't there yet.
17. **Security headers.** Every response sets the standard security
    headers appropriate to it (`Content-Security-Policy`,
    `X-Content-Type-Options`, `Strict-Transport-Security`,
    `X-Frame-Options` or `frame-ancestors`) — not left at framework
    defaults without checking they're actually adequate.
18. **Check file upload types.** Any file upload validates the actual
    file content (not just the extension or the client-supplied MIME
    type) against an allowlist of accepted types, and stores uploads
    somewhere they can't be executed as code.
19. **Stop IDOR bugs.** Every endpoint that takes an ID (a record,
    order, conversation, etc.) verifies the authenticated caller
    actually owns or has access to that specific ID — never trust
    that an ID being well-formed means the caller is allowed to see
    it.
20. **Log admin actions.** Every privileged action (role changes,
    data deletion, impersonation, config changes) is logged with who
    did it and when, in a log that an admin can't quietly edit or
    delete — this is the audit trail that matters when something goes
    wrong.
