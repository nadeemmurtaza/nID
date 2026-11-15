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

See `ecosystem-stack.md` for the ecosystem-wide technology stack and
architecture plan (backend, frontend, database, cache, package
manager) and its honest compliance audit against what's actually
running here — identical content to Communicator's copy except where
this repo's specifics (paths, compliance status) differ.

See `CONVENTIONS.md`'s **"Design anti-patterns — strictly forbidden,
no exceptions"** section for the ecosystem-wide list of banned
visual/copy clichés (gradients, drop shadows, Lucide icons, Inter/
Geist/Space Grotesk, em dashes, bento grids, fake testimonials, and
more, plus a "teach by doing, not by lecturing" product rule — 31
rules total, identical across every NEWAX repo). These bind
every UI surface in this repo with no exceptions; read that section
before building or editing any UI.

See `UX_UI_RULES.md` for the 20 binding rules on how motion,
feedback, and layout should actually behave (Disney's 12 animation
principles adapted for interfaces, plus Fitts's/Hick's/Miller's/
Doherty/Postel's/Jakob's laws and hit-area/frequency-of-use rules) —
identical across every NEWAX repo, same binding status as
`CONVENTIONS.md`. Read it before building or editing any interactive
UI, alongside the anti-patterns section above.

See `COMPLIANCE_AND_ACCESSIBILITY_RULES.md` for 18 binding legal,
anti-dark-pattern, and accessibility requirements (Privacy Policy,
Terms of Service, consent banner, form data-minimization audits,
third-party SDK audits, no dark patterns/hidden fees/fake reviews/
unsupported claims, alt text, color contrast, keyboard navigation,
business details, age/parental consent, unsubscribe links, font/image
licensing, data deletion requests) — identical across every NEWAX
repo. These are launch blockers, not nice-to-haves; read it before
any surface that collects data, sends email, charges money, or
renders UI is considered shippable.

See `PRODUCTION_READINESS_RULES.md` (scale/database/reliability, 20
rules), `SECURITY_RULES.md` (20 security holes to close), and
`SAAS_UX_PATTERNS.md` (20 expected SaaS UX patterns) — all identical
across every NEWAX repo, same binding status as the files above.
Together they're what keeps a service that works fine in dev from
falling over, getting breached, or feeling unfinished the moment it
has real users.
