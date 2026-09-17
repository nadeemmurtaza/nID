/**
 * The provider abstraction every verification method implements — one file
 * per method (docs/HOUSE-RULES.md rule 1), selected by the VERIFICATION_METHODS
 * env allowlist (see registry.ts), mirroring erp-1's PaymentProvider /
 * StorageDriver pattern. A workflow never branches on a method name; it
 * calls `start()` on whichever provider the tenant's VerificationPolicy names.
 */

export interface VerificationContext {
  caseId: string;
  tenantId: string;
  subjectId: string;
  /** Method-specific input — a phone number for otp_sms, image refs for document_ocr, etc. */
  input: Record<string, unknown>;
}

export interface VerificationResult {
  status: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
  score?: number;
  /** Pointers to stored raw vendor payload / document, not the content itself. */
  evidenceRefs?: string[];
  raw: Record<string, unknown>;
  /**
   * False when a callback did not prove it came from the real source — a bad
   * signature, an incorrect code, or no proof at all. Distinct from
   * `status: 'FAILED'`, which is a genuine negative result. The caller must
   * refuse to persist a case-state change when this is false, exactly as
   * erp-1's PaymentCallbackResult.verified gates payment-state writes.
   */
  verified?: boolean;
}

export interface PendingResult {
  pending: true;
  /** Opaque data the caller must persist and hand back on the next callback — e.g. a hashed OTP code. */
  resultMeta?: Record<string, unknown>;
}

export interface VerificationMethodProvider {
  /** Stable key, matching the VERIFICATION_METHODS allowlist and VerificationPolicy.methods entries. */
  readonly key: string;
  readonly label: string;
  start(context: VerificationContext): Promise<VerificationResult | PendingResult>;
  /**
   * Interprets a callback completing a pending attempt — a vendor webhook for
   * document_ocr/liveness, or a subject-submitted code for otp_sms. Providers
   * whose start() never returns `pending` may omit this.
   */
  handleCallback?(payload: Record<string, unknown>): Promise<VerificationResult>;
}
