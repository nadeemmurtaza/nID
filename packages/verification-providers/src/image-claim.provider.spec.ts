import { ImageClaimProvider } from './image-claim.provider';
import type { VerificationContext } from './types';

// Mocked here so this stays a fast, isolated unit test of the devMode
// wiring — evaluateDocument's real behavior (Tesseract OCR + MRZ checksum
// validation) is proven for real against the published ICAO 9303 worked
// example in @nid/ocr-engine's own tests, and against a real generated
// image in the live validation pass (see docs/PHASES.md).
jest.mock('@nid/ocr-engine', () => ({
  evaluateDocument: jest.fn(),
}));
const { evaluateDocument } = jest.requireMock('@nid/ocr-engine') as { evaluateDocument: jest.Mock };

// Same reasoning as @nid/ocr-engine above — evaluateForensics's real
// behavior (ELA, EXIF consistency, recapture/moire detection) is proven
// for real, against real image bytes, in @nid/forensics-engine's own test
// suite. Defaults to a clean verdict so the pre-existing OCR-focused tests
// below don't need to know forensics exists; tests that care about the
// combination override this per-call.
jest.mock('@nid/forensics-engine', () => ({
  evaluateForensics: jest.fn(),
}));
const { evaluateForensics } = jest.requireMock('@nid/forensics-engine') as { evaluateForensics: jest.Mock };
const CLEAN_FORENSICS = { verdict: 'CLEAN', suspiciousSignalCount: 0, signals: {} };

