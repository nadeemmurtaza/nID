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
