import { randomBytes } from 'node:crypto';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  ProviderPayment,
  RefundInput,
  RefundResult,
} from './types';

export interface MockPaymentProviderOptions {
  /** Base URL of apps/checkout-ui — the mock "hosted page" lives there. */
  checkoutUiUrl: string;
  /** What fetchPayment reports; the mock-pay page decides settlement itself. */
  outcome?: 'success' | 'failure' | 'pending';
}

/**
 * The provider that keeps the whole billing system testable without sandbox
 * credentials: a real implementation of the interface whose hosted page is
 * apps/checkout-ui's /mock-pay/[providerRef], whose settlement is the dev-only
 * POST /v1/billing/dev/mock-payments, and which has no webhook protocol of its
 * own (verifyWebhook is deliberately false, so nothing can accidentally take a
 * "signed" mock webhook as evidence of payment).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly options: MockPaymentProviderOptions) {}

  async createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const providerRef = `mock_${randomBytes(8).toString('hex')}`;
    return {
      providerRef,
      checkoutUrl: `${this.options.checkoutUiUrl}/mock-pay/${providerRef}`,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    };
  }

  async fetchPayment(providerRef: string): Promise<ProviderPayment> {
    return {
      providerRef,
      status:
        this.options.outcome === 'success' ? 'SUCCEEDED' : this.options.outcome === 'failure' ? 'FAILED' : 'PENDING',
      amountMinor: 0n,
      currency: 'PKR',
      methodType: 'mock_card',
      paidAt: this.options.outcome === 'success' ? new Date() : null,
      raw: { mock: true, reference: providerRef },
    };
  }

  verifyWebhook(_rawBody: Buffer, _headers: Record<string, string | string[] | undefined>): boolean {
    return false;
  }

  parseWebhook(_rawBody: Buffer): never {
    throw new Error('MockPaymentProvider has no webhook protocol; use the dev mock-payment endpoint.');
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    return { providerRef: `mock_refund_${randomBytes(6).toString('hex')}`, status: 'SUCCEEDED' };
  }
}
