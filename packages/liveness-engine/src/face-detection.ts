import { ensureModelsLoaded, faceapi, tf } from './models';

export interface Point {
  x: number;
  y: number;
}

export interface DetectedFace {
  landmarks: Point[];
  descriptor: Float32Array;
  score: number;
}

export interface FaceDetectionResult {
  /** How many faces the detector found — the caller decides what to do with anything but exactly 1. */
  facesFound: number;
  /** Populated only when facesFound === 1 — an ambiguous frame (0 or 2+ faces) has nothing safe to act on. */
  face: DetectedFace | null;
}

const TINY_FACE_DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions();

export interface DetectedFaceWithBox extends DetectedFace {
  box: { x: number; y: number; width: number; height: number };
}

/**
 * Every face @vladmandic/face-api's TinyFaceDetector finds in one image —
 * the raw building block both detectFace() (below) and this package's own
 * test fixtures (cropping a single real face out of a group photo) build
 * on. Runs on the tfjs-node native backend.
 */
export async function detectAllFacesInImage(imageBytes: Buffer): Promise<DetectedFaceWithBox[]> {
  await ensureModelsLoaded();

  const tensor = tf.tidy(() => {
    const decoded = tf.node.decodeImage(imageBytes, 3);
    return tf.expandDims(decoded, 0);
  });

  try {
    const results = await faceapi
      .detectAllFaces(tensor as unknown as faceapi.TNetInput, TINY_FACE_DETECTOR_OPTIONS)
      .withFaceLandmarks()
      .withFaceDescriptors();

    return results.map((result) => ({
      box: {
        x: result.detection.box.x,
        y: result.detection.box.y,
        width: result.detection.box.width,
        height: result.detection.box.height,
      },
      landmarks: result.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
      descriptor: result.descriptor,
      score: result.detection.score,
    }));
  } finally {
    tensor.dispose();
  }
}

/**
 * Gates detectAllFacesInImage() down to "exactly one face, or none of this
 * is usable" — the shape every liveness/face-match caller actually needs.
 * Deliberately distinguishes 0-face and 2+-face results (both real signals
 * — nobody in frame; a second person, or a photo held up next to the
 * subject's own face) rather than silently picking "the best" face the
 * way detectSingleFace() would.
 */
export async function detectFace(imageBytes: Buffer): Promise<FaceDetectionResult> {
  const results = await detectAllFacesInImage(imageBytes);
  if (results.length !== 1) {
    return { facesFound: results.length, face: null };
  }
  const { landmarks, descriptor, score } = results[0]!;
  return { facesFound: 1, face: { landmarks, descriptor, score } };
}
