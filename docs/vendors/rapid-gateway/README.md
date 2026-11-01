# Rapid Gateway — adapter contract as implemented

**Status: PROVISIONAL.** rapidgateway.pk/resources and docs.rapidgateway.pk were
not reachable from the environment that wrote this mapping (2026-10-31). What is
below is the shape `packages/payments/src/rapid-gateway.provider.ts` assumes,
recorded so that correcting it is a bounded edit rather than a hunt.

Everything else in the billing platform is independent of this file: the
PaymentProvider interface, the ledger, the state machines, the API surface and
apps/checkout-ui all work against `MockPaymentProvider` today.

## Assumed

| Item | Assumption | Where to change it |
|---|---|---|
| Sandbox base URL | `https://sandbox.rapidgateway.pk` | `RAPID_GATEWAY_BASE_URL` |
| Auth | `Authorization: Bearer <api key>` + `x-rapidgateway-merchant: <merchant id>` | `RapidGatewayProvider.request` headers |
| Checkout init | `POST /v1/checkout/sessions` with `{merchant_id, reference, amount, currency, description, return_url, webhook_url}` → `{id, checkout_url, expires_at}` | `checkoutPath` + `createCheckout` body |
| Amount units | minor units (paisa), not rupees | `createCheckout` / `refund` `Number(...)` lines |
| Status read | `GET /v1/payments/{id}` → `{id, transaction_id, status, amount, currency, method, paid_at}` | `statusPath` + `RapidPaymentResponse` |
| Status vocabulary | success set `paid/captured/succeeded/...`, failure `declined/rejected/...` | `mapProviderStatus` in `registry.ts` |
| Webhook envelope | `{event_id, event_type, occurred_at, data:{id, transaction_id, status, amount, currency, method}}` | `RapidWebhook` + `parseWebhook` |
| Webhook signature | header `x-rapidgateway-signature`, value `t=<ms>,v1=<hex hmac-sha256("<t>.<rawBody>")>`, 5-minute replay window | `signatureHeader` + `verifyWebhook` |
| Refund | `POST /v1/refunds` with `{merchant_id, reference, transaction_id, amount, currency, reason}` → `{id, status}` | `refundPath` + `refund` |
| Settlement report | not implemented in Phase 1 (Phase 2 reconciliation) | new `fetchSettlement` method |

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

## Fixtures

`packages/payments/src/rapid-gateway/fixtures/*.json` are the captured shapes
above. Replace each with a real sandbox capture, then run
`pnpm --filter @nid/payments test` — a failing assertion is the diff between the
assumption and reality.
