import { createHash, timingSafeEqual } from 'node:crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two hex strings. Use for anything derived from
 * a secret — a submitted OTP's hash, a webhook signature — so a mismatch
 * can't be timed to leak the expected value one byte at a time. Mismatched
 * lengths return false immediately (safe: length itself isn't the secret).
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
