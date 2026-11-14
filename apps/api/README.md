# @nid/api — DEPRECATED, apps/rust-api is canonical

**Do not add new features here.** This NestJS + Prisma backend and
`apps/rust-api` (Rust + SQLx) both bind to the same `API_PORT` (4000 by
default — see root `.env.example`) and serve the same Next.js clients
(`apps/login-ui`, `apps/dashboard`, `apps/profile-ui`, `apps/verify-ui`
all read `NEXT_PUBLIC_NID_API_URL`, not a hardcoded backend choice).
That shared contract is exactly how `apps/rust-api`'s "full auth audit
across all modules" work ported this app's modules
(access/booking/brands/departments/invitations/oauth/
organization_profiles/organizations/permissions/profile_content/
profiles/roles/sessions/subjects/tenant_staff/tenants/
verification_cases) one by one.

**The decision, made explicit rather than left as an open question:**
`apps/rust-api` wins. It matches this ecosystem's tech-stack decision
(Rust + SQLx, no Prisma — see `CLAUDE.md`), and it's where new work on
nID's API has actually been landing. This app is being retired, not
indefinitely maintained alongside it.

**What's actually blocking removal** (so this isn't a vague
"someday"): this app, `apps/workflows` (Temporal activities),
`packages/verification-providers`, and `packages/billing` all still
depend on `packages/db`, which depends on `@prisma/client` — a real
runtime dependency, not just schema notation (see the tech-stack
compliance audit in `CLAUDE.md`). Retiring this app cleanly means
either porting those four consumers off Prisma onto SQLx (matching
`apps/rust-api`'s stack), or deciding `packages/db` stays Prisma
permanently as a deliberately-scoped exception. That's a real,
multi-step migration touching live identity-verification workflows —
not something to execute as a side effect of a naming audit. Until
it's done:

- Route-for-route parity between this app and `apps/rust-api` has
  **not** been verified file-by-file in this pass — the shared-port
  contract is strong evidence they're meant to match, not a proof
  that they do yet. Confirm parity before actually switching which
  one is deployed in any environment that matters.
- Don't build new features on this app. Build them on `apps/rust-api`,
  even if that means porting a bit of this app's existing logic there
  first.
