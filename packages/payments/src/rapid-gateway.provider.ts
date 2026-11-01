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
  /**
   * Boot-mandatory and read by nothing yet: the assumed auth is the bearer key
   * plus the merchant header. It is kept because some PSPs sign requests with a
   * separate secret, and a required field missing at boot fails loudly, whereas
   * discovering the gap against a live sandbox does not. Whether Rapid Gateway
   * uses it at all is an open question in docs/vendors/rapid-gateway/README.md.
   */
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
  /**
   * Optional in the type because the assumed docs say required: the readers
   * below validate rather than trust the declaration.
   */
  amount?: number | null;
  currency?: string | null;
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
/** Spec §10's 5-minute replay window, enforced here rather than in the controller. */
const REPLAY_WINDOW_MS = 5 * 60_000;
/** Number() stops being exact above 2^53, so an amount may not travel past that as JSON. */
const MAX_SAFE_AMOUNT_MINOR = 2n ** 53n;
/** Vendor error text goes into a log line, so it is bounded instead of interpolated whole. */
const MAX_VENDOR_ERROR_CHARS = 200;

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
        // Rapid Gateway quotes amounts in minor units per the assumed contract,
        // and JSON cannot carry a BigInt: this is the one place a float can
        // appear, at the protocol edge, never in the ledger.
        amount: this.wireAmount(input.amountMinor),
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
      providerTransactionId: response.transaction_id ?? null,
      status: mapProviderStatus(response.status),
      amountMinor: this.minorUnitsFromWire(response.amount, 'status read'),
      currency: this.currencyFromWire(response.currency, 'status read'),
      methodType: response.method ?? null,
      paidAt: response.paid_at ? new Date(response.paid_at) : null,
      raw: response,
    };
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    // Node lowercases every incoming header name, so the configured name is
    // lowered too: a config that copies the vendor's own spelling
    // (`X-RapidGateway-Signature`) must still find the signature, otherwise
    // verification always fails and no payment ever settles.
    const header = headers[(this.config.signatureHeader ?? DEFAULT_SIGNATURE_HEADER).toLowerCase()];
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
    let event: RapidWebhook;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as RapidWebhook;
    } catch {
      // A signed body that is not JSON — an edge proxy's HTML error page behind
      // a 200, say — must be a provider error: the webhook controller only
      // catches BillingError, so a raw SyntaxError becomes a 500 and the PSP
      // retries the same unusable body forever.
      throw new PaymentProviderError('Rapid Gateway webhook body is not valid JSON.');
    }
    const transactionId = event?.data?.transaction_id;
    if (typeof transactionId !== 'string' || !transactionId) {
      throw new PaymentProviderError('Rapid Gateway webhook has no transaction id; cannot settle it.');
    }
    const data = event.data;
    return {
      providerEventId: event.event_id,
      type: event.event_type,
      providerRef: data.id,
      providerTransactionId: transactionId,
      status: mapProviderStatus(data.status),
      // Null stays null when the vendor omitted the money fields; a value that
      // is present but unusable is a provider error, never a rounded guess.
      paidAmountMinor: data.amount == null ? null : this.minorUnitsFromWire(data.amount, 'webhook'),
      currency: data.currency == null ? null : this.currencyFromWire(data.currency, 'webhook'),
      methodType: data.method ?? null,
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
        amount: this.wireAmount(input.amountMinor),
        currency: input.currency,
        reason: input.reason ?? null,
      },
    );
    const status = mapProviderStatus(response.status);
    // FAILED has to be reachable: the interface offers no later refund-status
    // read, so a decline parked as PENDING is pending for good and the ledger
    // never closes it. Anything genuinely non-terminal stays PENDING.
    let refundStatus: RefundResult['status'] = 'PENDING';
    if (status === 'SUCCEEDED') refundStatus = 'SUCCEEDED';
    else if (status === 'FAILED' || status === 'CANCELED') refundStatus = 'FAILED';
    return { providerRef: response.id, status: refundStatus };
  }

  /**
   * The wire is where minor units become a JSON number, so the 2^53 ceiling on
   * exact floats is enforced rather than only commented: past it the amount
   * would round on its way to the gateway.
   */
  private wireAmount(amountMinor: bigint): number {
    if (amountMinor > MAX_SAFE_AMOUNT_MINOR) {
      throw new PaymentProviderError(
        'Rapid Gateway amount exceeds the largest integer JSON carries exactly (2^53 minor units).',
      );
    }
    return Number(amountMinor);
  }

  /**
   * The assumed shape is a declaration, not a validation: without this, a
   * gateway that omits `amount` reaches `BigInt(NaN)` and throws a RangeError
   * through a contract that promises PaymentProviderError, while a fractional or
   * rupee-scaled amount would round to a wrong paisa figure and settle as such.
   */
  private minorUnitsFromWire(amount: unknown, origin: string): bigint {
    if (typeof amount !== 'number') {
      throw new PaymentProviderError(`Rapid Gateway ${origin} carries no numeric amount.`);
    }
    if (!Number.isInteger(amount)) {
      throw new PaymentProviderError(`Rapid Gateway ${origin} carries a non-integer amount in minor units.`);
    }
    return BigInt(amount);
  }

  /** Every money row carries its currency, so an absent one is a provider failure rather than undefined. */
  private currencyFromWire(currency: unknown, origin: string): string {
    if (typeof currency !== 'string' || !currency) {
      throw new PaymentProviderError(`Rapid Gateway ${origin} carries no currency code.`);
    }
    return currency;
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
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      // The vendor's error string is attacker-influenced text headed for a log:
      // flattened and cut, so it cannot forge extra lines or flood the record.
      const reason =
        typeof payload?.error === 'string'
          ? `: ${payload.error.replace(/[\r\n]+/g, ' ').slice(0, MAX_VENDOR_ERROR_CHARS)}`
          : '';
      throw new PaymentProviderError(
        `Rapid Gateway ${method} ${path} failed with ${response.status}${reason}.`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new PaymentProviderError(
        `Rapid Gateway ${method} ${path} returned a 2xx body that is not valid JSON.`,
      );
    }
    if (payload === null || typeof payload !== 'object') {
      throw new PaymentProviderError(
        `Rapid Gateway ${method} ${path} returned a 2xx body that is not a JSON object.`,
      );
    }
    return payload as T;
  }
}
