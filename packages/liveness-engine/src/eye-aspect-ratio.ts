import type { Point } from './face-detection';

/**
 * Eye Aspect Ratio — Soukupová & Čech, "Real-Time Eye Blink Detection using
 * Facial Landmarks" (2016): the standard, published, non-ML technique for
 * detecting a blink from 2D facial landmarks. For six points around an eye
 * (p1..p6, p1/p4 the horizontal corners, p2/p3 the upper lid, p5/p6 the
 * lower lid):
 *
 *   EAR = (‖p2-p6‖ + ‖p3-p5‖) / (2 · ‖p1-p4‖)
 *
 * An open eye holds a roughly constant EAR (this codebase measured
 * ~0.26-0.32 on real open-eye photos during development); EAR collapses
 * toward 0 as the eyelid closes because the vertical distances shrink
 * while the horizontal one doesn't. Indices below are the standard 68-point
 * (iBUG/dlib) layout's eye landmarks — the same layout
 * @vladmandic/face-api's withFaceLandmarks() returns, index-for-index.
 */
const RIGHT_EYE_INDICES = [36, 37, 38, 39, 40, 41] as const;
const LEFT_EYE_INDICES = [42, 43, 44, 45, 46, 47] as const;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function earFor(eye: [Point, Point, Point, Point, Point, Point]): number {
  const [p1, p2, p3, p4, p5, p6] = eye;
  const horizontal = distance(p1, p4);
  if (horizontal === 0) {
    return 0;
  }
  return (distance(p2, p6) + distance(p3, p5)) / (2 * horizontal);
}

/**
 * The average of both eyes' EAR for one frame's 68 landmarks — averaging
 * smooths out a single eye's landmark noise without hiding a genuine
 * blink, since both eyes close together.
 */
export function computeEar(landmarks: Point[]): number {
  if (landmarks.length !== 68) {
    throw new Error(`computeEar expects 68 landmarks, got ${landmarks.length}`);
  }
  const rightEye = RIGHT_EYE_INDICES.map((i) => landmarks[i]!) as [Point, Point, Point, Point, Point, Point];
  const leftEye = LEFT_EYE_INDICES.map((i) => landmarks[i]!) as [Point, Point, Point, Point, Point, Point];
  return (earFor(rightEye) + earFor(leftEye)) / 2;
}
