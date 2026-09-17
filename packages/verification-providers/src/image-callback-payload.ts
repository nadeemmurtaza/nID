/**
 * Shared parsing/validation for every provider whose handleCallback() takes
 * "an uploaded image plus, in dev mode only, a forced outcome for
 * deterministic testing" — document_ocr, liveness, and the per-ClaimType
 * document providers (dob_document, education_document,
 * employment_document) all take this exact shape, so the parsing logic
 * belongs in one place rather than copied N times.
 */
import { isValidMockOutcome, type MockOutcome } from './mock-outcome';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ImageCallbackPayload {
  imageBytes: Buffer;
  contentType: string;
  /** Dev-mode-only override so tests can force PASSED/FAILED/NEEDS_REVIEW deterministically. */
  mockOutcome?: MockOutcome;
}

export type ParsedImageCallback =
  | { ok: true; value: ImageCallbackPayload }
  | { ok: false; reason: string };

export function parseImageCallback(payload: Record<string, unknown>): ParsedImageCallback {
  const imageBytes = payload['imageBytes'];
  const contentType = payload['contentType'];
  const mockOutcome = payload['mockOutcome'];

  if (!Buffer.isBuffer(imageBytes) || imageBytes.byteLength === 0) {
    return { ok: false, reason: 'missing_image' };
  }
  if (typeof contentType !== 'string' || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    return { ok: false, reason: 'unsupported_content_type' };
  }
  if (mockOutcome !== undefined && !isValidMockOutcome(mockOutcome)) {
    return { ok: false, reason: 'invalid_mock_outcome' };
  }

  return {
    ok: true,
    value: { imageBytes, contentType, mockOutcome: mockOutcome as MockOutcome | undefined },
  };
}
