import { LivenessProvider } from './liveness.provider';
import type { VerificationContext } from './types';

// Mocked here so this stays a fast, isolated unit test of the provider's
// own dispatch/mapping logic — evaluateLiveness's real behavior (real
// face-api.js detection, real EAR blink math, real face-match distance)
// is proven for real against real photos in @nid/liveness-engine's own
// test suite, and against a real end-to-end flow in the live validation
// pass (see docs/PHASES.md), same boundary ImageClaimProvider's own spec
// already draws for @nid/ocr-engine.
jest.mock('@nid/liveness-engine', () => ({
  evaluateLiveness: jest.fn(),
}));
const { evaluateLiveness } = jest.requireMock('@nid/liveness-engine') as { evaluateLiveness: jest.Mock };

function frames(count = 3): Buffer[] {
  return Array.from({ length: count }, (_, i) => Buffer.from(`frame-${i}`));
}

describe('LivenessProvider', () => {
  const context: VerificationContext = {
    caseId: 'case_1',
    tenantId: 'tenant_1',
    subjectId: 'subject_1',
    input: {},
  };

  it('start() has nothing to send and returns pending immediately', async () => {
    const provider = new LivenessProvider(true);
    const result = await provider.start(context);
    expect(result).toEqual({ pending: true });
  });

  it('handleCallback in dev mode mocks a PASSED result by default', async () => {
    const provider = new LivenessProvider(true);
    const result = await provider.handleCallback({ framesBytes: frames(), contentType: 'image/jpeg' });

    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
    expect(result.raw).toMatchObject({ mode: 'dev_mock', frameCount: 3 });
    expect(evaluateLiveness).not.toHaveBeenCalled();
  });

  it('handleCallback respects an explicit mockOutcome for deterministic testing', async () => {
    const provider = new LivenessProvider(true);
    const result = await provider.handleCallback({
      framesBytes: frames(),
      contentType: 'image/jpeg',
      mockOutcome: 'FAILED',
    });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(true);
  });

  it('rejects a callback with too few frames to ever show a blink', async () => {
    const provider = new LivenessProvider(true);
    const result = await provider.handleCallback({
      framesBytes: [Buffer.from('a'), Buffer.from('b')],
      contentType: 'image/jpeg',
    });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw).toMatchObject({ reason: 'not_enough_frames' });
  });

  it('rejects a callback with a missing/empty frame', async () => {
    const provider = new LivenessProvider(true);
    const result = await provider.handleCallback({
      framesBytes: [Buffer.from('a'), Buffer.alloc(0), Buffer.from('c')],
      contentType: 'image/jpeg',
    });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw).toMatchObject({ reason: 'missing_frame' });
  });

  it('handleCallback in production mode runs the real liveness engine and maps a clean PASSED through', async () => {
    evaluateLiveness.mockResolvedValueOnce({
      framesTotal: 3,
      framesWithExactlyOneFace: 3,
      facesConsistent: true,
      earSequence: [0.3, 0.1, 0.3],
      minEar: 0.1,
      maxEar: 0.3,
      blinkDetected: true,
      matchedReference: null,
      referenceMatchDistance: null,
      rejectionReason: null,
    });

    const provider = new LivenessProvider(false);
    const framesBytes = frames();
    const result = await provider.handleCallback({ framesBytes, contentType: 'image/jpeg' });

    expect(evaluateLiveness).toHaveBeenCalledWith(framesBytes, undefined);
    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
  });

  it('passes the reference image through to the real engine when one is supplied', async () => {
    evaluateLiveness.mockResolvedValueOnce({
      framesTotal: 3,
      framesWithExactlyOneFace: 3,
      facesConsistent: true,
      earSequence: [0.3, 0.1, 0.3],
      minEar: 0.1,
      maxEar: 0.3,
      blinkDetected: true,
      matchedReference: true,
      referenceMatchDistance: 0.1,
      rejectionReason: null,
    });

    const provider = new LivenessProvider(false);
    const framesBytes = frames();
    const referenceImageBytes = Buffer.from('the id photo');
    const result = await provider.handleCallback({ framesBytes, contentType: 'image/jpeg', referenceImageBytes });

    expect(evaluateLiveness).toHaveBeenCalledWith(framesBytes, referenceImageBytes);
    expect(result.status).toBe('PASSED');
  });

  it('maps a rejectionReason to FAILED, genuine negative evidence', async () => {
    evaluateLiveness.mockResolvedValueOnce({
      framesTotal: 3,
      framesWithExactlyOneFace: 1,
      facesConsistent: false,
      earSequence: [],
      minEar: 0,
      maxEar: 0,
      blinkDetected: false,
      matchedReference: null,
      referenceMatchDistance: null,
      rejectionReason: 'multiple_faces_in_frame',
    });

    const provider = new LivenessProvider(false);
    const result = await provider.handleCallback({ framesBytes: frames(), contentType: 'image/jpeg' });

    expect(result.status).toBe('FAILED');
    expect(result.raw).toMatchObject({ rejectionReason: 'multiple_faces_in_frame' });
  });

  it('maps a reference mismatch to FAILED even when a blink was detected', async () => {
    evaluateLiveness.mockResolvedValueOnce({
      framesTotal: 3,
      framesWithExactlyOneFace: 3,
      facesConsistent: true,
      earSequence: [0.3, 0.1, 0.3],
      minEar: 0.1,
      maxEar: 0.3,
      blinkDetected: true,
      matchedReference: false,
      referenceMatchDistance: 0.9,
      rejectionReason: null,
    });

    const provider = new LivenessProvider(false);
    const result = await provider.handleCallback({
      framesBytes: frames(),
      contentType: 'image/jpeg',
      referenceImageBytes: Buffer.from('someone else'),
    });

    expect(result.status).toBe('FAILED');
    expect(result.raw).toMatchObject({ reason: 'face_mismatch' });
  });

  it('maps a clean-but-unblinked result to NEEDS_REVIEW — a capture miss, not proof of fraud', async () => {
    evaluateLiveness.mockResolvedValueOnce({
      framesTotal: 3,
      framesWithExactlyOneFace: 3,
      facesConsistent: true,
      earSequence: [0.3, 0.29, 0.31],
      minEar: 0.29,
      maxEar: 0.31,
      blinkDetected: false,
      matchedReference: null,
      referenceMatchDistance: null,
      rejectionReason: null,
    });

    const provider = new LivenessProvider(false);
    const result = await provider.handleCallback({ framesBytes: frames(), contentType: 'image/jpeg' });

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.raw).toMatchObject({ reason: 'no_blink_detected' });
  });
});
