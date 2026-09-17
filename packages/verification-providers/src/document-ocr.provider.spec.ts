import { DocumentOcrProvider } from './document-ocr.provider';
import type { VerificationContext } from './types';

describe('DocumentOcrProvider', () => {
  const context: VerificationContext = {
    caseId: 'case_1',
    tenantId: 'tenant_1',
    subjectId: 'subject_1',
    input: {},
  };

  it('start() has nothing to send and returns pending immediately', async () => {
    const provider = new DocumentOcrProvider(true);
    const result = await provider.start(context);
    expect(result).toEqual({ pending: true });
  });

  it('handleCallback in dev mode mocks a PASSED result by default', async () => {
    const provider = new DocumentOcrProvider(true);
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('fake jpeg bytes'),
      contentType: 'image/jpeg',
    });

    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
    expect(result.raw).toMatchObject({ mode: 'dev_mock' });
  });

  it('handleCallback respects an explicit mockOutcome for deterministic testing', async () => {
    const provider = new DocumentOcrProvider(true);
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('fake jpeg bytes'),
      contentType: 'image/jpeg',
      mockOutcome: 'NEEDS_REVIEW',
    });

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.verified).toBe(true);
  });

  it('rejects a callback with no image bytes as unverified, not a genuine FAILED', async () => {
    const provider = new DocumentOcrProvider(true);
    const result = await provider.handleCallback({ contentType: 'image/jpeg' });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw).toMatchObject({ reason: 'missing_image' });
  });

  it('rejects an unsupported content type', async () => {
    const provider = new DocumentOcrProvider(true);
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('bytes'),
      contentType: 'application/pdf',
    });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw).toMatchObject({ reason: 'unsupported_content_type' });
  });

  it('handleCallback throws in production mode, where no real OCR vendor is wired up yet', async () => {
    const provider = new DocumentOcrProvider(false);
    await expect(
      provider.handleCallback({ imageBytes: Buffer.from('bytes'), contentType: 'image/jpeg' }),
    ).rejects.toThrow(/no production OCR vendor/);
  });
});
