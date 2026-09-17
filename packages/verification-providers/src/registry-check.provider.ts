import type { VerificationMethodProvider, VerificationContext, VerificationResult, PendingResult } from './types';
import { isValidMockOutcome, mockScoreFor } from './mock-outcome';

/**
 * Confirms a claim against an authoritative third-party source — a
 * university registrar (education_registry) or an employer/payroll
 * verification service (employment_registry). Unlike the document-upload
 * providers (ImageClaimProvider), everything this needs is already in the
 * case's input at creation time (whatever reference the tenant supplied —
 * a student ID, an employee ID), so start() resolves immediately rather
 * than waiting on a subject upload; handleCallback is never used, exactly
 * like otp_sms's synchronous missing-phone failure path.
 *
 * In production this should call a real registry/employer API (National
 * Student Clearinghouse-class for education, Truework-class for
 * employment — docs/PHASES.md's "buy, don't build" decision, which for
 * these two ClaimTypes hasn't happened at all yet: no real vendor exists
 * behind either key today, unlike document_ocr which at least has a vendor
 * category picked out). `devMode` (the only mode implemented here) returns
 * a mocked result instead.
 */
export class RegistryCheckProvider implements VerificationMethodProvider {
  constructor(
    readonly key: string,
    readonly label: string,
    private readonly devMode: boolean,
  ) {}

  async start(context: VerificationContext): Promise<VerificationResult | PendingResult> {
    if (!this.devMode) {
      throw new Error(
        `${this.key}: no production registry vendor wired up yet. Enable this provider's dev-mode env var for local/dev use, or implement start() against a real registry/employer API before deploying.`,
      );
    }

    const rawMockOutcome = context.input['mockOutcome'];
    const status = isValidMockOutcome(rawMockOutcome) ? rawMockOutcome : 'PASSED';
    return {
      status,
      score: mockScoreFor(status),
      raw: { mode: 'dev_mock', referenceId: context.input['referenceId'] ?? null },
      verified: true,
    };
  }
}
