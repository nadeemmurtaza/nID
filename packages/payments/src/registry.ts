import type { CanonicalPaymentStatus, PaymentProvider } from './types';
import { UnknownProviderError } from './errors';

// Re-exported so the registry's failure mode is importable from the module that raises it.
export { UnknownProviderError };

/**
 * Providers are resolved here and nowhere else. A controller that writes
 * `if (provider === 'rapid-gateway')` is the failure mode this exists to
 * prevent — docs/HOUSE-RULES.md rule 1, same shape as
 * packages/verification-providers/src/registry.ts.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(providers: PaymentProvider[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.name)) {
        throw new Error(`Payment provider registry received duplicate name "${provider.name}".`);
      }
      this.providers.set(provider.name, provider);
    }
  }

  get(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new UnknownProviderError(name);
    return provider;
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  names(): string[] {
    return [...this.providers.keys()];
  }
}

/**
 * Providers spell the same state differently and the webhook payload is the
 * only place that gets to decide, so the mapping is one function every adapter
 * calls instead of each re-deciding what "captured" means. Anything
 * unrecognised is PENDING — never a guessed success — because a wrong SUCCEEDED
 * posts ledger entries and credits a balance, while a wrong PENDING is
 * corrected by the next webhook or poll.
 */
export function mapProviderStatus(raw: string | null | undefined): CanonicalPaymentStatus {
  const value = (raw ?? '').toUpperCase();
  if (['SUCCESS', 'SUCCEEDED', 'PAID', 'CAPTURED', 'COMPLETED', 'SETTLED'].includes(value)) return 'SUCCEEDED';
  if (['FAILED', 'DECLINED', 'REJECTED', 'CANCELLED', 'CANCELED', 'ABORTED'].includes(value)) return 'FAILED';
  if (['EXPIRED', 'TIMEOUT'].includes(value)) return 'EXPIRED';
  return 'PENDING';
}