describe('ImageClaimProvider', () => {
  const context: VerificationContext = {
    caseId: 'case_1',
    tenantId: 'tenant_1',
    subjectId: 'subject_1',
    input: {},
  };

  beforeEach(() => {
    evaluateForensics.mockResolvedValue(CLEAN_FORENSICS);
  });

  it('start() has nothing to send and returns pending immediately', async () => {
    const provider = new ImageClaimProvider('document_ocr', 'Document OCR', true);
    const result = await provider.start(context);
    expect(result).toEqual({ pending: true });
  });

  it('exposes whatever key/label it was instantiated with', () => {
    const provider = new ImageClaimProvider('education_document', 'Education document', true);
    expect(provider.key).toBe('education_document');
    expect(provider.label).toBe('Education document');
  });

  it('handleCallback in dev mode mocks a PASSED result by default', async () => {
    const provider = new ImageClaimProvider('dob_document', 'Date of birth document', true);
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('fake jpeg bytes'),
      contentType: 'image/jpeg',
    });

    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
    expect(result.raw).toMatchObject({ mode: 'dev_mock' });
  });

  it('handleCallback respects an explicit mockOutcome for deterministic testing', async () => {
    const provider = new ImageClaimProvider('employment_document', 'Employment document', true);
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('fake jpeg bytes'),
      contentType: 'image/jpeg',
      mockOutcome: 'NEEDS_REVIEW',
    });

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.verified).toBe(true);
  });

  it('rejects a callback with no image bytes as unverified, not a genuine FAILED', async () => {
    const provider = new ImageClaimProvider('document_ocr', 'Document OCR', true);
    const result = await provider.handleCallback({ contentType: 'image/jpeg' });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw).toMatchObject({ reason: 'missing_image' });
  });

  it('rejects an unsupported content type', async () => {
    const provider = new ImageClaimProvider('document_ocr', 'Document OCR', true);
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('bytes'),
      contentType: 'application/pdf',
    });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(false);
    expect(result.raw).toMatchObject({ reason: 'unsupported_content_type' });
  });

  it('handleCallback in production mode runs the real OCR pipeline and passes its result through', async () => {
    evaluateDocument.mockResolvedValueOnce({
      status: 'PASSED',
      raw: { engine: 'tesseract+mrz', mrz: { documentNumber: 'L898902C3' } },
    });

    const provider = new ImageClaimProvider('education_document', 'Education document', false);
    const imageBytes = Buffer.from('real image bytes would go here');
    const result = await provider.handleCallback({ imageBytes, contentType: 'image/jpeg' });

    expect(evaluateDocument).toHaveBeenCalledWith(imageBytes);
    expect(result.status).toBe('PASSED');
    expect(result.verified).toBe(true);
    expect(result.raw).toMatchObject({ engine: 'tesseract+mrz' });
  });

  it('propagates a NEEDS_REVIEW result from the real pipeline unchanged', async () => {
    evaluateDocument.mockResolvedValueOnce({
      status: 'NEEDS_REVIEW',
      raw: { engine: 'tesseract', reason: 'no_mrz_manual_review_required' },
    });

    const provider = new ImageClaimProvider('employment_document', 'Employment document', false);
    const result = await provider.handleCallback({
      imageBytes: Buffer.from('bytes'),
      contentType: 'image/jpeg',
    });

    expect(result.status).toBe('NEEDS_REVIEW');
  });

  it('overrides a PASSED OCR result to FAILED when forensics finds corroborated tampering', async () => {
    evaluateDocument.mockResolvedValueOnce({
      status: 'PASSED',
      raw: { engine: 'tesseract+mrz', mrz: { checksumValid: true } },
    });
    evaluateForensics.mockResolvedValueOnce({
      verdict: 'TAMPERED',
      suspiciousSignalCount: 2,
      signals: { ela: { suspicious: true }, exif: { suspicious: true }, recapture: { suspicious: false } },
    });

    const provider = new ImageClaimProvider('document_ocr', 'Document OCR', false);
    const result = await provider.handleCallback({ imageBytes: Buffer.from('bytes'), contentType: 'image/jpeg' });

    expect(result.status).toBe('FAILED');
    expect(result.verified).toBe(true);
    expect(result.raw).toMatchObject({ forensics: { verdict: 'TAMPERED' } });
    // The checksum-valid MRZ read is still worth keeping in the audit trail
    // even though forensics vetoed it — evidence of what OCR itself found.
    expect(result.raw).toMatchObject({ mrz: { checksumValid: true } });
  });

  it('downgrades a PASSED OCR result to NEEDS_REVIEW when exactly one forensics signal is suspicious', async () => {
    evaluateDocument.mockResolvedValueOnce({ status: 'PASSED', raw: {} });
    evaluateForensics.mockResolvedValueOnce({
      verdict: 'SUSPICIOUS',
      suspiciousSignalCount: 1,
      signals: {},
    });

    const provider = new ImageClaimProvider('document_ocr', 'Document OCR', false);
    const result = await provider.handleCallback({ imageBytes: Buffer.from('bytes'), contentType: 'image/jpeg' });

    expect(result.status).toBe('NEEDS_REVIEW');
  });

  it('does not upgrade or otherwise touch a result OCR already failed, even with corroborated tampering', async () => {
    evaluateDocument.mockResolvedValueOnce({ status: 'FAILED', raw: { reason: 'no_readable_text' } });
    evaluateForensics.mockResolvedValueOnce({ verdict: 'TAMPERED', suspiciousSignalCount: 3, signals: {} });

    const provider = new ImageClaimProvider('document_ocr', 'Document OCR', false);
    const result = await provider.handleCallback({ imageBytes: Buffer.from('bytes'), contentType: 'image/jpeg' });

    expect(result.status).toBe('FAILED');
  });

  it('leaves a PASSED OCR result untouched when forensics is clean', async () => {
    evaluateDocument.mockResolvedValueOnce({ status: 'PASSED', raw: {} });
    evaluateForensics.mockResolvedValueOnce(CLEAN_FORENSICS);

    const provider = new ImageClaimProvider('document_ocr', 'Document OCR', false);
    const result = await provider.handleCallback({ imageBytes: Buffer.from('bytes'), contentType: 'image/jpeg' });

    expect(result.status).toBe('PASSED');
  });
});
