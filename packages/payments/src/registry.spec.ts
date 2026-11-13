import { PaymentProviderConfigError } from './errors';
import { MockPaymentProvider } from './mock.provider';
import { mapProviderStatus, ProviderRegistry, UnknownProviderError } from './registry';
import type { CanonicalPaymentStatus } from './types';

describe('ProviderRegistry', () => {
  const registry = new ProviderRegistry([new MockPaymentProvider({ checkoutUiUrl: 'http://x' })]);

  it('resolves a registered provider by name', () => {
    expect(registry.get('mock').name).toBe('mock');
  });

  it('throws rather than falling back to the dev mock in production-shaped code', () => {
    expect(() => registry.get('stripe')).toThrow(UnknownProviderError);
  });

  it('rejects two providers claiming one name', () => {
    expect(
      () =>
        new ProviderRegistry([
          new MockPaymentProvider({ checkoutUiUrl: 'http://a' }),
          new MockPaymentProvider({ checkoutUiUrl: 'http://b' }),
        ]),
    ).toThrow(PaymentProviderConfigError);
  });
});

describe('mapProviderStatus', () => {
  const cases: Array<[string | null | undefined, CanonicalPaymentStatus]> = [
    [null, 'PENDING'],
    [undefined, 'PENDING'],
    ['', 'PENDING'],
    ['awaiting_bank_confirmation', 'PENDING'],
    ['paid', 'SUCCEEDED'],
    ['captured', 'SUCCEEDED'],
    ['succeeded', 'SUCCEEDED'],
    ['failed', 'FAILED'],
    ['declined', 'FAILED'],
    ['canceled', 'CANCELED'],
    ['cancelled', 'CANCELED'],
    // Real payloads carry padding; an untrimmed value must not stall forever.
    ['captured ', 'SUCCEEDED'],
    ['\nSUCCESS', 'SUCCEEDED'],
    [' CANCELED\t', 'CANCELED'],
  ];

  it.each(cases)('maps %p to %s', (raw, expected) => {
    expect(mapProviderStatus(raw)).toBe(expected);
  });
});
