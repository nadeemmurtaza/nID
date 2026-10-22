/**
 * A genuine blink across a frame burst: EAR starts at/above OPEN_THRESHOLD
 * (eyes open), dips to/below CLOSED_THRESHOLD (eyes closed) for at least
 * one frame, then recovers to/above OPEN_THRESHOLD again (eyes reopen).
 * Two thresholds rather than one crossing point is deliberate hysteresis —
 * it stops EAR hovering near a single cutoff from registering as several
 * fake "blinks" out of ordinary landmark jitter. Real open-eye EAR
 * measured ~0.26-0.32 on real photos during development (see
 * eye-aspect-ratio.ts); a closed eye's near-zero vertical spread collapses
 * EAR well below 0.21.
 *
 * This is intentionally the ENTIRE liveness signal from this sequence — no
 * "ended below threshold" shortcut. A subject who simply keeps their eyes
 * shut for the whole capture (which a naive single-threshold check would
 * misread as a blink) never re-opens, so never satisfies this pattern.
 */
const OPEN_THRESHOLD = 0.25;
const CLOSED_THRESHOLD = 0.21;

type BlinkState = 'AWAITING_OPEN' | 'OPEN' | 'CLOSED';

export interface BlinkDetectionResult {
  blinkDetected: boolean;
  minEar: number;
  maxEar: number;
}

export function detectBlink(earSequence: number[]): BlinkDetectionResult {
  if (earSequence.length === 0) {
    return { blinkDetected: false, minEar: 0, maxEar: 0 };
  }

  let state: BlinkState = 'AWAITING_OPEN';
  let blinkDetected = false;
  let minEar = earSequence[0]!;
  let maxEar = earSequence[0]!;

  for (const ear of earSequence) {
    minEar = Math.min(minEar, ear);
    maxEar = Math.max(maxEar, ear);

    if (state === 'AWAITING_OPEN' && ear >= OPEN_THRESHOLD) {
      state = 'OPEN';
    } else if (state === 'OPEN' && ear <= CLOSED_THRESHOLD) {
      state = 'CLOSED';
    } else if (state === 'CLOSED' && ear >= OPEN_THRESHOLD) {
      blinkDetected = true;
      state = 'OPEN'; // Ready to detect a second blink in the same burst, though one is all this check requires.
    }
  }

  return { blinkDetected, minEar, maxEar };
}
