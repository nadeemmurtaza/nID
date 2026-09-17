/**
 * Shared parsing/validation for the document_ocr and liveness providers'
 * handleCallback() payloads — both take "an uploaded image plus, in dev
 * mode only, a forced outcome for deterministic testing," so the parsing
 * logic belongs in one place rather than copied twice.
 */
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type MockOutcome = 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
const MOCK_OUTCOMES: ReadonlySet<string> = new Set<MockOutcome>(['PASSED', 'FAILED', 'NEEDS_REVIEW']);

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
  if (mockOutcome !== undefined && (typeof mockOutcome !== 'string' || !MOCK_OUTCOMES.has(mockOutcome))) {
    return { ok: false, reason: 'invalid_mock_outcome' };
  }

  return {
    ok: true,
    value: { imageBytes, contentType, mockOutcome: mockOutcome as MockOutcome | undefined },
  };
}

/** A believable-looking confidence score for a mocked dev-mode result — never used in production. */
export function mockScoreFor(status: MockOutcome): number {
  if (status === 'PASSED') return 0.97;
  if (status === 'NEEDS_REVIEW') return 0.55;
  return 0.08;
}
