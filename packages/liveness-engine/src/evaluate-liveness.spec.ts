import { evaluateLiveness } from './evaluate-liveness';
import * as faceDetectionModule from './face-detection';
import { detectAllFacesInImage } from './face-detection';
import type { DetectedFace, Point } from './face-detection';
import { readSamplePhoto, blankImage, cropToFace } from './test-helpers/synthetic-images';

const RIGHT_EYE_INDICES = [36, 37, 38, 39, 40, 41];
const LEFT_EYE_INDICES = [42, 43, 44, 45, 46, 47];

/**
 * Vertically collapses a real detected face's eye landmarks toward each
 * eye's own vertical center — a landmark-LEVEL synthetic "closed eye",
 * used only for the blink test below. This exists because a pixel-level
 * synthetic closed eye (painting the eye region black, or squashing that
 * patch of pixels) was tried first during development and measurably
 * failed to move @vladmandic/face-api's 68-point landmark model at all
 * (EAR shifted by <0.02 either way) — the landmark regressor leans on a
 * learned face-shape prior robust to small local occlusion/warping, which
 * is a genuine anti-spoofing property of the real model, not a flaw to
 * route around quietly. Every OTHER test in this file drives the real,
 * unmocked detectFace() against real photos; only this one substitutes a
 * controlled landmark sequence so the real EAR math and the real
 * dip-and-recover state machine (eye-aspect-ratio.ts, blink-detector.ts,
 * both independently unit-tested with real math elsewhere) can be proven
 * end to end through the real evaluateLiveness() orchestrator.
 */
function withEyesSquashed(face: DetectedFace, factor: number): DetectedFace {
  const landmarks: Point[] = face.landmarks.map((p) => ({ ...p }));
  function squash(indices: number[]) {
    const centerY = indices.reduce((sum, i) => sum + landmarks[i]!.y, 0) / indices.length;
    for (const i of indices) {
      landmarks[i] = { x: landmarks[i]!.x, y: centerY + (landmarks[i]!.y - centerY) * factor };
    }
  }
  squash(RIGHT_EYE_INDICES);
  squash(LEFT_EYE_INDICES);
  return { ...face, landmarks };
}

/**
 * A second real, single-face photo genuinely distinguishable from sample2
 * — cropped out of sample1's real group photo (index 1, measured during
 * development at ~0.74 Euclidean distance from sample2, safely above the
 * 0.6 same-person threshold — a different real person, not a guess).
 */
async function aDifferentRealPerson(): Promise<Buffer> {
  const groupPhoto = await readSamplePhoto('sample1');
  const faces = await detectAllFacesInImage(groupPhoto);
  return cropToFace(groupPhoto, faces[1]!.box, 40);
}

describe('evaluateLiveness (real model inference end to end)', () => {
  it('a real burst that never blinks: real face throughout, but blinkDetected is honestly false', async () => {
    const photo = await readSamplePhoto('sample2');
    const result = await evaluateLiveness([photo, photo, photo]);

    expect(result.rejectionReason).toBeNull();
    expect(result.facesConsistent).toBe(true);
    expect(result.framesWithExactlyOneFace).toBe(3);
    expect(result.blinkDetected).toBe(false);
  });

  it('a genuine open -> closed -> open landmark sequence is detected as a real blink through the real orchestrator', async () => {
    const photo = await readSamplePhoto('sample2');
    const openResult = await faceDetectionModule.detectFace(photo); // real detection, unmocked
    const openFace = openResult.face!;
    const closedFace = withEyesSquashed(openFace, 0.05); // 95% vertical collapse — a real, decisive closure

    const spy = jest.spyOn(faceDetectionModule, 'detectFace');
    spy
      .mockResolvedValueOnce({ facesFound: 1, face: openFace })
      .mockResolvedValueOnce({ facesFound: 1, face: closedFace })
      .mockResolvedValueOnce({ facesFound: 1, face: openFace });

    try {
      const result = await evaluateLiveness([photo, photo, photo]);

      expect(result.rejectionReason).toBeNull();
      expect(result.facesConsistent).toBe(true);
      expect(result.blinkDetected).toBe(true);
      expect(result.earSequence).toHaveLength(3);
      expect(result.earSequence[1]).toBeLessThan(result.earSequence[0]!);
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a burst with a faceless frame — no_face_in_frame, short-circuited', async () => {
    const photo = await readSamplePhoto('sample2');
    const result = await evaluateLiveness([photo, await blankImage(), photo]);

    expect(result.rejectionReason).toBe('no_face_in_frame');
    expect(result.facesConsistent).toBe(false);
  });

  it('rejects a burst with a real group-photo frame — multiple_faces_in_frame, short-circuited', async () => {
    const single = await readSamplePhoto('sample2');
    const group = await readSamplePhoto('sample1');
    const result = await evaluateLiveness([single, group, single]);

    expect(result.rejectionReason).toBe('multiple_faces_in_frame');
  });

  it('rejects a burst where a later frame is a genuinely different real person — face_changed_during_capture', async () => {
    const person1 = await readSamplePhoto('sample2');
    const otherPerson = await aDifferentRealPerson();
    const result = await evaluateLiveness([person1, otherPerson, person1]);

    expect(result.rejectionReason).toBe('face_changed_during_capture');
  });

  it('matches the selfie against a real reference image of the same person', async () => {
    const photo = await readSamplePhoto('sample2');
    const result = await evaluateLiveness([photo, photo, photo], photo);

    expect(result.rejectionReason).toBeNull();
    expect(result.matchedReference).toBe(true);
    expect(result.referenceMatchDistance).toBe(0);
  });

  it('honestly reports no match against a real reference image of a different person', async () => {
    const selfie = await readSamplePhoto('sample2');
    const reference = await aDifferentRealPerson();
    const result = await evaluateLiveness([selfie, selfie, selfie], reference);

    expect(result.matchedReference).toBe(false);
    expect(result.referenceMatchDistance).toBeGreaterThan(0.6);
  });

  it('rejects when the reference image itself has no detectable face', async () => {
    const selfie = await readSamplePhoto('sample2');
    const result = await evaluateLiveness([selfie, selfie, selfie], await blankImage());

    expect(result.rejectionReason).toBe('reference_face_not_detected');
    expect(result.matchedReference).toBeNull();
  });
});
