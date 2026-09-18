/**
 * Test-only helpers built from real image data rather than fabricated
 * bytes — the same "synthetic but real" testing standard
 * packages/ocr-engine/src/mrz-crop.spec.ts already established. Never
 * imported by production code (test-helpers is not re-exported from
 * index.ts).
 */
import { Jimp } from 'jimp';
import { join, dirname } from 'node:path';

const DEMO_DIR = join(dirname(require.resolve('@vladmandic/face-api/package.json')), 'demo');

/** Real portrait photos bundled with @vladmandic/face-api's own demo assets (MIT-licensed, already a dependency). */
export function samplePhotoPath(name: 'sample1' | 'sample2' | 'sample3' | 'sample4' | 'sample5' | 'sample6'): string {
  return join(DEMO_DIR, `${name}.jpg`);
}

export async function readSamplePhoto(name: Parameters<typeof samplePhotoPath>[0]): Promise<Buffer> {
  const { readFile } = await import('node:fs/promises');
  return readFile(samplePhotoPath(name));
}

/** A real, decodable image with no face in it at all — a plain color field. */
export async function blankImage(): Promise<Buffer> {
  const image = new Jimp({ width: 200, height: 200, color: 0x808080ff });
  return image.getBuffer('image/jpeg');
}

/**
 * Crops a real face (by its real detected bounding box) out of a larger
 * real photo into its own single-face image. `padding` needs to be
 * generous (40px+ measured during development) — too tight a crop and the
 * detector no longer recognizes it as a face at all, presumably because
 * the model expects some surrounding context, not a face filling the
 * entire frame edge-to-edge.
 */
export async function cropToFace(
  imageBytes: Buffer,
  box: { x: number; y: number; width: number; height: number },
  padding: number,
): Promise<Buffer> {
  const image = await Jimp.read(imageBytes);
  const x = Math.max(0, Math.floor(box.x - padding));
  const y = Math.max(0, Math.floor(box.y - padding));
  const w = Math.min(image.bitmap.width - x, Math.ceil(box.width + padding * 2));
  const h = Math.min(image.bitmap.height - y, Math.ceil(box.height + padding * 2));
  const cropped = image.crop({ x, y, w, h });
  return cropped.getBuffer('image/jpeg');
}
