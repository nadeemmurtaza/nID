import { Jimp } from 'jimp';

/**
 * Real-world MRZ recognition always crops tightly to the MRZ band before
 * OCR — feeding a whole passport bio-data page (photo, holder info, security
 * printing) to a text engine competes the MRZ's own signal against all of
 * that. This finds the band without any ML model: a TD3 bio-data page's MRZ
 * is, by the ICAO Doc 9303 layout itself, two lines of dense, full-width,
 * monospace (OCR-B) text sitting at the very bottom of the page — a
 * genuinely distinctive pixel signature (a row-by-row dark-pixel density
 * profile) compared to everything above it, no training data required.
 */

export interface MrzCropResult {
  imageBytes: Buffer;
  /** False when no band matching the MRZ's expected shape was found — the caller should fall back to the full image. */
  cropped: boolean;
}

/** A pixel this much below full brightness (0-255 per channel) counts as "ink", not background. */
const DARK_LUMINANCE_THRESHOLD = 140;
/** A text row's ink coverage across its width — MRZ's dense monospace glyphs clear this; sparser header text/photo shading don't. */
const DARK_ROW_RATIO_THRESHOLD = 0.12;
/** TD3's MRZ sits in the bottom portion of the bio-data page — never search the photo/header area above it. */
const BOTTOM_SEARCH_FRACTION = 0.45;
/** A real text line is at least a few pixels tall even in a modest-resolution capture — filters out single-row noise. */
const MIN_BAND_ROWS = 3;
/** A little breathing room around the detected band so a glyph's ascender/descender isn't clipped. */
const PADDING_ROWS = 4;

interface RowBand {
  start: number;
  end: number;
}

/**
 * Crops `imageBytes` to its likely MRZ band. Returns the original bytes
 * with `cropped: false` when no plausible band is found — a heuristic that
 * can't confirm what it's looking at must not silently discard part of the
 * image the caller still needs to see.
 */
export async function autoCropToMrzBand(imageBytes: Buffer): Promise<MrzCropResult> {
  const image = await Jimp.read(imageBytes);
  const { width, height, data } = image.bitmap;
  if (width === 0 || height === 0) {
    return { imageBytes, cropped: false };
  }

  const searchStart = Math.floor(height * (1 - BOTTOM_SEARCH_FRACTION));
  const darkRatioByRow: number[] = [];
  for (let y = searchStart; y < height; y++) {
    let darkCount = 0;
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + x * 4;
      const luminance = 0.299 * data[pixelOffset]! + 0.587 * data[pixelOffset + 1]! + 0.114 * data[pixelOffset + 2]!;
      if (luminance < DARK_LUMINANCE_THRESHOLD) {
        darkCount++;
      }
    }
    darkRatioByRow.push(darkCount / width);
  }

  const bands = findBands(darkRatioByRow, DARK_ROW_RATIO_THRESHOLD).filter(
    (band) => band.end - band.start + 1 >= MIN_BAND_ROWS,
  );
  if (bands.length === 0) {
    return { imageBytes, cropped: false };
  }

  // The MRZ's two lines are the bottommost qualifying bands — a passport
  // photo's shading or a signature strip can also clear the density
  // threshold higher up the page, but on a TD3 layout the MRZ is always
  // the strip closest to the bottom edge.
  const lastBand = bands[bands.length - 1]!;
  const secondLastBand = bands.length >= 2 ? bands[bands.length - 2]! : lastBand;

  const cropTop = Math.max(0, searchStart + secondLastBand.start - PADDING_ROWS);
  const cropBottom = Math.min(height, searchStart + lastBand.end + 1 + PADDING_ROWS);
  const cropHeight = cropBottom - cropTop;
  if (cropHeight <= 0) {
    return { imageBytes, cropped: false };
  }

  const cropped = image.crop({ x: 0, y: cropTop, w: width, h: cropHeight });
  const croppedBytes = await cropped.getBuffer('image/png');
  return { imageBytes: croppedBytes, cropped: true };
}

/** Contiguous runs of rows whose value clears `threshold` — each run is one candidate text line. */
function findBands(values: number[], threshold: number): RowBand[] {
  const bands: RowBand[] = [];
  let start: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const clears = values[i]! >= threshold;
    if (clears && start === null) {
      start = i;
    }
    if (!clears && start !== null) {
      bands.push({ start, end: i - 1 });
      start = null;
    }
  }
  if (start !== null) {
    bands.push({ start, end: values.length - 1 });
  }
  return bands;
}
