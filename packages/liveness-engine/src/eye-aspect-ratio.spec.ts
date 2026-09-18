import { computeEar } from './eye-aspect-ratio';
import type { Point } from './face-detection';

/**
 * Builds a full 68-point landmark array with only the eye region
 * (indices 36-47, the standard iBUG layout computeEar reads) set to a
 * controlled geometric shape — width `w`, height `h`, centered at (x0,y0).
 * By this construction EAR = h / w exactly, so the expected value isn't
 * guessed, it's derived the same way the real formula derives it.
 */
function landmarksWithEyeShape(w: number, h: number): Point[] {
  const points: Point[] = Array.from({ length: 68 }, () => ({ x: 0, y: 0 }));
  function setEye(baseIndex: number, x0: number, y0: number) {
    points[baseIndex + 0] = { x: x0 - w / 2, y: y0 }; // p1: left corner
    points[baseIndex + 1] = { x: x0 - w / 6, y: y0 - h / 2 }; // p2: upper-left lid
    points[baseIndex + 2] = { x: x0 + w / 6, y: y0 - h / 2 }; // p3: upper-right lid
    points[baseIndex + 3] = { x: x0 + w / 2, y: y0 }; // p4: right corner
    points[baseIndex + 4] = { x: x0 + w / 6, y: y0 + h / 2 }; // p5: lower-right lid
    points[baseIndex + 5] = { x: x0 - w / 6, y: y0 + h / 2 }; // p6: lower-left lid
  }
  setEye(36, 100, 100); // right eye
  setEye(42, 200, 100); // left eye
  return points;
}

describe('computeEar', () => {
  it('rejects anything but exactly 68 landmarks — the standard layout every index below assumes', () => {
    expect(() => computeEar([{ x: 0, y: 0 }])).toThrow(/68 landmarks/);
  });

  it('derives EAR = height / width for a symmetric eye shape, by construction', () => {
    const ear = computeEar(landmarksWithEyeShape(40, 16));
    expect(ear).toBeCloseTo(16 / 40, 5);
  });

  it('a wide-open eye shape scores a clearly higher EAR than a collapsed one', () => {
    const open = computeEar(landmarksWithEyeShape(40, 16));
    const closed = computeEar(landmarksWithEyeShape(40, 1));
    expect(open).toBeGreaterThan(closed);
    expect(closed).toBeLessThan(0.1);
  });

  it('a fully collapsed eye (zero height) scores EAR of exactly 0', () => {
    expect(computeEar(landmarksWithEyeShape(40, 0))).toBe(0);
  });
});
