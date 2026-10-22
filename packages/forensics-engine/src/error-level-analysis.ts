import { Jimp } from 'jimp';

/**
 * Error Level Analysis: a genuine, well-established JPEG forensic technique,
 * not a heuristic invented for this codebase. JPEG compresses in 8x8 pixel
 * blocks; once an image (or a region pasted into it) has been through a
 * given compression generation, re-saving it at a *fixed* quality drives
 * already-stable blocks toward an even lower error on the next pass, while a
 * block from a different edit history (spliced in from another image, or
 * touched by a paint/clone tool) hasn't reached that same local error
 * minimum yet and stands out with a measurably higher re-compression error
 * than its surroundings. This never proves tampering by itself — a
 * genuinely flat, high-contrast area (a solid ink stamp, a printed black
 * bar) can also show elevated error with no forgery involved — which is why
 * evaluate-forensics.ts only ever treats this as one vote among several, not
 * a standalone verdict.
 */

export interface ElaResult {
  /** False for images too small to divide into a meaningful block grid — no verdict possible. */
  applicable: boolean;
  totalBlockCount: number;
  hotspotBlockCount: number;
  hotspotRatio: number;
  meanBlockError: number;
  maxBlockError: number;
  suspicious: boolean;
}

/** 8x8 matches JPEG's own DCT block size — the unit the compression error actually varies at. */
const BLOCK_SIZE = 8;
/** The quality ELA re-saves at — fixed and arbitrary by design; only relative error across blocks matters. */
const RESAVE_QUALITY = 90;
/**
 * A block needs at least this raw error (0-255 scale, averaged across an
 * 8x8x3 block) before "unusually high vs. its neighbors" is worth flagging
 * at all — measured empirically: a single extra JPEG generation at this
 * resave quality moves a smooth region well under 1 and a genuinely
 * high-frequency/noisy region to roughly 3-4, so this sits meaningfully
 * above the former and below the latter.
 */
const MIN_HOTSPOT_ERROR = 1.5;
/**
 * How many robust (MAD-based) standard-deviation-equivalents above the
 * image's own median block error counts as a genuine outlier. Median/MAD
 * rather than mean/stddev deliberately — a real spliced region is often
 * 10-20% of an image's blocks, enough to drag a plain mean/stddev estimate
 * up with the very outliers it's trying to detect; the median and the
 * median absolute deviation stay anchored to the untouched majority
 * instead.
 */
const HOTSPOT_MAD_MULTIPLIER = 3;
/** Scales MAD to be comparable to a normal distribution's standard deviation — the standard consistency constant for this estimator. */
const MAD_TO_STDDEV = 1.4826;
/** Below this, too few blocks are anomalous to mean anything (could be a single noisy pixel run). */
const MIN_HOTSPOT_RATIO = 0.004;
/**
 * Above this, the elevated error is spread across most of the image rather
 * than localized — consistent with the whole image simply having gone
 * through JPEG compression already (nothing to do with a *local* splice),
 * so it stops counting as this specific signal.
 */
const MAX_HOTSPOT_RATIO = 0.5;
const MIN_GRID_BLOCKS = 4;

export async function runErrorLevelAnalysis(imageBytes: Buffer): Promise<ElaResult> {
  const original = await Jimp.read(imageBytes);
  const { width, height } = original.bitmap;

  const cols = Math.floor(width / BLOCK_SIZE);
  const rows = Math.floor(height / BLOCK_SIZE);
  if (cols * rows < MIN_GRID_BLOCKS) {
    return notApplicable();
  }

  const resavedBytes = await original.clone().getBuffer('image/jpeg', { quality: RESAVE_QUALITY });
  const resaved = await Jimp.read(resavedBytes);

  const blockErrors: number[] = [];
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      blockErrors.push(meanBlockError(original.bitmap, resaved.bitmap, bx * BLOCK_SIZE, by * BLOCK_SIZE));
    }
  }

  const meanBlockErrorValue = average(blockErrors);
  const median = percentile(blockErrors, 0.5);
  const absoluteDeviations = blockErrors.map((value) => Math.abs(value - median));
  const mad = percentile(absoluteDeviations, 0.5);
  const robustStddev = mad * MAD_TO_STDDEV;
  const threshold = Math.max(MIN_HOTSPOT_ERROR, median + HOTSPOT_MAD_MULTIPLIER * robustStddev);

  const hotspotBlockCount = blockErrors.filter((value) => value > threshold).length;
  const hotspotRatio = hotspotBlockCount / blockErrors.length;

  return {
    applicable: true,
    totalBlockCount: blockErrors.length,
    hotspotBlockCount,
    hotspotRatio,
    meanBlockError: meanBlockErrorValue,
    maxBlockError: Math.max(...blockErrors),
    suspicious: hotspotRatio >= MIN_HOTSPOT_RATIO && hotspotRatio <= MAX_HOTSPOT_RATIO,
  };
}

function meanBlockError(
  original: { width: number; data: Buffer },
  resaved: { data: Buffer },
  startX: number,
  startY: number,
): number {
  const { width, data: originalData } = original;
  const { data: resavedData } = resaved;

  let total = 0;
  let count = 0;
  for (let y = startY; y < startY + BLOCK_SIZE; y++) {
    for (let x = startX; x < startX + BLOCK_SIZE; x++) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        total += Math.abs(originalData[offset + channel]! - resavedData[offset + channel]!);
        count++;
      }
    }
  }
  return total / count;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length));
  return sorted[index]!;
}

function notApplicable(): ElaResult {
  return {
    applicable: false,
    totalBlockCount: 0,
    hotspotBlockCount: 0,
    hotspotRatio: 0,
    meanBlockError: 0,
    maxBlockError: 0,
    suspicious: false,
  };
}
