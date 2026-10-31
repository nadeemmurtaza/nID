import { MockPaymentProvider } from './mock.provider';
import { ProviderRegistry, UnknownProviderError } from './registry';

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
    ).toThrow(/duplicate/);
  });
});
