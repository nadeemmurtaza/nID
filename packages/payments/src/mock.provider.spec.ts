import { MockPaymentProvider } from './mock.provider';

const provider = new MockPaymentProvider({ checkoutUiUrl: 'http://localhost:3500' });

describe('MockPaymentProvider', () => {
  it('returns a mock-pay URL on the checkout UI, keyed by a fresh provider ref', async () => {
    const result = await provider.createCheckout({
      amountMinor: 11800n,
      currency: 'PKR',
      description: '10,000 verification credits',
      reference: 'intent_1',
      returnUrl: 'http://localhost:3500/return/token_1',
      webhookUrl: 'http://localhost:4000/v1/billing/webhooks/mock',
    });

    expect(result.providerRef).toMatch(/^mock_[0-9a-f]{16}$/);
    expect(result.checkoutUrl).toBe(`http://localhost:3500/mock-pay/${result.providerRef}`);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('never hands back the same provider ref twice', async () => {
    const input = {
      amountMinor: 100n,
      currency: 'PKR',
      description: 'x',
      reference: 'intent_2',
      returnUrl: 'r',
      webhookUrl: 'w',
    };
    const a = await provider.createCheckout(input);
    const b = await provider.createCheckout(input);
    expect(a.providerRef).not.toEqual(b.providerRef);
  });

  it('refuses the webhook protocol — the dev mock-payment endpoint is the settlement path', () => {
    expect(provider.verifyWebhook(Buffer.from('{}'), {})).toBe(false);
    expect(() => provider.parseWebhook(Buffer.from('{}'))).toThrow(/dev mock-payment endpoint/);
  });

  it('maps the configured outcome onto fetchPayment', async () => {
    const failing = new MockPaymentProvider({ checkoutUiUrl: 'http://x', outcome: 'failure' });
    expect((await failing.fetchPayment('mock_abc')).status).toBe('FAILED');
    expect((await provider.fetchPayment('mock_abc')).status).toBe('PENDING');
  });
});
