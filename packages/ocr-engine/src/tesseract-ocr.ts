import { createWorker, type Worker } from 'tesseract.js';

/**
 * Real, self-hosted OCR — no vendor API key, no per-call cost, no third
 * party ever sees the document. tesseract.js runs the actual Tesseract
 * engine compiled to WASM; the only network dependency is fetching the
 * trained-language data once (cached after that), not per-request.
 *
 * One worker per process, created lazily and reused — matches the
 * module-level-singleton pattern apps/workflows already uses for its
 * Prisma client (creating a worker is expensive; recognizing an image with
 * an existing one is not).
 */
let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    // tesseract.js's default trained-language-data CDN (jsdelivr) is
    // blocked by some networks' egress policy — OCR_LANG_DATA_URL lets a
    // deployment point at a reachable mirror or a self-hosted copy instead.
    // Downloaded once per worker process and cached by tesseract.js after
    // that, not fetched per document.
    const langPath = process.env['OCR_LANG_DATA_URL'];
    workerPromise = createWorker('eng', undefined, langPath ? { langPath } : {});
  }
  return workerPromise;
}

export async function extractText(imageBytes: Buffer): Promise<string> {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(imageBytes);
  return text;
}

const MRZ_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

/**
 * A second, targeted OCR pass restricted to the MRZ character set — general
 * English OCR's language model actively hurts MRZ accuracy (it "corrects"
 * O/0 and inserts/drops characters at monospace line boundaries trying to
 * make the text look like English words, which an MRZ deliberately isn't).
 * Only worth the extra pass once the general pass already suggests an MRZ
 * is present (see evaluate-document.ts); resets the worker's parameters
 * back afterward so it doesn't bias unrelated documents (diplomas, letters)
 * that happen to share this worker instance.
 */
export async function extractMrzCandidateText(imageBytes: Buffer): Promise<string> {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_char_whitelist: MRZ_ALPHABET });
  try {
    const {
      data: { text },
    } = await worker.recognize(imageBytes);
    return text;
  } finally {
    await worker.setParameters({ tessedit_char_whitelist: '' });
  }
}

export async function terminateOcrEngine(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
