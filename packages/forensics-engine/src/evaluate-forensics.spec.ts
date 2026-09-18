import { Jimp } from 'jimp';
import { decideFromSignals, evaluateForensics } from './evaluate-forensics';
import type { ElaResult } from './error-level-analysis';
import type { ExifResult } from './exif-consistency';
import type { RecaptureResult } from './recapture-artifact';

function ela(suspicious: boolean, applicable = true): ElaResult {
  return { applicable, totalBlockCount: 10, hotspotBlockCount: suspicious ? 2 : 0, hotspotRatio: suspicious ? 0.2 : 0, meanBlockError: 1, maxBlockError: 1, suspicious };
}
function exif(suspicious: boolean): ExifResult {
  return { hasExif: true, tags: {}, editingSoftwareDetected: suspicious, timestampInconsistency: false, suspicious };
}
function recapture(suspicious: boolean, applicable = true): RecaptureResult {
  return { applicable, peakMagnitude: suspicious ? 500 : 10, bandMeanMagnitude: 10, peakRatio: suspicious ? 50 : 1, suspicious };
}

describe('decideFromSignals (pure combination logic)', () => {
  it('is CLEAN when nothing is suspicious', () => {
    const result = decideFromSignals(ela(false), exif(false), recapture(false));
    expect(result.verdict).toBe('CLEAN');
    expect(result.suspiciousSignalCount).toBe(0);
  });

  it('is SUSPICIOUS, not TAMPERED, when exactly one independent signal fires', () => {
    expect(decideFromSignals(ela(true), exif(false), recapture(false)).verdict).toBe('SUSPICIOUS');
    expect(decideFromSignals(ela(false), exif(true), recapture(false)).verdict).toBe('SUSPICIOUS');
    expect(decideFromSignals(ela(false), exif(false), recapture(true)).verdict).toBe('SUSPICIOUS');
  });

  it('is TAMPERED when two or more independent signals corroborate each other', () => {
    const result = decideFromSignals(ela(true), exif(true), recapture(false));
    expect(result.verdict).toBe('TAMPERED');
    expect(result.suspiciousSignalCount).toBe(2);
  });

  it('is TAMPERED when all three agree', () => {
    expect(decideFromSignals(ela(true), exif(true), recapture(true)).verdict).toBe('TAMPERED');
  });

  it('never counts a non-applicable signal toward the verdict even if its own suspicious flag happens to be true', () => {
    const result = decideFromSignals(ela(true, false), exif(true), recapture(true, false));
    // Only exif is applicable-and-suspicious — one real signal, not three.
    expect(result.suspiciousSignalCount).toBe(1);
    expect(result.verdict).toBe('SUSPICIOUS');
  });
});

describe('evaluateForensics (live, real image bytes end to end)', () => {
  it('is CLEAN for a plain, untouched image with no EXIF and no structure', async () => {
    const image = new Jimp({ width: 128, height: 128, color: 0x808080ff });
    const imageBytes = await image.getBuffer('image/jpeg', { quality: 90 });

    const evaluation = await evaluateForensics(imageBytes);

    expect(evaluation.verdict).toBe('CLEAN');
    expect(evaluation.signals.ela.applicable).toBe(true);
    expect(evaluation.signals.recapture.applicable).toBe(true);
  });
});
