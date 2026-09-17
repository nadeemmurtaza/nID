import { looksLikeMrz, parseTd3Mrz } from './mrz';

/**
 * Fixture built the same way a real MRZ is: compute each check digit with
 * the same weighted-mod-10 algorithm the parser validates against, rather
 * than copying a passport-generator sample — proves the parser computes
 * checksums correctly, not just that it matches one known-good string.
 */
function checkDigit(field: string): string {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const ch = field[i]!;
    const value = ch === '<' ? 0 : ch >= '0' && ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 65 + 10;
    sum += value * weights[i % 3]!;
  }
  return String(sum % 10);
}

function buildTd3(overrides: Partial<{ documentNumber: string; dob: string; expiry: string; personalNumber: string }> = {}) {
  const documentNumber = (overrides.documentNumber ?? 'L898902C3').padEnd(9, '<');
  const dob = overrides.dob ?? '740812';
  const expiry = overrides.expiry ?? '120415';
  const personalNumber = (overrides.personalNumber ?? 'ZE184226B').padEnd(14, '<');

  const documentNumberCheck = checkDigit(documentNumber);
  const dobCheck = checkDigit(dob);
  const expiryCheck = checkDigit(expiry);
  const personalNumberCheck = checkDigit(personalNumber);
  const composite =
    documentNumber + documentNumberCheck + dob + dobCheck + expiry + expiryCheck + personalNumber + personalNumberCheck;
  const compositeCheck = checkDigit(composite);

  const line1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const line2 = `${documentNumber}${documentNumberCheck}UTO${dob}${dobCheck}F${expiry}${expiryCheck}${personalNumber}${personalNumberCheck}${compositeCheck}`;

  return `${line1}\n${line2}`;
}

describe('parseTd3Mrz', () => {
  it('validates a correctly-checksummed passport MRZ', () => {
    const mrz = buildTd3();
    const parsed = parseTd3Mrz(mrz);

    expect(parsed).not.toBeNull();
    expect(parsed?.checksumValid).toBe(true);
    expect(parsed?.failedChecks).toEqual([]);
    expect(parsed?.documentType).toBe('P');
    expect(parsed?.issuingCountry).toBe('UTO');
    expect(parsed?.surname).toBe('ERIKSSON');
    expect(parsed?.givenNames).toBe('ANNA MARIA');
    expect(parsed?.dateOfBirth).toBe('1974-08-12');
    expect(parsed?.expiryDate).toBe('2012-04-15');
  });

  it('flags a tampered document number as a failed checksum', () => {
    const mrz = buildTd3();
    // Corrupt one character of the document number field on line 2, leaving
    // its check digit (and every other field) untouched — exactly what a
    // forged or misread document number looks like.
    const lines = mrz.split('\n');
    const corruptedLine2 = 'X' + lines[1]!.slice(1);
    const parsed = parseTd3Mrz(`${lines[0]}\n${corruptedLine2}`);

    expect(parsed).not.toBeNull();
    expect(parsed?.checksumValid).toBe(false);
    expect(parsed?.failedChecks).toContain('document_number');
    expect(parsed?.failedChecks).toContain('composite');
  });

  it('flags a tampered expiry date as a failed checksum', () => {
    const mrz = buildTd3({ expiry: '300101' }); // valid check digit computed for the new date
    const lines = mrz.split('\n');
    // Now corrupt just the expiry digits without recomputing its check digit.
    const line2 = lines[1]!;
    const corrupted = line2.slice(0, 21) + '999999' + line2.slice(27);
    const parsed = parseTd3Mrz(`${lines[0]}\n${corrupted}`);

    expect(parsed?.checksumValid).toBe(false);
    expect(parsed?.failedChecks).toContain('expiry_date');
  });

  it('returns null when no TD3-shaped MRZ is present', () => {
    expect(parseTd3Mrz('just some regular OCR text with no machine readable zone at all')).toBeNull();
  });

  it('returns null for a single MRZ-shaped line with no second line to pair it with', () => {
    const onlyLine1 = buildTd3().split('\n')[0]!;
    expect(parseTd3Mrz(onlyLine1)).toBeNull();
  });
});

describe('looksLikeMrz', () => {
  it('detects a 44-character MRZ-shaped line', () => {
    expect(looksLikeMrz(buildTd3())).toBe(true);
  });

  it('does not false-positive on ordinary text', () => {
    expect(looksLikeMrz('Dear Sir or Madam, this is a cover letter.')).toBe(false);
  });
});
