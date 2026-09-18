import { detectBlink } from './blink-detector';

const OPEN = 0.3; // well above OPEN_THRESHOLD (0.25)
const CLOSED = 0.1; // well below CLOSED_THRESHOLD (0.21)

describe('detectBlink', () => {
  it('detects a genuine open -> closed -> open sequence', () => {
    const result = detectBlink([OPEN, OPEN, CLOSED, CLOSED, OPEN, OPEN]);
    expect(result.blinkDetected).toBe(true);
    expect(result.minEar).toBeCloseTo(CLOSED);
    expect(result.maxEar).toBeCloseTo(OPEN);
  });

  it('does not report a blink for eyes that stay open the whole capture', () => {
    const result = detectBlink([OPEN, OPEN, OPEN, OPEN]);
    expect(result.blinkDetected).toBe(false);
  });

  it('does NOT report a blink for eyes that close and never reopen — the key anti-shortcut property', () => {
    // A naive "did EAR ever cross below threshold" check would wrongly
    // treat "subject kept their eyes shut the whole time" as a blink.
    // This is exactly why the real detector requires recovery back to OPEN.
    const result = detectBlink([OPEN, OPEN, CLOSED, CLOSED, CLOSED]);
    expect(result.blinkDetected).toBe(false);
  });

  it('does not report a blink for a sequence that never opens in the first place', () => {
    const result = detectBlink([CLOSED, CLOSED, OPEN, OPEN]);
    // AWAITING_OPEN never transitions to OPEN before hitting CLOSED, so the
    // initial dip is not counted as a blink — only a dip FROM an already-
    // confirmed-open state counts, matching the real capture flow (the
    // subject's eyes should already be open when the burst starts).
    expect(result.blinkDetected).toBe(false);
  });

  it('handles an empty sequence without throwing', () => {
    expect(detectBlink([])).toEqual({ blinkDetected: false, minEar: 0, maxEar: 0 });
  });

  it('detects a blink even with noisy mid-range values around the thresholds, via hysteresis', () => {
    const result = detectBlink([OPEN, 0.23, OPEN, CLOSED, 0.23, OPEN]);
    expect(result.blinkDetected).toBe(true);
  });
});
