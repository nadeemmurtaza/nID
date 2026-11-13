/** A provider call failed at the network/protocol level. Safe to surface as 502. */
export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

/** A provider was named in PAYMENT_PROVIDERS but is not configured. Thrown at boot, not per-request. */
export class PaymentProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderConfigError';
  }
}

export class UnknownProviderError extends Error {
  constructor(name: string) {
    super(`Unknown payment provider "${name}".`);
    this.name = 'UnknownProviderError';
  }
}
