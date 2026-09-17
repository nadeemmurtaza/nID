import { createHmac } from 'node:crypto';
import { constantTimeEqualHex } from './crypto';

/**
 * Outbound-webhook signing (nID → tenant) and the matching verification a
 * tenant would run on their receiving end — kept together so the two sides
 * can never drift. docs/HOUSE-RULES.md rule 4.
 */
export function signWebhookPayload(secret: string, rawBody: string, timestampMs: number): string {
  return createHmac('sha256', secret).update(`${timestampMs}.${rawBody}`).digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  timestampMs: number,
  signatureHex: string,
): boolean {
  const expected = signWebhookPayload(secret, rawBody, timestampMs);
  return constantTimeEqualHex(expected, signatureHex);
}
