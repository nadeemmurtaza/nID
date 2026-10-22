// tfjs-node's native TensorFlow backend must be registered before face-api
// touches any tensor op — same requirement @vladmandic/face-api's own
// Node demo documents (demo/node.js: "in nodejs environments tfjs-node is
// required to be loaded before face-api"). This is a real native binding
// (libtensorflow), not a JS-only fallback — confirmed it loads and runs in
// this environment via `tf.getBackend() === 'tensorflow'`.
import * as tf from '@tensorflow/tfjs-node';
import * as faceapi from '@vladmandic/face-api';
import { dirname, join } from 'node:path';

/**
 * The model weight files (~13MB: tiny face detector, 68-point landmarks,
 * face recognition) ship INSIDE the @vladmandic/face-api npm package
 * itself (its `model/` directory) — unlike the original justadudewhohacks/
 * face-api.js, which requires a separate download step. That means this
 * whole pipeline is genuinely self-hosted and $0: no external network call
 * at runtime, ever, and no vendor API key. Confirmed real detection +
 * landmarks + a 128-d descriptor against a real photo in dev exploration
 * before writing this file.
 */
function modelPath(): string {
  const packageJsonPath = require.resolve('@vladmandic/face-api/package.json');
  return join(dirname(packageJsonPath), 'model');
}

let loaded: Promise<void> | null = null;

/** Idempotent — safe to call before every use; only loads from disk once per process. */
export function ensureModelsLoaded(): Promise<void> {
  if (!loaded) {
    const path = modelPath();
    loaded = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromDisk(path),
      faceapi.nets.faceLandmark68Net.loadFromDisk(path),
      faceapi.nets.faceRecognitionNet.loadFromDisk(path),
    ]).then(() => undefined);
  }
  return loaded;
}

export { faceapi, tf };
