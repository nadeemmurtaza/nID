import { Jimp } from 'jimp';
import { fft2dMagnitudeShifted } from './fft';

/**
 * Re-photographing a printed document or a phone/computer screen (rather
 * than capturing the original) very reliably introduces moire — a periodic
 * interference pattern between the camera sensor's pixel grid and the
 * regularly-spaced structure being recaptured (a screen's subpixel grid, or
 * a printer/scanner's halftone dot pattern). That periodicity is a genuine,
 * physically-grounded frequency-domain signature, not a guess: a real
 * single-capture document photo has a smoothly-decaying, roughly 1/f-ish
 * spectrum with no sharp off-axis spike, while recapture moire shows up as
 * one or more narrow, unusually strong peaks in the mid-to-high frequency
 * band. This is the actual DSP technique real image-forensics tooling uses
 * for this exact question — not an ML classifier, and not a proxy heuristic
 * like "how sharp is this" that would also fire on a perfectly legitimate
 * flatbed scan.
 */

export interface RecaptureResult {
  applicable: boolean;
  peakMagnitude: number;
  bandMeanMagnitude: number;
  peakRatio: number;
  suspicious: boolean;
}

/** Power-of-two so fft2dMagnitudeShifted's FFT applies directly; also normalizes away the wide range of real upload resolutions. */
const GRID_SIZE = 128;
/**
 * Bins within this radius of DC (in grid units, center = GRID_SIZE/2) are
 * overall brightness/contrast/lighting-gradient content, not periodicity —
 * always excluded, moire or not.
 */
const DC_EXCLUSION_RADIUS = 6;
/** Bins beyond this radius are dominated by sensor/compression noise, not a genuine printed/display grid's fundamental frequency. */
const MAX_BAND_RADIUS = GRID_SIZE / 2 - 4;
/** How far a band's strongest bin must stand out above that band's own mean to count as a genuine narrow spike rather than ordinary spectral energy. */
const PEAK_RATIO_THRESHOLD = 7;
/** A peak this weak in absolute terms isn't worth flagging even if the (possibly near-empty) band's mean is tiny. */
const MIN_PEAK_MAGNITUDE = 40;
const MIN_APPLICABLE_DIMENSION = 32;

export async function runRecaptureArtifactCheck(imageBytes: Buffer): Promise<RecaptureResult> {
  const image = await Jimp.read(imageBytes);
  if (image.bitmap.width < MIN_APPLICABLE_DIMENSION || image.bitmap.height < MIN_APPLICABLE_DIMENSION) {
    return { applicable: false, peakMagnitude: 0, bandMeanMagnitude: 0, peakRatio: 0, suspicious: false };
  }

  const resized = image.clone().greyscale().resize({ w: GRID_SIZE, h: GRID_SIZE });
  const grid = toWindowedGrid(resized.bitmap);
  const spectrum = fft2dMagnitudeShifted(grid);

  const center = GRID_SIZE / 2;
  let peakMagnitude = 0;
  let bandSum = 0;
  let bandCount = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const distance = Math.hypot(x - center, y - center);
      if (distance < DC_EXCLUSION_RADIUS || distance > MAX_BAND_RADIUS) {
        continue;
      }
      const magnitude = spectrum[y]![x]!;
      bandSum += magnitude;
      bandCount++;
      if (magnitude > peakMagnitude) {
        peakMagnitude = magnitude;
      }
    }
  }

  const bandMeanMagnitude = bandCount === 0 ? 0 : bandSum / bandCount;
  const peakRatio = bandMeanMagnitude === 0 ? 0 : peakMagnitude / bandMeanMagnitude;

  return {
    applicable: true,
    peakMagnitude,
    bandMeanMagnitude,
    peakRatio,
    suspicious: peakRatio >= PEAK_RATIO_THRESHOLD && peakMagnitude >= MIN_PEAK_MAGNITUDE,
  };
}

/**
 * Grayscale pixel values, mean-subtracted (removes the true DC term instead
 * of just excluding its bin) and multiplied by a separable Hann window —
 * standard DFT practice that tapers the grid's hard edges to zero so the
 * image boundary's own discontinuity doesn't leak a false spike across the
 * spectrum and get mistaken for real periodicity.
 */
function toWindowedGrid(bitmap: { data: Buffer }): number[][] {
  const { data } = bitmap;
  const n = GRID_SIZE;

  const raw: number[][] = [];
  let sum = 0;
  for (let y = 0; y < n; y++) {
    const row: number[] = [];
    for (let x = 0; x < n; x++) {
      const value = data[(y * n + x) * 4]!;
      row.push(value);
      sum += value;
    }
    raw.push(row);
  }
  const mean = sum / (n * n);

  const hann = (i: number): number => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  const windowed: number[][] = [];
  for (let y = 0; y < n; y++) {
    const row: number[] = [];
    const wy = hann(y);
    for (let x = 0; x < n; x++) {
      row.push((raw[y]![x]! - mean) * hann(x) * wy);
    }
    windowed.push(row);
  }
  return windowed;
}
