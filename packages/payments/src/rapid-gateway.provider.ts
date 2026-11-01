import { verifyWebhookSignature } from '@nid/shared-types';
import { PaymentProviderConfigError, PaymentProviderError } from './errors';
import { mapProviderStatus } from './registry';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhook,
  PaymentProvider,
  ProviderPayment,
  RefundInput,
  RefundResult,
} from './types';

export interface RapidGatewayConfig {
  baseUrl: string;
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  /** Overridable because the aggregator's path prefix is a doc-level detail. */
  checkoutPath?: string;
  statusPath?: string;
  refundPath?: string;
  signatureHeader?: string;
}

export interface HttpFetch {
  (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

interface RapidCheckoutResponse {
  id: string;
  checkout_url: string;
  expires_at: string;
}

interface RapidPaymentResponse {
  id: string;
  transaction_id?: string | null;
  status: string;
  amount: number;
  currency: string;
  method?: string | null;
  paid_at?: string | null;
}

interface RapidWebhook {
  event_id: string;
  event_type: string;
  occurred_at?: string | null;
  data: {
    id: string;
    transaction_id?: string | null;
    status: string;
    amount?: number | null;
    currency?: string | null;
    method?: string | null;
  };
}

/**
 * Provisional mapping — see docs/vendors/rapid-gateway/README.md. When the real
 * sandbox docs arrive, the only things that change are the four PATH/Header
 * constants, the response field names on the three interfaces above, and the
 * fixtures. createCheckout/fetchPayment/refund/verifyWebhook/parseWebhook and
 * everything upstream of them stay.
 */
const DEFAULT_CHECKOUT_PATH = '/v1/checkout/sessions';
const DEFAULT_STATUS_PATH = '/v1/payments';
const DEFAULT_REFUND_PATH = '/v1/refunds';
const DEFAULT_SIGNATURE_HEADER = 'x-rapidgateway-signature';
/** Spec §11's 5-minute replay window, enforced here rather than in the controller. */
const REPLAY_WINDOW_MS = 5 * 60_000;

export class RapidGatewayProvider implements PaymentProvider {
  readonly name = 'rapid-gateway';

  constructor(
    private readonly config: RapidGatewayConfig,
    private readonly fetchImpl: HttpFetch = fetch as unknown as HttpFetch,
  ) {
    for (const field of ['baseUrl', 'merchantId', 'apiKey', 'apiSecret', 'webhookSecret'] as const) {
      if (!config[field]?.trim()) {
        throw new PaymentProviderConfigError(
          `Rapid Gateway is enabled (PAYMENT_PROVIDERS contains "rapid-gateway") but ${field} is empty.`,
        );
      }
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const response = await this.request<RapidCheckoutResponse>(
      this.config.checkoutPath ?? DEFAULT_CHECKOUT_PATH,
      'POST',
      {
        merchant_id: this.config.merchantId,
        reference: input.reference,
        // Rapid Gateway quotes amounts in minor units per the assumed contract;
        // Number() is safe below 2^53 paisa (≈₹4.5 trillion) and this is the one
        // place a float can appear, at the protocol edge, never in the ledger.
        amount: Number(input.amountMinor),
        currency: input.currency,
        description: input.description,
        return_url: input.returnUrl,
        webhook_url: input.webhookUrl,
      },
    );
    return {
      providerRef: response.id,
      checkoutUrl: response.checkout_url,
      expiresAt: new Date(response.expires_at),
    };
  }

  async fetchPayment(providerRef: string): Promise<ProviderPayment> {
    const path = `${this.config.statusPath ?? DEFAULT_STATUS_PATH}/${encodeURIComponent(providerRef)}`;
    const response = await this.request<RapidPaymentResponse>(path, 'GET');
    return {
      providerRef,
      status: mapProviderStatus(response.status),
      amountMinor: BigInt(Math.round(response.amount)),
      currency: response.currency,
      methodType: response.method ?? null,
      paidAt: response.paid_at ? new Date(response.paid_at) : null,
      raw: response,
    };
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const header = headers[this.config.signatureHeader ?? DEFAULT_SIGNATURE_HEADER];
    if (typeof header !== 'string') return false;

    const parts = new Map(
      header.split(',').map((pair) => {
        const index = pair.indexOf('=');
        return index === -1 ? ['', ''] : [pair.slice(0, index).trim(), pair.slice(index + 1).trim()];
      }),
    );
    const timestamp = Number(parts.get('t'));
    const signature = parts.get('v1') ?? '';
    if (!Number.isFinite(timestamp)) return false;
    // Reject before comparing: an old capture is worthless even if it is valid.
    if (Math.abs(Date.now() - timestamp) > REPLAY_WINDOW_MS) return false;

    return verifyWebhookSignature(
      this.config.webhookSecret,
      rawBody.toString('utf8'),
      timestamp,
      signature,
    );
  }

  parseWebhook(rawBody: Buffer): ParsedWebhook {
    const event = JSON.parse(rawBody.toString('utf8')) as RapidWebhook;
    if (!event?.data?.transaction_id) {
      throw new PaymentProviderError('Rapid Gateway webhook has no transaction id; cannot settle it.');
    }
    return {
      providerEventId: event.event_id,
      type: event.event_type,
      providerRef: event.data.id,
      status: mapProviderStatus(event.data.status),
      paidAmountMinor:
        typeof event.data.amount === 'number' ? BigInt(Math.round(event.data.amount)) : null,
      currency: event.data.currency ?? null,
      methodType: event.data.method ?? null,
      occurredAt: event.occurred_at ? new Date(event.occurred_at) : null,
      raw: event,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const response = await this.request<{ id: string; status: string }>(
      this.config.refundPath ?? DEFAULT_REFUND_PATH,
      'POST',
      {
        merchant_id: this.config.merchantId,
        reference: input.providerRef,
        transaction_id: input.providerTransactionId,
        amount: Number(input.amountMinor),
        currency: input.currency,
        reason: input.reason ?? null,
      },
    );
    return { providerRef: response.id, status: mapProviderStatus(response.status) === 'SUCCEEDED' ? 'SUCCEEDED' : 'PENDING' };
  }

  private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'x-rapidgateway-merchant': this.config.merchantId,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new PaymentProviderError(
        `Rapid Gateway ${method} ${path} failed with ${response.status}${payload?.error ? `: ${payload.error}` : ''}.`,
      );
    }
    return (await response.json()) as T;
  }
}
