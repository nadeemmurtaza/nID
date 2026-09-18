/**
 * 0.6 is the standard same-person threshold for a 128-d face-recognition
 * descriptor from this model family (the same value dlib's face_recognition
 * and face-api.js's own docs use) — not tuned here, adopted from the
 * published convention the model itself was trained against. No threshold
 * on a continuous distance is perfect; face-match.spec.ts exercises this
 * against real photos (the same image compared to itself distances at 0,
 * proving the metric itself is sound) rather than asserting a specific
 * cross-identity distance this codebase has no independently verified
 * ground truth for.
 */
export const SAME_PERSON_DISTANCE_THRESHOLD = 0.6;

export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Descriptor length mismatch: ${a.length} vs ${b.length}`);
  }
  let sumSquares = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    sumSquares += diff * diff;
  }
  return Math.sqrt(sumSquares);
}

export function isSamePerson(distance: number): boolean {
  return distance <= SAME_PERSON_DISTANCE_THRESHOLD;
}
