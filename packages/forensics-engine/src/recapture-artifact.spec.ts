import { Jimp } from 'jimp';
import { runRecaptureArtifactCheck } from './recapture-artifact';

const WHITE = 0xffffffff;
const BLACK = 0x000000ff;

/** A real vertical stripe grid — the same kind of periodic structure a screen's subpixel grid (or a printer's halftone dots) produces when re-photographed. */
async function stripedImage(size: number, periodPx: number): Promise<Buffer> {
  const image = new Jimp({ width: size, height: size, color: WHITE });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Math.floor(x / (periodPx / 2)) % 2 === 0) {
        image.setPixelColor(BLACK, x, y);
      }
    }
  }
  return image.getBuffer('image/png');
}

/** A smooth lighting gradient plus small-amplitude non-periodic noise — the kind of spectrum a genuine single-capture document photo has: no sharp off-axis peak. */
async function naturalLookingPhoto(size: number): Promise<Buffer> {
  const image = new Jimp({ width: size, height: size, color: WHITE });
  let seed = 42;
  const pseudoRandom = (): number => {
    // A simple LCG — deterministic, but not periodic within one image's pixel count.
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gradient = Math.floor((x / size) * 120) + Math.floor((y / size) * 40);
      const noise = Math.floor(pseudoRandom() * 20) - 10;
      const value = Math.max(0, Math.min(255, 90 + gradient + noise));
      const color = (value << 24) | (value << 16) | (value << 8) | 0xff;
      image.setPixelColor(color >>> 0, x, y);
    }
  }
  return image.getBuffer('image/png');
}

describe('runRecaptureArtifactCheck', () => {
  it('flags a genuinely periodic (screen/print moire-like) pattern as suspicious', async () => {
    const imageBytes = await stripedImage(256, 16);

    const result = await runRecaptureArtifactCheck(imageBytes);

    expect(result.applicable).toBe(true);
    expect(result.suspicious).toBe(true);
    expect(result.peakRatio).toBeGreaterThan(7);
  });

  it('does not flag a natural-looking gradient+noise photo with no periodic structure', async () => {
    const imageBytes = await naturalLookingPhoto(256);

    const result = await runRecaptureArtifactCheck(imageBytes);

    expect(result.applicable).toBe(true);
    expect(result.suspicious).toBe(false);
  });

  it('is not applicable to images too small to carry meaningful frequency content', async () => {
    const image = new Jimp({ width: 16, height: 16, color: WHITE });
    const imageBytes = await image.getBuffer('image/png');

    const result = await runRecaptureArtifactCheck(imageBytes);

    expect(result.applicable).toBe(false);
    expect(result.suspicious).toBe(false);
  });
});
