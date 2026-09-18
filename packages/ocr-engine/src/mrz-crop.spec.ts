import { Jimp } from 'jimp';
import { autoCropToMrzBand } from './mrz-crop';

const WHITE = 0xffffffff;
const BLACK = 0x000000ff;

async function renderSyntheticPage(options: {
  width: number;
  height: number;
  darkRows: number[];
}): Promise<Buffer> {
  const image = new Jimp({ width: options.width, height: options.height, color: WHITE });
  for (const y of options.darkRows) {
    for (let x = 0; x < options.width; x++) {
      image.setPixelColor(BLACK, x, y);
    }
  }
  return image.getBuffer('image/png');
}

describe('autoCropToMrzBand', () => {
  it('crops tightly around two dense text bands near the bottom of the page', async () => {
    const width = 200;
    const height = 300;
    // Two "MRZ lines" as solid dark rows near the bottom, well clear of the
    // 45% BOTTOM_SEARCH_FRACTION boundary (row 165) so the search window sees them.
    const line1 = [270, 271, 272];
    const line2 = [278, 279, 280];
    const imageBytes = await renderSyntheticPage({ width, height, darkRows: [...line1, ...line2] });

    const result = await autoCropToMrzBand(imageBytes);

    expect(result.cropped).toBe(true);
    const cropped = await Jimp.read(result.imageBytes);
    // The crop must fully contain both synthetic MRZ lines...
    expect(cropped.bitmap.height).toBeGreaterThanOrEqual(line2[line2.length - 1]! - line1[0]! + 1);
    // ...and must be meaningfully tighter than the full page (the whole point
    // of cropping — proves the header/photo area above was excluded).
    expect(cropped.bitmap.height).toBeLessThan(height / 2);
    expect(cropped.bitmap.width).toBe(width);
  });

  it('falls back to the original image when no qualifying band exists', async () => {
    const width = 100;
    const height = 150;
    // A blank page has no dark rows anywhere — nothing clears the density threshold.
    const imageBytes = await renderSyntheticPage({ width, height, darkRows: [] });

    const result = await autoCropToMrzBand(imageBytes);

    expect(result.cropped).toBe(false);
    expect(result.imageBytes).toBe(imageBytes);
  });

  it('ignores a dense dark region confined to the photo/header area above the search window', async () => {
    const width = 100;
    const height = 200;
    // A "photo" block sitting in the top half only — outside BOTTOM_SEARCH_FRACTION (45%),
    // so it must never be mistaken for the MRZ band.
    const photoRows = Array.from({ length: 20 }, (_, i) => 30 + i);
    const imageBytes = await renderSyntheticPage({ width, height, darkRows: photoRows });

    const result = await autoCropToMrzBand(imageBytes);

    expect(result.cropped).toBe(false);
  });
});
