import type { VerificationMethodProvider } from './types';
import { OtpSmsProvider } from './otp-sms.provider';
import { ImageClaimProvider } from './image-claim.provider';
import { LivenessProvider } from './liveness.provider';
import { RegistryCheckProvider } from './registry-check.provider';

/**
 * Every provider that exists in this codebase, regardless of whether a given
 * environment enables it. Adding a new method means adding one entry here
 * — a new file only when the mechanism itself is new (ImageClaimProvider and
 * RegistryCheckProvider are both reused across ClaimTypes) — never an
 * `if (method === '...')` elsewhere (docs/HOUSE-RULES.md rule 1).
 */
function allProviders(options: VerificationProviderRegistryOptions): VerificationMethodProvider[] {
  return [
    new OtpSmsProvider(options.otpSmsDevMode),
    new ImageClaimProvider('document_ocr', 'Document OCR', options.documentOcrDevMode),
    new LivenessProvider(options.livenessDevMode),
    new ImageClaimProvider('dob_document', 'Date of birth document', options.claimDocumentDevMode),
    new ImageClaimProvider('education_document', 'Education document', options.claimDocumentDevMode),
    new ImageClaimProvider('employment_document', 'Employment document', options.claimDocumentDevMode),
    new RegistryCheckProvider('education_registry', 'Education registry check', options.registryCheckDevMode),
    new RegistryCheckProvider('employment_registry', 'Employment registry check', options.registryCheckDevMode),
  ];
}

export interface VerificationProviderRegistryOptions {
  /** Comma-separated allowlist, e.g. process.env.VERIFICATION_METHODS. */
  allowlist: string;
  otpSmsDevMode: boolean;
  documentOcrDevMode: boolean;
  livenessDevMode: boolean;
  /** Shared by dob_document / education_document / employment_document — same mechanism, one toggle. */
  claimDocumentDevMode: boolean;
  /** Shared by education_registry / employment_registry — same mechanism, one toggle. */
  registryCheckDevMode: boolean;
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
