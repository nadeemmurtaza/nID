import { euclideanDistance, isSamePerson, SAME_PERSON_DISTANCE_THRESHOLD } from './face-match';

describe('euclideanDistance / isSamePerson', () => {
  it('an identical descriptor distances at exactly 0 and counts as the same person', () => {
    const d = new Float32Array([0.1, -0.2, 0.3, 0.4]);
    const distance = euclideanDistance(d, new Float32Array(d));
    expect(distance).toBe(0);
    expect(isSamePerson(distance)).toBe(true);
  });

  it('computes real Euclidean distance for a known offset', () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([3, 4, 0]);
    expect(euclideanDistance(a, b)).toBeCloseTo(5, 5); // 3-4-5 triangle
  });

  it('rejects mismatched descriptor lengths rather than silently comparing a prefix', () => {
    expect(() => euclideanDistance(new Float32Array([1, 2]), new Float32Array([1, 2, 3]))).toThrow(/mismatch/);
  });

  it('isSamePerson is a hard cutoff at SAME_PERSON_DISTANCE_THRESHOLD', () => {
    expect(isSamePerson(SAME_PERSON_DISTANCE_THRESHOLD)).toBe(true);
    expect(isSamePerson(SAME_PERSON_DISTANCE_THRESHOLD + 0.001)).toBe(false);
  });
});
