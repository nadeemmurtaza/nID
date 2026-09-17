import type {
  VerificationMethodProvider,
  VerificationContext,
  VerificationResult,
  PendingResult,
} from './types';
import { parseImageCallback, type ImageCallbackPayload } from './image-callback-payload';
import { mockScoreFor } from './mock-outcome';

/**
 * Confirms the subject is a live person (not a photo, video replay, or
 * mask) from a selfie capture, typically face-matched against the document
 * from a paired document_ocr attempt. Same shape as document_ocr:
 * start() has nothing to send (the next step is a selfie upload), so it
 * returns `pending` immediately; handleCallback() does the real work,
 * driven by bytes the caller reads back from @nid/storage.
 *
 * In production, `evaluate` should be replaced with a real liveness/face-match
 * vendor call (docs/PHASES.md's Phase 1 "buy, don't build" decision).
 * LIVENESS_DEV_MODE=true (the only mode implemented here) returns a mocked
 * result instead — real interface, mock result, exactly like otp_sms's
 * OTP_SMS_DEV_MODE.
 */
export class LivenessProvider implements VerificationMethodProvider {
  readonly key = 'liveness';
  readonly label = 'Liveness check';

  constructor(private readonly devMode: boolean) {}

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
        'liveness: no production liveness vendor wired up yet. Set LIVENESS_DEV_MODE=true for local/dev use, or implement evaluate() against a real vendor API before deploying.',
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
