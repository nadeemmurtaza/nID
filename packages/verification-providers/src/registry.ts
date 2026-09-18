import type { PrismaClient } from '@nid/db';
import type { VerificationMethodProvider } from './types';
import { OtpSmsProvider } from './otp-sms.provider';
import { ImageClaimProvider } from './image-claim.provider';
import { LivenessProvider } from './liveness.provider';
import { RegistryCheckProvider, type RegistryCheckConfig } from './registry-check.provider';
import { SelfReportedCheckProvider } from './self-reported-check.provider';
import { AgentAttestedCheckProvider } from './agent-attested-check.provider';
import { OrganizationMembershipProvider } from './organization-membership.provider';

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
    new RegistryCheckProvider(
      'education_registry',
      'Education registry check',
      options.registryCheckDevMode,
      options.educationRegistryConfig,
    ),
    new RegistryCheckProvider(
      'employment_registry',
      'Employment registry check',
      options.registryCheckDevMode,
      options.employmentRegistryConfig,
    ),
    new RegistryCheckProvider(
      'bank_account_title',
      'Bank account title check',
      options.registryCheckDevMode,
      options.bankAccountTitleConfig,
    ),
    new SelfReportedCheckProvider('ecp_voter_registration', 'ECP voter registration self-report'),
    new AgentAttestedCheckProvider('agent_in_person_document', 'Agent in-person document inspection'),
    new OrganizationMembershipProvider(options.db),
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
  /** EDUCATION_REGISTRY_API_URL / EDUCATION_REGISTRY_API_KEY — ignored while registryCheckDevMode is true. */
  educationRegistryConfig?: RegistryCheckConfig;
  /** EMPLOYMENT_REGISTRY_API_URL / EMPLOYMENT_REGISTRY_API_KEY — ignored while registryCheckDevMode is true. */
  employmentRegistryConfig?: RegistryCheckConfig;
  /** BANK_ACCOUNT_TITLE_API_URL / BANK_ACCOUNT_TITLE_API_KEY — ignored while registryCheckDevMode is true. */
  bankAccountTitleConfig?: RegistryCheckConfig;
  /**
   * org_membership looks up the Organization graph directly rather than
   * calling a vendor — first-party evidence, not a mock to toggle off in
   * dev — so it always needs a real Prisma client, the same one the caller
   * (apps/workflows) already holds at module scope.
   */
  db: PrismaClient;
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
