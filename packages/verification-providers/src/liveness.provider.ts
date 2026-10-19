import type {
  VerificationMethodProvider,
  VerificationContext,
  VerificationResult,
  PendingResult,
} from './types';
import { parseLivenessCallback, type LivenessCallbackPayload } from './liveness-callback-payload';
import { mockScoreFor } from './mock-outcome';
import type { LivenessEvaluation } from '@nid/liveness-engine';

/**
 * Confirms the subject is a live person (not a photo, video replay, or
 * mask) from a burst of selfie frames, optionally face-matched against a
 * paired document_ocr attempt's ID photo. Same shape as document_ocr:
 * start() has nothing to send (the next step is the frame burst upload),
 * so it returns `pending` immediately; handleCallback() does the real work.
 *
 * `devMode=true` returns a fast mocked result for tests (real interface,
 * mock result, exactly like otp_sms's OTP_SMS_DEV_MODE). `devMode=false`
 * runs the *real*, self-hosted pipeline (`@nid/liveness-engine`:
 * @vladmandic/face-api + tfjs-node, MIT-licensed, model weights bundled —
 * no vendor account, no per-check cost, no external network call at
 * runtime) — real face detection, a real Eye-Aspect-Ratio blink check
 * across the frame burst, and, when a reference image is supplied, a real
 * face-match distance. See mapEvaluationToResult()'s own comment for
 * exactly what each outcome means and why.
 *
 * @nid/liveness-engine is loaded with a dynamic import inside evaluate(),
 * not a top-level one: it pulls in tfjs-node's native addon, which fails
 * to load on some platform/Node-version combinations the native binary
 * wasn't built for. A static import would crash the whole process at
 * startup even when devMode is true and the real engine is never called --
 * exactly the environments LIVENESS_DEV_MODE exists to let you run in.
 */
export class LivenessProvider implements VerificationMethodProvider {
  readonly key = 'liveness';
  readonly label = 'Liveness check';

  constructor(private readonly devMode: boolean) {}

  async start(_context: VerificationContext): Promise<VerificationResult | PendingResult> {
    return { pending: true };
  }

  async handleCallback(payload: Record<string, unknown>): Promise<VerificationResult> {
    const parsed = parseLivenessCallback(payload);
    if (!parsed.ok) {
      return { status: 'FAILED', raw: { reason: parsed.reason }, verified: false };
    }
    return this.evaluate(parsed.value);
  }

  private async evaluate(input: LivenessCallbackPayload): Promise<VerificationResult> {
    if (this.devMode) {
      const status = input.mockOutcome ?? 'PASSED';
      return {
        status,
        score: mockScoreFor(status),
        raw: {
          mode: 'dev_mock',
          frameCount: input.framesBytes.length,
          contentType: input.contentType,
          hasReferenceImage: input.referenceImageBytes !== undefined,
        },
        verified: true,
      };
    }

    const { evaluateLiveness } = await import('@nid/liveness-engine');
    const evaluation = await evaluateLiveness(input.framesBytes, input.referenceImageBytes);
    return mapEvaluationToResult(evaluation);
  }
}

/**
 * Translates the engine's raw evaluation into a claim result, most-severe
 * evidence first:
 *
 *  - a `rejectionReason` (no face in some frame, a second face, the face
 *    changing identity mid-capture, or an undetectable reference face) is
 *    genuine negative evidence — FAILED.
 *  - a reference image was supplied and didn't match — also genuine
 *    negative evidence (this selfie is not the person in the ID) — FAILED,
 *    checked before the blink outcome since a face mismatch is the
 *    stronger claim either way.
 *  - no blink across the whole burst, with everything else clean, is
 *    NOT forced to FAILED: it's just as likely a capture/timing miss (the
 *    subject blinked outside the window, a slow camera) as it is a static-
 *    photo spoof, and this codebase does not fabricate certainty it
 *    doesn't have — NEEDS_REVIEW, same honesty standard as every other
 *    ambiguous outcome in this codebase.
 *  - everything checks out — PASSED.
 */
function mapEvaluationToResult(evaluation: LivenessEvaluation): VerificationResult {
  const raw: Record<string, unknown> = { ...evaluation };

  if (evaluation.rejectionReason) {
    return { status: 'FAILED', raw, verified: true };
  }
  if (evaluation.matchedReference === false) {
    return { status: 'FAILED', raw: { ...raw, reason: 'face_mismatch' }, verified: true };
  }
  if (!evaluation.blinkDetected) {
    return { status: 'NEEDS_REVIEW', raw: { ...raw, reason: 'no_blink_detected' }, verified: true };
  }
  return { status: 'PASSED', raw, verified: true };
}
