import type { VerificationMethodProvider } from './types';
import { OtpSmsProvider } from './otp-sms.provider';
import { DocumentOcrProvider } from './document-ocr.provider';
import { LivenessProvider } from './liveness.provider';

/**
 * Every provider that exists in this codebase, regardless of whether a given
 * environment enables it. Adding a new method means adding one entry here
 * and one new file — never an `if (method === '...')` elsewhere
 * (docs/HOUSE-RULES.md rule 1).
 */
function allProviders(options: VerificationProviderRegistryOptions): VerificationMethodProvider[] {
  return [
    new OtpSmsProvider(options.otpSmsDevMode),
    new DocumentOcrProvider(options.documentOcrDevMode),
    new LivenessProvider(options.livenessDevMode),
  ];
}

export interface VerificationProviderRegistryOptions {
  /** Comma-separated allowlist, e.g. process.env.VERIFICATION_METHODS. */
  allowlist: string;
  otpSmsDevMode: boolean;
  documentOcrDevMode: boolean;
  livenessDevMode: boolean;
}

/**
 * The providers actually enabled in this environment, keyed by provider key.
 * A VerificationPolicy.methods entry that isn't in this map is a
 * configuration error, not something to silently skip.
 */
export function buildVerificationProviderRegistry(
  options: VerificationProviderRegistryOptions,
): Map<string, VerificationMethodProvider> {
  const enabledKeys = new Set(
    options.allowlist
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length > 0),
  );

  const registry = new Map<string, VerificationMethodProvider>();
  for (const provider of allProviders(options)) {
    if (enabledKeys.has(provider.key)) {
      registry.set(provider.key, provider);
    }
  }
  return registry;
}
