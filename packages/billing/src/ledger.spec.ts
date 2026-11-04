import { assertBalanced, ledgerScopeKey } from './ledger';
import type { LedgerLineInput } from './ledger';
import { BillingError, UnbalancedLedgerError } from './errors';

describe('ledgerScopeKey', () => {
  it('encodes tenant before kind so two tenants never share an account', () => {
    expect(ledgerScopeKey('tnt_a', 'REVENUE', 'PKR')).toBe('t:tnt_a:REVENUE:PKR');
  });

  it('encodes the service inside the tenant segment for revenue attribution', () => {
    expect(ledgerScopeKey('tnt_a', 'REVENUE', 'PKR', 'svc_erp')).toBe('t:tnt_a:s:svc_erp:REVENUE:PKR');
  });

  it('treats an explicit null service like no service', () => {
    expect(ledgerScopeKey('tnt_a', 'PSP_CLEARING', 'PKR', null)).toBe(
      ledgerScopeKey('tnt_a', 'PSP_CLEARING', 'PKR'),
    );
  });

  /**
   * `LedgerEntry` carries no currency column — a money row inherits it from the
   * parent LedgerTransaction — so keeping one currency per transaction depends
   * on an account for one currency never being reachable from another. Currency
   * inside the key is the whole of that guarantee.
   */
  it('keeps one account kind in two currencies as two accounts', () => {
    expect(ledgerScopeKey('tnt_a', 'PSP_CLEARING', 'PKR')).not.toBe(ledgerScopeKey('tnt_a', 'PSP_CLEARING', 'USD'));
    expect(ledgerScopeKey('tnt_a', 'CUSTOMER_CREDITS', 'PKR', 'svc_erp')).not.toBe(
      ledgerScopeKey('tnt_a', 'CUSTOMER_CREDITS', 'USD', 'svc_erp'),
    );
  });
});

describe('assertBalanced', () => {
  const line = (over: Partial<LedgerLineInput>): LedgerLineInput => ({
    kind: 'PSP_CLEARING',
    direction: 'DEBIT',
    amountMinor: 11800n,
    ...over,
  });

  it('accepts the credit-pack example from the spec', () => {
    expect(() =>
      assertBalanced([
        line({}),
        line({ kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: 10000n }),
        line({ kind: 'TAX_PAYABLE', direction: 'CREDIT', amountMinor: 1800n }),
      ]),
    ).not.toThrow();
  });

  it('rejects an unbalanced set, a single line, and a zero amount', () => {
    expect(() => assertBalanced([line({}), line({ kind: 'REFUNDS', direction: 'CREDIT', amountMinor: 9999n })])).toThrow(
      UnbalancedLedgerError,
    );
    expect(() => assertBalanced([line({})])).toThrow(/at least two/);
    expect(() =>
      assertBalanced([
        line({ amountMinor: 0n }),
        line({ direction: 'CREDIT', amountMinor: 0n }),
      ]),
    ).toThrow(/positive/);
  });

  /**
   * A signed amount that balances on paper is the failure mode the ledger must
   * not absorb: DEBIT -11800 / CREDIT -11800 sums to zero, and a value that came
   * from a provider status amount would turn a charge into a credit.
   */
  it('rejects a negative line even when the negative lines offset each other', () => {
    expect(() =>
      assertBalanced([
        line({ amountMinor: -11800n }),
        line({ kind: 'CUSTOMER_CREDITS', direction: 'CREDIT', amountMinor: -11800n }),
      ]),
    ).toThrow(BillingError);
  });

  it('reports which side is short rather than only that it is unbalanced', () => {
    expect(() =>
      assertBalanced([
        line({ amountMinor: 500n }),
        line({ kind: 'TAX_PAYABLE', direction: 'CREDIT', amountMinor: 400n }),
        line({ kind: 'PSP_FEES', direction: 'CREDIT', amountMinor: 50n }),
      ]),
    ).toThrow('Ledger transaction is unbalanced: debits 500 != credits 450.');
  });
});
