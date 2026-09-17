import { LivenessProvider } from './liveness.provider';
import type { VerificationContext } from './types';

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
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('fake selfie bytes'),
      contentType: 'image/jpeg',
    });

    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
  });

  it('handleCallback respects an explicit mockOutcome for deterministic testing', async () => {
    const provider = new LivenessProvider(true);
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('fake selfie bytes'),
      contentType: 'image/jpeg',
      mockOutcome: 'FAILED',
    });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(true);
  });

  it('rejects a callback with no image bytes as unverified, not a genuine FAILED', async () => {
    const provider = new LivenessProvider(true);
    const result = await provider.handleCallback({ contentType: 'image/jpeg' });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw).toMatchObject({ reason: 'missing_image' });
  });

  it('rejects a malformed mockOutcome rather than silently ignoring it', async () => {
    const provider = new LivenessProvider(true);
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('bytes'),
      contentType: 'image/jpeg',
      mockOutcome: 'not_a_real_status',
    });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw).toMatchObject({ reason: 'invalid_mock_outcome' });
  });

  it('handleCallback throws in production mode, where no real liveness vendor is wired up yet', async () => {
    const provider = new LivenessProvider(false);
    await expect(
      provider.handleCallback({ imageBytes: Buffer.from('bytes'), contentType: 'image/jpeg' }),
    ).rejects.toThrow(/no production liveness vendor/);
  });
});
