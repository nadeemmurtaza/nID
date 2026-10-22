import { parse as parseExif } from 'exifr';

/**
 * Split the same way evaluate-document.ts's own OCR pipeline is split
 * (see its header comment): a thin real-I/O step that hands off to a
 * mature, independently-tested parser (exifr — real EXIF/TIFF parsing, not
 * a heuristic this codebase invented), and a pure decision step fully
 * unit-testable with hand-built tag objects, no image bytes required.
 *
 * What this checks for is deliberately narrow. A photo having *no* EXIF at
 * all proves nothing on its own — messaging apps (WhatsApp, Telegram) and
 * most web upload widgets strip it by default, so its absence is the
 * common case for a perfectly legitimate submission, not a red flag. What
 * *is* real signal: metadata that positively indicates the file passed
 * through image-editing software after capture, or whose own internal
 * timestamps contradict each other.
 */

export interface ExifTags {
  make?: string;
  model?: string;
  software?: string;
  dateTimeOriginal?: Date;
  modifyDate?: Date;
}

export interface ExifResult {
  hasExif: boolean;
  tags: ExifTags;
  editingSoftwareDetected: boolean;
  timestampInconsistency: boolean;
  suspicious: boolean;
}

/**
 * Case-insensitive substrings of a Software/ProcessingSoftware EXIF tag
 * that name a general-purpose image editor rather than a camera's or
 * scanner's own firmware. Deliberately narrow and named, not "anything
 * that isn't a known camera" — an unrecognized string is not evidence of
 * anything, it just isn't in this list.
 */
const EDITOR_SOFTWARE_MARKERS = [
  'photoshop',
  'gimp',
  'snapseed',
  'pixelmator',
  'affinity photo',
  'paint.net',
  'canva',
  'fotor',
  'picsart',
  'facetune',
];

/** A genuinely single-generation capture's DateTimeOriginal and ModifyDate are the same instant; this much drift means the file was resaved after capture. */
const TIMESTAMP_DRIFT_TOLERANCE_MS = 60_000;

export async function readExifTags(imageBytes: Buffer): Promise<ExifTags> {
  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = await parseExif(imageBytes, { tiff: true, exif: true, gps: false, ifd1: false });
  } catch {
    // Not every submitted image is a JPEG/TIFF with an EXIF segment at all
    // (a PNG screenshot, a re-encoded upload) — absence of parseable EXIF
    // is exactly the "hasExif: false" case below, not an error.
    parsed = undefined;
  }
  if (!parsed) {
    return {};
  }

  return {
    make: typeof parsed['Make'] === 'string' ? parsed['Make'] : undefined,
    model: typeof parsed['Model'] === 'string' ? parsed['Model'] : undefined,
    software: typeof parsed['Software'] === 'string' ? parsed['Software'] : undefined,
    dateTimeOriginal: toDate(parsed['DateTimeOriginal']),
    modifyDate: toDate(parsed['ModifyDate']),
  };
}

function toDate(value: unknown): Date | undefined {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined;
}

export function decideFromExifTags(tags: ExifTags): ExifResult {
  const hasExif = Object.values(tags).some((value) => value !== undefined);

  const editingSoftwareDetected = Boolean(
    tags.software && EDITOR_SOFTWARE_MARKERS.some((marker) => tags.software!.toLowerCase().includes(marker)),
  );

  const timestampInconsistency = Boolean(
    tags.dateTimeOriginal &&
      tags.modifyDate &&
      Math.abs(tags.dateTimeOriginal.getTime() - tags.modifyDate.getTime()) > TIMESTAMP_DRIFT_TOLERANCE_MS,
  );

  return {
    hasExif,
    tags,
    editingSoftwareDetected,
    timestampInconsistency,
    suspicious: editingSoftwareDetected || timestampInconsistency,
  };
}

export async function runExifConsistencyCheck(imageBytes: Buffer): Promise<ExifResult> {
  const tags = await readExifTags(imageBytes);
  return decideFromExifTags(tags);
}
