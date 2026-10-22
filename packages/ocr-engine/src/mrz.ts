/**
 * Parses and checksum-validates a passport's Machine Readable Zone (MRZ) —
 * ICAO Doc 9303 TD3 format: two 44-character lines printed at the bottom of
 * every passport photo page. This is real, checksum-backed evidence: a
 * document whose MRZ check digits don't match what's printed has either
 * been tampered with or OCR'd incorrectly, and either way isn't safe to
 * pass automatically.
 *
 * Deliberately TD3 (passport) only. ID cards mostly use TD1 (three
 * 30-character lines) with a different field layout and a composite check
 * digit computed over a different set of ranges — implementing that from
 * memory with the same confidence as TD3 risks silently validating a wrong
 * checksum, which is worse than not validating at all. A TD1-shaped MRZ is
 * detected (see looksLikeMrz) but returns unparsed, falling through to the
 * caller's honest "no structured check available" path rather than a
 * fabricated one.
 */

const WEIGHTS = [7, 3, 1];

function charValue(ch: string): number {
  if (ch === '<') return 0;
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - '0'.charCodeAt(0);
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
  throw new Error(`Invalid MRZ character: "${ch}"`);
}

function computeCheckDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    sum += charValue(field[i]!) * WEIGHTS[i % 3]!;
  }
  return sum % 10;
}

function parseMrzDate(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  // MRZ years have no century marker. Documents are either birth dates
  // (assume 1900s/2000s split at the current year, same convention every
  // MRZ reader uses) or future expiry dates (assume 2000s).
  const century = yy > new Date().getFullYear() % 100 ? 1900 : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

export interface ParsedMrz {
  documentType: string;
  issuingCountry: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string | null;
  sex: string;
  expiryDate: string | null;
  surname: string;
  givenNames: string;
  /** True only when every individual field checksum AND the composite checksum match. */
  checksumValid: boolean;
  failedChecks: string[];
}

/** Quick shape check before attempting a full parse — two 44-char lines of MRZ-legal characters. */
export function looksLikeMrz(text: string): boolean {
  const lines = normalizeLines(text);
  return lines.some((line) => /^[A-Z0-9<]{44}$/.test(line));
}

/**
 * Loose pre-check for "this general OCR pass probably contains an MRZ,
 * even though it's not clean enough yet to parse" — three or more
 * consecutive '<' filler characters is a strong signal a real diploma,
 * letter, or other prose document essentially never produces by accident,
 * even allowing for OCR noise around it. Used to decide whether a second,
 * MRZ-restricted OCR pass (see @nid/ocr-engine's extractMrzCandidateText)
 * is worth running at all.
 */
export function looksLikeMrzCandidate(text: string): boolean {
  return normalizeLines(text).some((line) => /<{3,}/.test(line) && line.length >= 20);
}

function normalizeLines(text: string): string[] {
  return text
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/[^A-Z0-9<]/g, ''))
    .filter((line) => line.length > 0);
}

/**
 * Finds two consecutive 44-character MRZ lines in OCR'd text and validates
 * every checksum. Returns null if no TD3-shaped MRZ is found — a
 * non-passport document, or OCR noise, not necessarily a forged one.
 */
export function parseTd3Mrz(text: string): ParsedMrz | null {
  const lines = normalizeLines(text);
  let line1: string | undefined;
  let line2: string | undefined;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^[A-Z0-9<]{44}$/.test(lines[i]!) && /^[A-Z0-9<]{44}$/.test(lines[i + 1]!)) {
      line1 = lines[i];
      line2 = lines[i + 1];
      break;
    }
  }
  if (!line1 || !line2 || line1[0] !== 'P') return null;

  const documentType = line1.slice(0, 2).replace(/</g, '');
  const issuingCountry = line1.slice(2, 5);
  const nameField = line1.slice(5, 44);
  const [surnameRaw, givenNamesRaw = ''] = nameField.split('<<');
  const surname = surnameRaw!.replace(/</g, ' ').trim();
  const givenNames = givenNamesRaw.replace(/</g, ' ').trim();

  const documentNumber = line2.slice(0, 9);
  const documentNumberCheck = line2[9]!;
  const nationality = line2.slice(10, 13);
  const dob = line2.slice(13, 19);
  const dobCheck = line2[19]!;
  const sex = line2[20]!;
  const expiry = line2.slice(21, 27);
  const expiryCheck = line2[27]!;
  const personalNumber = line2.slice(28, 42);
  const personalNumberCheck = line2[42]!;
  const compositeCheck = line2[43]!;

  const failedChecks: string[] = [];

  if (String(computeCheckDigit(documentNumber)) !== documentNumberCheck) {
    failedChecks.push('document_number');
  }
  if (String(computeCheckDigit(dob)) !== dobCheck) {
    failedChecks.push('date_of_birth');
  }
  if (String(computeCheckDigit(expiry)) !== expiryCheck) {
    failedChecks.push('expiry_date');
  }
  // An all-filler personal number field has no meaningful check digit —
  // some issuers print '<' there instead of a real digit.
  if (personalNumber.replace(/</g, '').length > 0 || personalNumberCheck !== '<') {
    if (String(computeCheckDigit(personalNumber)) !== personalNumberCheck) {
      failedChecks.push('personal_number');
    }
  }
  const compositeField =
    documentNumber + documentNumberCheck + dob + dobCheck + expiry + expiryCheck + personalNumber + personalNumberCheck;
  if (String(computeCheckDigit(compositeField)) !== compositeCheck) {
    failedChecks.push('composite');
  }

  return {
    documentType,
    issuingCountry,
    documentNumber: documentNumber.replace(/</g, ''),
    nationality,
    dateOfBirth: parseMrzDate(dob),
    sex,
    expiryDate: parseMrzDate(expiry),
    surname,
    givenNames,
    checksumValid: failedChecks.length === 0,
    failedChecks,
  };
}
