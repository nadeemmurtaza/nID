/**
 * A real, hand-built minimal JPEG APP1/EXIF segment (genuine TIFF/IFD byte
 * layout per the EXIF 2.3 spec) — test-only, never imported by production
 * code (test-helpers is not re-exported from index.ts). What exif-consistency.ts
 * needs proven live is that its readExifTags() wiring into the real exifr
 * parser round-trips real bytes correctly; exifr's own parsing correctness
 * is exifr's concern (a mature, independently-tested library), not
 * something worth re-verifying by mocking its output.
 *
 * Only what evaluate-forensics actually reads is written: IFD0's Make,
 * Model, Software and DateTime (-> exifr's "ModifyDate"), plus one Exif
 * SubIFD tag, DateTimeOriginal. No thumbnail, no GPS, no maker notes — a
 * real camera/editor writes far more than this, but this is everything a
 * minimal valid EXIF document needs to carry those five fields.
 */

export interface ExifFixtureFields {
  make: string;
  model: string;
  software: string;
  /** "YYYY:MM:DD HH:MM:SS" — EXIF's fixed date format. */
  modifyDate: string;
  dateTimeOriginal: string;
}

const TIFF_TYPE_ASCII = 2;
const TIFF_TYPE_LONG = 4;
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_SOFTWARE = 0x0131;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;

interface PendingEntry {
  tag: number;
  type: number;
  value: string;
}

/** Encodes one IFD (a count, its 12-byte entries, a next-IFD offset, and its ASCII value data) at `ifdOffset`, returning the bytes and where the data area ended. */
function encodeIfd(
  entries: PendingEntry[],
  ifdOffset: number,
  nextIfdOffset: number,
  extraLongValue?: { tag: number; value: number },
): { bytes: Buffer; dataAreaEnd: number } {
  const entryCount = entries.length + (extraLongValue ? 1 : 0);
  const dataAreaStart = ifdOffset + 2 + entryCount * 12 + 4;

  const entryBuffers: Buffer[] = [];
  const dataBuffers: Buffer[] = [];
  let dataCursor = dataAreaStart;

  for (const entry of entries) {
    const stringBytes = Buffer.from(entry.value + '\0', 'ascii');
    const entryBuffer = Buffer.alloc(12);
    entryBuffer.writeUInt16LE(entry.tag, 0);
    entryBuffer.writeUInt16LE(entry.type, 2);
    entryBuffer.writeUInt32LE(stringBytes.length, 4);
    entryBuffer.writeUInt32LE(dataCursor, 8);
    entryBuffers.push(entryBuffer);
    dataBuffers.push(stringBytes);
    dataCursor += stringBytes.length;
  }

  if (extraLongValue) {
    const entryBuffer = Buffer.alloc(12);
    entryBuffer.writeUInt16LE(extraLongValue.tag, 0);
    entryBuffer.writeUInt16LE(TIFF_TYPE_LONG, 2);
    entryBuffer.writeUInt32LE(1, 4);
    entryBuffer.writeUInt32LE(extraLongValue.value, 8);
    entryBuffers.push(entryBuffer);
  }

  const countBuffer = Buffer.alloc(2);
  countBuffer.writeUInt16LE(entryCount, 0);
  const nextIfdBuffer = Buffer.alloc(4);
  nextIfdBuffer.writeUInt32LE(nextIfdOffset, 0);

  return {
    bytes: Buffer.concat([countBuffer, ...entryBuffers, nextIfdBuffer, ...dataBuffers]),
    dataAreaEnd: dataCursor,
  };
}

export function buildJpegWithExif(fields: ExifFixtureFields): Buffer {
  const tiffHeader = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]); // "II", 42, IFD0 @ offset 8
  const ifd0Offset = 8;

  // Exif SubIFD's own offset depends on IFD0's encoded size, so encode IFD0
  // first with a placeholder pointer, then patch it once the SubIFD's real
  // offset is known.
  const ifd0Entries: PendingEntry[] = [
    { tag: TAG_MAKE, type: TIFF_TYPE_ASCII, value: fields.make },
    { tag: TAG_MODEL, type: TIFF_TYPE_ASCII, value: fields.model },
    { tag: TAG_SOFTWARE, type: TIFF_TYPE_ASCII, value: fields.software },
    { tag: TAG_DATETIME, type: TIFF_TYPE_ASCII, value: fields.modifyDate },
  ];
  const ifd0Pass = encodeIfd(ifd0Entries, ifd0Offset, 0, { tag: TAG_EXIF_IFD_POINTER, value: 0 });
  const exifIfdOffset = ifd0Offset + ifd0Pass.bytes.length;

  const ifd0Final = encodeIfd(ifd0Entries, ifd0Offset, 0, {
    tag: TAG_EXIF_IFD_POINTER,
    value: exifIfdOffset,
  });

  const exifIfd = encodeIfd([{ tag: TAG_DATETIME_ORIGINAL, type: TIFF_TYPE_ASCII, value: fields.dateTimeOriginal }], exifIfdOffset, 0);

  const tiffPayload = Buffer.concat([tiffHeader, ifd0Final.bytes, exifIfd.bytes]);
  const exifSegment = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiffPayload]);

  const app1Length = exifSegment.length + 2; // includes the length field itself
  const app1Header = Buffer.alloc(4);
  app1Header.writeUInt16BE(0xffe1, 0);
  app1Header.writeUInt16BE(app1Length, 2);

  const soi = Buffer.from([0xff, 0xd8]);
  const eoi = Buffer.from([0xff, 0xd9]);

  return Buffer.concat([soi, app1Header, exifSegment, eoi]);
}
