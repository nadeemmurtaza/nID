import { runErrorLevelAnalysis, type ElaResult } from './error-level-analysis';
import { runExifConsistencyCheck, type ExifResult } from './exif-consistency';
import { runRecaptureArtifactCheck, type RecaptureResult } from './recapture-artifact';

/**
 * Combines the three independent forensic signals into one verdict. Each
 * one, alone, has known honest false-positive cases (see each module's own
 * header comment) — a solid ink stamp can trip ELA, a scanner's own
 * firmware tag can look unfamiliar to the EXIF check, a legitimately
 * high-contrast background pattern could in principle brush the moire
 * threshold. None of them is reliable enough alone to fail a case
 * automatically. Agreement across independent signals is: two heuristics
 * built on completely different physics (JPEG recompression error, EXIF
 * metadata, frequency-domain periodicity) landing on suspicious for the
 * same image is a materially different, stronger claim than any one of
 * them alone — genuine corroboration, not just "a heuristic fired."
 *
 * This mirrors the same PASSED/FAILED/NEEDS_REVIEW discipline used
 * elsewhere in this codebase (see evaluate-document.ts): a single ambiguous
 * signal goes to NEEDS_REVIEW for a human to look at, never a silent pass
 * or an automatic fail; only corroborated evidence is treated as strong
 * enough to fail a case outright.
 */

export type ForensicsVerdict = 'CLEAN' | 'SUSPICIOUS' | 'TAMPERED';

export interface ForensicsEvaluation {
  verdict: ForensicsVerdict;
  suspiciousSignalCount: number;
  signals: {
    ela: ElaResult;
    exif: ExifResult;
    recapture: RecaptureResult;
  };
}

export async function evaluateForensics(imageBytes: Buffer): Promise<ForensicsEvaluation> {
  const [ela, exif, recapture] = await Promise.all([
    runErrorLevelAnalysis(imageBytes),
    runExifConsistencyCheck(imageBytes),
    runRecaptureArtifactCheck(imageBytes),
  ]);

  return { ...decideFromSignals(ela, exif, recapture), signals: { ela, exif, recapture } };
}

/** Pure combination logic — unit-testable without decoding a real image, same split as every other check in this codebase. */
export function decideFromSignals(
  ela: ElaResult,
  exif: ExifResult,
  recapture: RecaptureResult,
): { verdict: ForensicsVerdict; suspiciousSignalCount: number } {
  const suspiciousSignalCount = [ela.applicable && ela.suspicious, exif.suspicious, recapture.applicable && recapture.suspicious].filter(
    Boolean,
  ).length;

  const verdict: ForensicsVerdict =
    suspiciousSignalCount >= 2 ? 'TAMPERED' : suspiciousSignalCount === 1 ? 'SUSPICIOUS' : 'CLEAN';

  return { verdict, suspiciousSignalCount };
}
