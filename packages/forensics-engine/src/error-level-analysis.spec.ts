import { Jimp } from 'jimp';
import { runErrorLevelAnalysis } from './error-level-analysis';

/** Real per-pixel noise via a simple LCG — deterministic but non-uniform, so JPEG's block DCT actually has to encode meaningful per-block detail (a flat color block would compress to near-zero error everywhere and never show a splice). */
function noisyGrid(size: number, seedStart: number): number[][] {
  let seed = seedStart;
  const pseudoRandom = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return Array.from({ length: size }, () => Array.from({ length: size }, () => Math.floor(pseudoRandom() * 256)));
}

async function gridToJpeg(grid: number[][], quality: number): Promise<Buffer> {
  const size = grid.length;
  const image = new Jimp({ width: size, height: size, color: 0x000000ff });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = grid[y]![x]!;
      const color = ((value << 24) | (value << 16) | (value << 8) | 0xff) >>> 0;
      image.setPixelColor(color, x, y);
    }
  }
  return image.getBuffer('image/jpeg', { quality });
}

describe('runErrorLevelAnalysis', () => {
  it('is not applicable to an image too small to form a meaningful block grid', async () => {
    const image = new Jimp({ width: 4, height: 4, color: 0xffffffff });
    const imageBytes = await image.getBuffer('image/png');

    const result = await runErrorLevelAnalysis(imageBytes);

    expect(result.applicable).toBe(false);
  });

  it('finds no localized hotspot in a uniformly flat, never-recompressed image', async () => {
    const image = new Jimp({ width: 64, height: 64, color: 0x808080ff });
    const imageBytes = await image.getBuffer('image/jpeg', { quality: 92 });

    const result = await runErrorLevelAnalysis(imageBytes);

    expect(result.applicable).toBe(true);
    expect(result.suspicious).toBe(false);
  });

  it('finds a localized hotspot where a high-frequency patch was spliced into a smooth background', async () => {
    const size = 64;
    // A real spliced region reliably shows elevated re-compression error
    // for the same underlying reason a smooth background doesn't: JPEG's
    // block DCT represents low/mid-frequency content (a smooth gradient —
    // realistic for a document's plain background) almost losslessly at
    // any reasonable quality, while genuinely high-frequency content (the
    // fine per-pixel noise a different source/sensor/edit introduces)
    // always costs real quantization error to re-encode. A pasted-in
    // region carrying different noise characteristics than its
    // surroundings is exactly the real-world case ELA is used to catch —
    // this synthesizes that mismatch directly rather than fabricating a
    // "detected tampering" output.
    const smoothGrid: number[][] = Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => Math.floor(60 + (x / size) * 40 + (y / size) * 20)),
    );
    const patchGrid = noisyGrid(20, 999);
    const patchX = 22;
    const patchY = 22;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        smoothGrid[patchY + y]![patchX + x] = patchGrid[y]![x]!;
      }
    }
    const composedBytes = await gridToJpeg(smoothGrid, 95);

    const result = await runErrorLevelAnalysis(composedBytes);

    expect(result.applicable).toBe(true);
    expect(result.hotspotBlockCount).toBeGreaterThan(0);
    expect(result.suspicious).toBe(true);
  });
});
