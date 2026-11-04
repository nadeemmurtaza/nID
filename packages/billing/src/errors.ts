export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A ledger transaction that does not sum to zero. Nothing is written when this throws. */
export class UnbalancedLedgerError extends BillingError {}

/** A debit larger than the remaining credit balance. Maps to HTTP 402. */
export class InsufficientCreditsError extends BillingError {}

/** A billing request that violates a business rule. Maps to HTTP 422. */
export class CheckoutError extends BillingError {}

/** The provider refused to open a checkout. Maps to HTTP 502. */
export class CheckoutProviderError extends CheckoutError {}

/**
 * Prisma's unique-violation signal. Race-safe idempotency depends on catching
 * it after the fact (two concurrent top-ups can both pass a read-then-write
 * check), and Prisma exposes the code as a field rather than a typed subclass.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}
