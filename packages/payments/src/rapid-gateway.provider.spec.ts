import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signWebhookPayload } from '@nid/shared-types';
import { RapidGatewayProvider, type HttpFetch, type RapidGatewayConfig } from './rapid-gateway.provider';

const CONFIG: RapidGatewayConfig = {
  baseUrl: 'https://sandbox.rapidgateway.pk',
  merchantId: 'merch_1',
  apiKey: 'key_1',
  apiSecret: 'secret_1',
  webhookSecret: 'whsec_test',
};

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(__dirname, 'rapid-gateway', 'fixtures', name), 'utf8'));
}

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function fakeTransport(response: unknown, records: Recorded[]): HttpFetch {
  return async (url, init) => {
    records.push({
      url,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: init?.body,
    });
    return { ok: true, status: 200, json: async () => response };
  };
}

describe('RapidGatewayProvider', () => {
  it('creates a checkout and maps the hosted URL, ref and expiry', async () => {
    const records: Recorded[] = [];
    const provider = new RapidGatewayProvider(CONFIG, fakeTransport(fixture('checkout-created.json'), records));

    const result = await provider.createCheckout({
      amountMinor: 11800n,
      currency: 'PKR',
      description: '10,000 verification credits',
      reference: 'intent_abc123',
      returnUrl: 'https://pay.test/return/tok',
      webhookUrl: 'https://api.test/v1/billing/webhooks/rapid-gateway',
    });

    expect(result).toEqual({
      providerRef: 'rg_chk_9f2c81',
      checkoutUrl: 'https://sandbox.rapidgateway.pk/checkout/rg_chk_9f2c81',
      expiresAt: new Date('2026-10-31T12:30:00Z'),
    });
    expect(records[0]!.url).toBe('https://sandbox.rapidgateway.pk/v1/checkout/sessions');
    expect(records[0]!.method).toBe('POST');
    expect(records[0]!.headers.authorization).toBe('Bearer key_1');
    expect(JSON.parse(records[0]!.body!)).toEqual({
      merchant_id: 'merch_1',
      reference: 'intent_abc123',
      amount: 11800,
      currency: 'PKR',
      description: '10,000 verification credits',
      return_url: 'https://pay.test/return/tok',
      webhook_url: 'https://api.test/v1/billing/webhooks/rapid-gateway',
    });
  });

  it('reads a status back through the canonical mapping', async () => {
    const provider = new RapidGatewayProvider(
      CONFIG,
      fakeTransport(fixture('payment-status-succeeded.json'), []),
    );
    const payment = await provider.fetchPayment('rg_chk_9f2c81');

    expect(payment.status).toBe('SUCCEEDED');
    expect(payment.amountMinor).toBe(11800n);
    expect(payment.methodType).toBe('visa');
    expect(payment.paidAt).toEqual(new Date('2026-10-31T12:04:11Z'));
  });

  it('accepts a correctly signed webhook inside the replay window', () => {
    const provider = new RapidGatewayProvider(CONFIG);
    const body = Buffer.from(JSON.stringify(fixture('webhook-payment-succeeded.json')));
    const timestamp = Date.now();
    const signature = signWebhookPayload(CONFIG.webhookSecret, body.toString('utf8'), timestamp);

    expect(
      provider.verifyWebhook(body, {
        'x-rapidgateway-signature': `t=${timestamp},v1=${signature}`,
      }),
    ).toBe(true);
  });

  it('rejects a tampered body and a stale timestamp', () => {
    const provider = new RapidGatewayProvider(CONFIG);
    const body = Buffer.from('{"data":{"status":"paid","amount":1}}');
    const timestamp = Date.now();
    const signature = signWebhookPayload(CONFIG.webhookSecret, 'different', timestamp);

    expect(provider.verifyWebhook(body, { 'x-rapidgateway-signature': `t=${timestamp},v1=${signature}` })).toBe(false);

    const freshSig = signWebhookPayload(CONFIG.webhookSecret, body.toString('utf8'), timestamp - 6 * 60_000);
    expect(
      provider.verifyWebhook(body, { 'x-rapidgateway-signature': `t=${timestamp - 6 * 60_000},v1=${freshSig}` }),
    ).toBe(false);
  });

  it('parses a payment webhook into canonical fields', () => {
    const provider = new RapidGatewayProvider(CONFIG);
    const parsed = provider.parseWebhook(Buffer.from(JSON.stringify(fixture('webhook-payment-succeeded.json'))));

    expect(parsed).toMatchObject({
      providerEventId: 'rg_evt_5c1d02',
      type: 'payment.succeeded',
      providerRef: 'rg_chk_9f2c81',
      status: 'SUCCEEDED',
      paidAmountMinor: 11800n,
      currency: 'PKR',
      methodType: 'visa',
    });
    expect(parsed.occurredAt).toEqual(new Date('2026-10-31T12:04:12Z'));
  });

  it('refuses to parse a webhook whose transaction id is missing', () => {
    const provider = new RapidGatewayProvider(CONFIG);
    const body = Buffer.from(JSON.stringify({ event_id: 'e1', event_type: 'payment.succeeded', data: { id: 'x' } }));
    expect(() => provider.parseWebhook(body)).toThrow(/transaction id/);
  });

  it('submits a refund in minor units and maps its pending state', async () => {
    const records: Recorded[] = [];
    const provider = new RapidGatewayProvider(CONFIG, fakeTransport(fixture('refund-accepted.json'), records));

    const result = await provider.refund({
      providerRef: 'rg_chk_9f2c81',
      providerTransactionId: 'rg_txn_77aa31',
      amountMinor: 2500n,
      currency: 'PKR',
      reason: 'duplicate charge',
    });

    expect(result).toEqual({ providerRef: 'rg_ref_31b0', status: 'PENDING' });
    expect(JSON.parse(records[0]!.body!)).toMatchObject({ transaction_id: 'rg_txn_77aa31', amount: 2500 });
  });

  it('throws a provider error, not a silent null, on a non-2xx response', async () => {
    const provider = new RapidGatewayProvider(CONFIG, async () => ({
      ok: false,
      status: 502,
      json: async () => ({ error: 'bad gateway' }),
    }));
    await expect(
      provider.createCheckout({
        amountMinor: 1n,
        currency: 'PKR',
        description: 'x',
        reference: 'r',
        returnUrl: 'u',
        webhookUrl: 'w',
      }),
    ).rejects.toThrow(/502/);
  });

  it('refuses to construct without credentials rather than failing at first payment', () => {
    expect(() => new RapidGatewayProvider({ ...CONFIG, webhookSecret: '' })).toThrow(/webhookSecret/);
  });
});
