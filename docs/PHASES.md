# Delivery phases

Full rationale lives in the plan this scaffold was built from. Summary:

- **Phase 0 (this scaffold)** — repo structure, Tenant/Subject/Case/Attempt schema
  with RLS, API-key auth, one method end-to-end: `otp_sms`. Minimal internal admin
  view only.
- **Phase 1** — document upload + OCR and liveness (one bought vendor), policy
  composition beyond a single method, tenant dashboard case-review queue, signed
  webhooks. `erp-1` becomes tenant #1, integrating through the real external API.
- **Phase 2** — sanctions/PEP screening, KYB/business-registry lookup, one
  country's national-ID registry adapter, manual-review tooling, retention/audit
  maturity.
- **Phase 3** — self-serve tenant signup, per-method usage metering, billing
  integration, second country's registry adapter, bank-linked verification where a
  viable in-market API exists.
- **Phase 4** — SOC 2 process, public API docs, SLAs, multi-region deployment, pen
  testing. Its own budget line, not a byproduct of Phases 0–3.

`erp-1` integrating with nID (a new `identity-verification` module implementing an
`IdentityVerificationProvider` client, subscribed to nID's webhook) is tracked as
future work on the `erp-1` side, not part of this repo.
