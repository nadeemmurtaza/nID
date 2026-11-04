import { BillingError } from './errors';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function assertCurrency(currency: string): void {
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new BillingError(`"${currency}" is not an ISO-4217 currency code.`);
  }
}

/**
 * Zero is not a payable amount. Charging 0 would create a live checkout,
 * a webhook surface and ledger entries for nothing, and a negative amount
 * would silently become a refund that never went through the refund path.
 */
export function assertPositiveMinor(amountMinor: bigint, label: string): void {
  if (amountMinor <= 0n) {
    throw new BillingError(`${label} must be a positive amount in minor units, got ${amountMinor}.`);
  }
}

export function sumMinor(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}
