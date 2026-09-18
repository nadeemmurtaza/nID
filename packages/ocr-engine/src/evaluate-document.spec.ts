import { decideFromExtractedText } from './evaluate-document';

// The real, published ICAO Doc 9303 worked example — same reference used in
// mrz.spec.ts, cross-checked there against the actual standard, not just
// self-consistency.
const VALID_MRZ_TEXT = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

// One character of the tamper-evident composite field changed, checksum
// digits left untouched — exactly what a forged or corrupted document
// number looks like.
const TAMPERED_MRZ_TEXT = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'X898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

describe('decideFromExtractedText', () => {
  it('PASSED: a checksum-valid MRZ is real, authority-issued evidence', () => {
    const result = decideFromExtractedText(VALID_MRZ_TEXT);
    expect(result.status).toBe('PASSED');
    expect(result.raw).toMatchObject({
      engine: 'tesseract+mrz',
      mrz: expect.objectContaining({ documentNumber: 'L898902C3', checksumValid: true }),
    });
  });

  it('PASSED: surfaces the MRZ-encoded name — the one field a checksum-valid document previously dropped', () => {
    const result = decideFromExtractedText(VALID_MRZ_TEXT);
    expect(result.raw).toMatchObject({
      mrz: expect.objectContaining({ surname: 'ERIKSSON', givenNames: 'ANNA MARIA' }),
    });
  });

  it('FAILED: a checksum-invalid MRZ is tampered-or-misread, never silently passed', () => {
    const result = decideFromExtractedText(TAMPERED_MRZ_TEXT);
    expect(result.status).toBe('FAILED');
    expect(result.raw).toMatchObject({
      engine: 'tesseract+mrz',
      mrz: expect.objectContaining({ checksumValid: false }),
    });
  });

  it('FAILED: never surfaces a name from a checksum-invalid MRZ — untrustworthy along with everything else on it', () => {
    const result = decideFromExtractedText(TAMPERED_MRZ_TEXT);
    const mrz = result.raw['mrz'] as Record<string, unknown>;
    expect(mrz['givenNames']).toBeUndefined();
    expect(mrz['surname']).toBeUndefined();
  });

  it('NEEDS_REVIEW: readable text with no MRZ has no checksum to validate against', () => {
    const result = decideFromExtractedText(
      'BACHELOR OF SCIENCE IN COMPUTER SCIENCE\nConferred upon Jane Doe\nMay 2020',
    );
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.raw).toMatchObject({ engine: 'tesseract', reason: 'no_mrz_manual_review_required' });
  });

  it('FAILED: no readable text at all is not a document this check can do anything with', () => {
    const result = decideFromExtractedText('   \n\n  ');
    expect(result.status).toBe('FAILED');
    expect(result.raw).toMatchObject({ reason: 'no_readable_text' });
  });

  it('prefers a valid MRZ found in the targeted second pass over noise in the general pass', () => {
    const noisyGeneralText = 'p<uT0eR1k$$0N<<AnnA<mAr1A garbage here';
    const result = decideFromExtractedText(noisyGeneralText, VALID_MRZ_TEXT);
    expect(result.status).toBe('PASSED');
  });

  it('falls back to the general pass when the targeted pass did not parse either', () => {
    const result = decideFromExtractedText(VALID_MRZ_TEXT, 'still not an mrz');
    expect(result.status).toBe('PASSED');
  });
});
