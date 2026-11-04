import { assertCurrency, assertPositiveMinor, sumMinor } from './money';
import { BillingError } from './errors';

describe('money rules', () => {
  it('accepts ISO-4217 codes and rejects anything else', () => {
    expect(() => assertCurrency('PKR')).not.toThrow();
    expect(() => assertCurrency('pkr')).toThrow(/ISO-4217/);
    expect(() => assertCurrency('RUPEES')).toThrow(/ISO-4217/);
  });

  it('refuses zero and negative amounts', () => {
    expect(() => assertPositiveMinor(1n, 'amount')).not.toThrow();
    expect(() => assertPositiveMinor(0n, 'amount')).toThrow(/positive/);
    expect(() => assertPositiveMinor(-5n, 'refund')).toThrow(/refund/);
  });

  /**
   * `packages/payments` binds an inbound wire amount's type and integrality but
   * not its sign, so a negative status amount reaches this package as a valid
   * `bigint`. This is the only gate between it and the ledger.
   */
  it('rejects a negative amount outright rather than clamping or echoing it back', () => {
    expect(() => assertPositiveMinor(-11800n, 'Gateway amount')).toThrow(BillingError);
    expect(() => assertPositiveMinor(-11800n, 'Gateway amount')).toThrow(
      'Gateway amount must be a positive amount in minor units, got -11800.',
    );
    expect(() => assertPositiveMinor(-9007199254740993n, 'amount')).toThrow(/positive/);
  });

  it('sums minor units without floats', () => {
    expect(sumMinor([11800n, 236n, 0n])).toBe(12036n);
    expect(sumMinor([])).toBe(0n);
  });

  it('sums beyond Number.MAX_SAFE_INTEGER exactly', () => {
    const beyondFloat = 9007199254740993n;
    expect(sumMinor([beyondFloat, 1n])).toBe(9007199254740994n);
  });
});
