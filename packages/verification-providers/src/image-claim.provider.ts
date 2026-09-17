import type {
  VerificationMethodProvider,
  VerificationContext,
  VerificationResult,
  PendingResult,
} from './types';
import { parseImageCallback, type ImageCallbackPayload } from './image-callback-payload';
import { mockScoreFor } from './mock-outcome';

/**
 * Checks a submitted document against whatever this instance verifies — a
 * government ID (document_ocr), a birth certificate (dob_document), a
 * diploma/transcript (education_document), or an offer letter/paystub
 * (employment_document). One class, one file, instantiated once per
 * ClaimType in registry.ts (docs/HOUSE-RULES.md rule 1) — the mechanism
 * (upload an image, mock-verify it in dev, call a real OCR vendor in prod)
 * doesn't differ by claim type, only which document is expected and what
 * badge a PASSED result earns.
 *
 * start() has nothing to send — the subject's next step is an upload, not
 * receiving a code — so it returns `pending` immediately; handleCallback()
 * does the real work, driven by bytes the caller (an Activity, reading them
 * back from @nid/storage) passes in. In production `evaluate` should be
 * replaced with a real document-verification vendor call (docs/PHASES.md's
 * "buy, don't build" decision); `devMode` (the only mode implemented here)
 * returns a mocked result instead — real interface, mock result, exactly
 * like otp_sms's OTP_SMS_DEV_MODE.
 */
export class ImageClaimProvider implements VerificationMethodProvider {
  constructor(
    readonly key: string,
    readonly label: string,
    private readonly devMode: boolean,
  ) {}

  async start(_context: VerificationContext): Promise<VerificationResult | PendingResult> {
    return { pending: true };
  }

  async handleCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    const parsed = parseImageCallback(payload);
    if (!parsed.ok) {
      return { status: 'FAILED', raw: { reason: parsed.reason }, verified: false };
    }
    return this.evaluate(parsed.value);
  }

  private async evaluate(input: ImageCallbackPayload): Promise<VerificationResult> {
    if (!this.devMode) {
      throw new Error(
        `${this.key}: no production document-verification vendor wired up yet. Enable this provider's dev-mode env var for local/dev use, or implement evaluate() against a real vendor API before deploying.`,
      );
    }

    const status = input.mockOutcome ?? 'PASSED';
    return {
      status,
      score: mockScoreFor(status),
      raw: {
        mode: 'dev_mock',
        byteLength: input.imageBytes.byteLength,
        contentType: input.contentType,
      },
      verified: true,
    };
  }
}
