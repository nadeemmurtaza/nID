import { detectFace } from './face-detection';
import { computeEar } from './eye-aspect-ratio';
import { detectBlink } from './blink-detector';
import { euclideanDistance, isSamePerson } from './face-match';

export interface LivenessEvaluation {
  framesTotal: number;
  framesWithExactlyOneFace: number;
  /** Every analyzed frame had exactly one face, and it matched the first frame's identity. */
  facesConsistent: boolean;
  earSequence: number[];
  minEar: number;
  maxEar: number;
  blinkDetected: boolean;
  /** null when no reference image was supplied — nothing to match against. */
  matchedReference: boolean | null;
  referenceMatchDistance: number | null;
  /** Set the moment something makes the rest of the evaluation moot — see evaluateLiveness()'s own comment for what each value means. */
  rejectionReason: string | null;
}

/**
 * Orchestrates the whole self-hosted liveness pipeline over a short burst
 * of frames (apps/verify-ui captures ~6 over ~1.8s while prompting the
 * subject to blink): real face detection, an identity-consistency check
 * across frames, real Eye-Aspect-Ratio blink detection, and — when a
 * reference image is supplied (the paired document_ocr attempt's ID
 * photo) — a real face-match distance. Nothing here is mocked; every
 * number comes from an actual model inference against actual pixels.
 *
 * Stops early (short-circuits the rest of the checks) the moment a frame
 * makes the result unrecoverable — there's no reason to keep computing EAR
 * on a burst that already proves nobody, or the wrong person, is in frame:
 *
 *  - `no_face_in_frame`  — a frame with zero faces detected.
 *  - `multiple_faces_in_frame` — a frame with two or more faces (a second
 *    person, or a photo of a face held up next to the subject's own).
 *  - `face_changed_during_capture` — a later frame's face doesn't match
 *    the first frame's identity closely enough (SAME_PERSON_DISTANCE_THRESHOLD).
 *  - `reference_face_not_detected` — a reference image was supplied but
 *    it doesn't contain exactly one detectable face (a bad/no document
 *    photo is itself a real data-quality signal, not something to guess past).
 *
 * No blink detected is deliberately NOT a rejectionReason — it's carried
 * as `blinkDetected: false` for the caller to decide how to treat (see
 * LivenessProvider: a capture/timing miss is not proof of fraud the way
 * the four reasons above are).
 */
export async function evaluateLiveness(
  frames: Buffer[],
  referenceImageBytes?: Buffer,
): Promise<LivenessEvaluation> {
  const earSequence: number[] = [];
  let firstDescriptor: Float32Array | null = null;
  let framesWithExactlyOneFace = 0;
  let rejectionReason: string | null = null;

  for (const frame of frames) {
    const detection = await detectFace(frame);
    if (detection.facesFound === 0) {
      rejectionReason = 'no_face_in_frame';
      break;
    }
    if (detection.facesFound > 1) {
      rejectionReason = 'multiple_faces_in_frame';
      break;
    }
    const face = detection.face!;
    framesWithExactlyOneFace++;
    earSequence.push(computeEar(face.landmarks));

    if (firstDescriptor === null) {
      firstDescriptor = face.descriptor;
    } else if (!isSamePerson(euclideanDistance(firstDescriptor, face.descriptor))) {
      rejectionReason = 'face_changed_during_capture';
      break;
    }
  }

  const facesConsistent = rejectionReason === null && framesWithExactlyOneFace === frames.length;
  const blink = detectBlink(earSequence);

  let matchedReference: boolean | null = null;
  let referenceMatchDistance: number | null = null;
  if (rejectionReason === null && referenceImageBytes && firstDescriptor) {
    const referenceDetection = await detectFace(referenceImageBytes);
    if (referenceDetection.facesFound !== 1) {
      rejectionReason = 'reference_face_not_detected';
    } else {
      referenceMatchDistance = euclideanDistance(firstDescriptor, referenceDetection.face!.descriptor);
      matchedReference = isSamePerson(referenceMatchDistance);
    }
  }

  return {
    framesTotal: frames.length,
    framesWithExactlyOneFace,
    facesConsistent,
    earSequence,
    minEar: blink.minEar,
    maxEar: blink.maxEar,
    blinkDetected: blink.blinkDetected,
    matchedReference,
    referenceMatchDistance,
    rejectionReason,
  };
}
