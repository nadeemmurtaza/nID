import { detectFace, detectAllFacesInImage } from './face-detection';
import { readSamplePhoto, blankImage } from './test-helpers/synthetic-images';

describe('detectFace / detectAllFacesInImage (real model inference against real photos)', () => {
  it('finds exactly one face, 68 landmarks, and a 128-d descriptor in a real single-portrait photo', async () => {
    // sample2 is the only bundled demo photo confirmed (by detectAllFacesInImage
    // during development) to contain exactly one face — the others are group
    // photos, which is exactly the multi-face case the next test covers.
    const photo = await readSamplePhoto('sample2');
    const result = await detectFace(photo);

    expect(result.facesFound).toBe(1);
    expect(result.face).not.toBeNull();
    expect(result.face!.landmarks).toHaveLength(68);
    expect(result.face!.descriptor).toHaveLength(128);
    expect(result.face!.score).toBeGreaterThan(0);
  });

  it('finds zero faces in an image with no face at all', async () => {
    const result = await detectFace(await blankImage());
    expect(result.facesFound).toBe(0);
    expect(result.face).toBeNull();
  });

  it('finds multiple faces in a real group photo — proven against a real image, not a composite', async () => {
    const groupPhoto = await readSamplePhoto('sample1');
    const result = await detectFace(groupPhoto);
    expect(result.facesFound).toBeGreaterThan(1);
    expect(result.face).toBeNull();

    const all = await detectAllFacesInImage(groupPhoto);
    expect(all.length).toBe(result.facesFound);
    expect(all[0]!.box.width).toBeGreaterThan(0);
  });
});
