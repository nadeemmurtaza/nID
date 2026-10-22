/**
 * liveness's callback shape is deliberately different from
 * image-callback-payload.ts's single-image shape every other
 * upload-driven provider uses: real blink detection needs a short BURST of
 * frames (apps/verify-ui captures ~6 over ~1.8s while prompting the
 * subject to blink), not one photo, plus an optional reference image (the
 * paired document_ocr attempt's ID photo, for a real face match) — see
 * LivenessProvider and evaluateLiveness() in @nid/liveness-engine.
 */
import { isValidMockOutcome, type MockOutcome } from './mock-outcome';
import { ALLOWED_IMAGE_TYPES } from './image-callback-payload';

/** Fewer frames than this can't show a genuine open->closed->open dip-and-recover — nothing to detect a blink from. */
const MIN_FRAMES = 3;
/** A sanity cap, not a UX target — apps/verify-ui sends far fewer; this just stops an abusive payload from forcing dozens of model inferences per callback. */
const MAX_FRAMES = 20;

export interface LivenessCallbackPayload {
  framesBytes: Buffer[];
  contentType: string;
  referenceImageBytes?: Buffer;
  /** Dev-mode-only override so tests can force PASSED/FAILED/NEEDS_REVIEW deterministically. */
  mockOutcome?: MockOutcome;
}

export type ParsedLivenessCallback =
  | { ok: true; value: LivenessCallbackPayload }
  | { ok: false; reason: string };

export function parseLivenessCallback(payload: Record<string, unknown>): ParsedLivenessCallback {
  const framesBytes = payload['framesBytes'];
  const contentType = payload['contentType'];
  const referenceImageBytes = payload['referenceImageBytes'];
  const mockOutcome = payload['mockOutcome'];

  if (!Array.isArray(framesBytes) || framesBytes.length < MIN_FRAMES) {
    return { ok: false, reason: 'not_enough_frames' };
  }
  if (framesBytes.length > MAX_FRAMES) {
    return { ok: false, reason: 'too_many_frames' };
  }
  if (!framesBytes.every((frame) => Buffer.isBuffer(frame) && frame.byteLength > 0)) {
    return { ok: false, reason: 'missing_frame' };
  }
  if (typeof contentType !== 'string' || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    return { ok: false, reason: 'unsupported_content_type' };
  }
  if (referenceImageBytes !== undefined && (!Buffer.isBuffer(referenceImageBytes) || referenceImageBytes.byteLength === 0)) {
    return { ok: false, reason: 'invalid_reference_image' };
  }
  if (mockOutcome !== undefined && !isValidMockOutcome(mockOutcome)) {
    return { ok: false, reason: 'invalid_mock_outcome' };
  }

  return {
    ok: true,
    value: {
      framesBytes: framesBytes as Buffer[],
      contentType,
      referenceImageBytes: referenceImageBytes as Buffer | undefined,
      mockOutcome: mockOutcome as MockOutcome | undefined,
    },
  };
}
