export type CanonicalPaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'CANCELED';

export interface CreateCheckoutInput {
  /** Minor units. The provider never sees a card number — this is a redirect. */
  amountMinor: bigint;
  currency: string;
  /** Shown to the payer on the provider's hosted page. */
  description: string;
  /** nID's own reference (the PaymentIntent id) — echoed back by webhook. */
  reference: string;
  returnUrl: string;
  webhookUrl: string;
}

export interface CreateCheckoutResult {
  providerRef: string;
  checkoutUrl: string;
  expiresAt: Date;
}

export interface ProviderPayment {
  providerRef: string;
  status: CanonicalPaymentStatus;
  amountMinor: bigint;
  currency: string;
  methodType: string | null;
  paidAt: Date | null;
  raw: unknown;
}

export interface ParsedWebhook {
  providerEventId: string;
  type: string;
  providerRef: string;
  status: CanonicalPaymentStatus;
  paidAmountMinor: bigint | null;
  currency: string | null;
  methodType: string | null;
  occurredAt: Date | null;
  raw: unknown;
}

export interface RefundInput {
  providerRef: string;
  providerTransactionId: string;
  amountMinor: bigint;
  currency: string;
  reason?: string;
}

export interface RefundResult {
  providerRef: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

/**
 * One hosted-checkout payment provider. `createCheckout` never receives card
 * data — that is the whole point of D5/SAQ A, and the type makes it
 * unrepresentable rather than merely discouraged. Nothing here knows about
 * tenants, invoices or ledger accounts.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  fetchPayment(providerRef: string): Promise<ProviderPayment>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  parseWebhook(rawBody: Buffer): ParsedWebhook;
  refund(input: RefundInput): Promise<RefundResult>;
}
