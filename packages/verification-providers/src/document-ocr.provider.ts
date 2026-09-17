import type {
  VerificationMethodProvider,
  VerificationContext,
  VerificationResult,
  PendingResult,
} from './types';
import { parseImageCallback, mockScoreFor, type ImageCallbackPayload } from './image-callback-payload';

/**
 * Extracts identity fields from a government ID document and checks it for
 * tamper/authenticity signals. Unlike otp_sms, start() has nothing to send —
 * the subject's next step is uploading a photo of their document through
 * the hosted flow, not receiving a code — so it immediately returns
 * `pending` with no resultMeta. handleCallback() is where the real work
 * happens, driven by the uploaded bytes the caller (an Activity, reading
 * them back from @nid/storage) passes in.
 *
 * In production, `evaluate` should be replaced with a real document-OCR
 * vendor call (Persona/Sumsub/Onfido-class — docs/PHASES.md's Phase 1 "buy,
 * don't build" decision). DOCUMENT_OCR_DEV_MODE=true (the only mode
 * implemented here) returns a mocked result instead — real interface, mock
 * result, exactly like otp_sms's OTP_SMS_DEV_MODE.
 */
export class DocumentOcrProvider implements VerificationMethodProvider {
  readonly key = 'document_ocr';
  readonly label = 'Document OCR';

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
        'document_ocr: no production OCR vendor wired up yet. Set DOCUMENT_OCR_DEV_MODE=true for local/dev use, or implement evaluate() against a real vendor API before deploying.',
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
