# Delivery phases

Full rationale lives in the plan this scaffold was built from. Summary:

- **Phase 0 (this scaffold)** — repo structure, Tenant/Subject/Case/Attempt schema
  with RLS, API-key auth, one method end-to-end: `otp_sms`. Also has, ahead of the
  original Phase 1 plan: a hosted subject-facing verification flow
  (`apps/verify-ui`, token-authenticated via the new `VerificationSession`
  concept), a first-cut tenant dashboard (`apps/dashboard`, API-key
  "login" — no separate staff-account system yet, so this is explicitly a
  Phase 0 simplification, not the Phase 1 dashboard's final auth story), and
  **"Login with nID"** — a portable `Account` identity (phone + OTP,
  passwordless) plus a simplified OAuth-style flow (`apps/login-ui`,
  `apps/api/src/modules/oauth`) any relying-party app can embed a "Continue
  with nID" button for, same-device URL or cross-device QR. `erp-1` also
  already integrates as nID's tenant #1 — see below.
- **Phase 1** — document upload + OCR and liveness (one bought vendor), policy
  composition beyond a single method, wiring the dashboard's staff login onto
  `Account` instead of raw API-key paste (a `TenantStaffMembership` join table
  — "does this Account work for this Tenant" — is the natural next step now
  that `Account` exists, deliberately not built in Phase 0 since nothing
  needed it yet), a case-review queue for `NEEDS_REVIEW` attempts (nothing
  reaches that status yet — only `otp_sms` exists, and it never returns
  `NEEDS_REVIEW`), signed webhooks to more than one tenant.
- **Phase 2** — sanctions/PEP screening, KYB/business-registry lookup, one
  country's national-ID registry adapter, manual-review tooling, retention/audit
  maturity.
- **Phase 3** — self-serve tenant signup, per-method usage metering, billing
  integration, second country's registry adapter, bank-linked verification where a
  viable in-market API exists.
- **Phase 4** — SOC 2 process, public API docs, SLAs, multi-region deployment, pen
  testing. Its own budget line, not a byproduct of Phases 0–3.

`erp-1` already integrates with nID: a `identity-verification` module
implementing an `IdentityVerificationProvider` client against this API,
subscribed to nID's webhook (`erp-1` repo, `docs/implementation/18-identity-verification.md`).
It's off by default there (no `NID_API_URL`/`NID_API_KEY` set) until this
shop has a real nID tenant account and API key from `pnpm db:seed`.

That's a different integration point from "Login with nID": the KYC module
verifies erp-1's *existing* users; erp-1 embedding a "Continue with nID"
button (an `OAuthClient` of its own, seeded the way `packages/db/prisma/seed.ts`
seeds the demo one) so *new* users can sign up/log into erp-1 with their nID
identity is a separate, not-yet-built piece of erp-1-side work.
