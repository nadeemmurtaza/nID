# Rapid Gateway — adapter contract as implemented

**Status: PROVISIONAL.** rapidgateway.pk/resources and docs.rapidgateway.pk were
not reachable from the environment that wrote this mapping (2026-10-31). What is
below is the shape `packages/payments/src/rapid-gateway.provider.ts` assumes,
recorded so that correcting it is a bounded edit rather than a hunt.

Everything else in the billing platform is independent of this file. The
`PaymentProvider` interface is the only contract a provider has to satisfy, and
`MockPaymentProvider` already satisfies it. As of this commit that interface, the
mock and Task 1's schema are all of the billing platform that exists: the ledger,
the state machines and the API surface are Tasks 4-13 and `apps/checkout-ui` is
Task 16. Each of them will be written against the interface rather than against
this adapter, which is why correcting this file reaches none of them.

## Assumed

| Item | Assumption | Where to change it |
|---|---|---|
| Sandbox base URL | `https://sandbox.rapidgateway.pk` | `RapidGatewayConfig.baseUrl` (constructor) today — `RAPID_GATEWAY_BASE_URL` does not exist yet; env wiring is Task 9 |
| Auth | `Authorization: Bearer <api key>` + `x-rapidgateway-merchant: <merchant id>` | `RapidGatewayProvider.request` headers |
| Checkout init | `POST /v1/checkout/sessions` with `{merchant_id, reference, amount, currency, description, return_url, webhook_url}` → `{id, checkout_url, expires_at}` | `checkoutPath` + `createCheckout` body |
| Amount units | minor units (paisa), not rupees. An inbound non-integer is rejected as a provider error rather than rounded to a wrong paisa figure, and an outbound amount above 2^53 minor units is refused because JSON would carry it as a rounded float | `wireAmount` (outbound) and `minorUnitsFromWire` (inbound) |
| Status read | `GET /v1/payments/{id}` → `{id, transaction_id, status, amount, currency, method, paid_at}`. `amount` and `currency` are validated, not trusted, and `transaction_id` surfaces as `ProviderPayment.providerTransactionId` | `statusPath` + `RapidPaymentResponse` |
| Status vocabulary | success set `paid/captured/succeeded/...`, failure `declined/rejected/...`, and `canceled/cancelled` in its own CANCELED bucket because a canceled attempt moved no money and owes no refund; anything unrecognised maps to `PENDING`, never to a guessed success | `mapProviderStatus` in `registry.ts` |
| Webhook envelope | `{event_id, event_type, occurred_at, data:{id, transaction_id, status, amount, currency, method}}` | `RapidWebhook` + `parseWebhook` |
| Webhook signature | header `x-rapidgateway-signature`, value `t=<ms>,v1=<hex hmac-sha256("<t>.<rawBody>")>`, 5-minute replay window | `signatureHeader` + `verifyWebhook` (the configured name is lower-cased at lookup, so vendor-style casing works) |
| Refund | `POST /v1/refunds` with `{merchant_id, reference, transaction_id, amount, currency, reason}` → `{id, status, amount, currency}`. Only `id` and `status` map through — `amount`/`currency` appear in the response and are discarded. `status` becomes SUCCEEDED on a success set, FAILED on `failed`/`canceled` and PENDING otherwise, because nothing re-reads a refund once submitted: a decline has to be terminal at this point or it is pending forever | `refundPath` + `refund` |
| Settlement report | not implemented in Phase 1 (Phase 2 reconciliation) | new `fetchSettlement` method |

### Which id is which

`providerRef` is the checkout session (`rg_chk_...`). `providerTransactionId` is
the vendor's own transaction (`rg_txn_...`), surfaced on `ProviderPayment` and
`ParsedWebhook` because `refund()` sends `transaction_id` and nothing else can
reconcile a capture against a settlement. Settle code that stores the session id
in a transaction-id column would refund a transaction that never existed.

## To confirm from the real docs / sandbox credentials

1. Whether checkout is initialized server-to-server (as modelled) or by posting
   a signed HTML form from the payer's browser.
2. Whether the callback signature is HMAC at all, and its header name/format.
3. Whether `amount` is rupees with decimals or paisa.
4. The status enum, verbatim, including partial-capture and dispute states.
5. Whether a reusable mandate/token exists for off-session renewal — spec §7.4
   defaults to invoice-plus-hosted-link precisely because this is unknown.
6. Settlement file format and delivery (SFTP pull vs API push).
7. Raast QR / JazzCash / easypaisa: whether they are the same checkout session
   with a `method` selector or separate products.
8. Whether `apiSecret` is used at all. `RapidGatewayConfig` demands it at boot
   and nothing in the adapter reads it — the assumed auth is the bearer key plus
   the merchant header. Confirm whether Rapid Gateway signs requests with a
   separate secret; if it does not, drop the field rather than keeping a
   mandatory credential that no code consumes.

## Fixtures

`packages/payments/src/rapid-gateway/fixtures/*.json` are the captured shapes
above, plus `refund-failed.json` for the declined-refund case the adapter maps
to `FAILED`. Replace each with a real sandbox capture, then run
`pnpm --filter @nid/payments test` — a failing assertion is the diff between the
assumption and reality.
