import { randomBytes } from 'node:crypto';
import { sha256Hex } from './crypto';

const TOKEN_BYTE_LENGTH = 24;

export interface GeneratedSessionToken {
  /** Full plaintext token — shown once, in the verification-case create response. */
  plaintext: string;
  /** SHA-256 hash of the plaintext — what's actually stored. */
  hash: string;
}

/** A subject-facing credential for one VerificationCase — see VerificationSession. */
export function generateSessionToken(): GeneratedSessionToken {
  const plaintext = randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
  return { plaintext, hash: sha256Hex(plaintext) };
}

const CHECKOUT_TOKEN_BYTE_LENGTH = 32;

// eslint's own equivalent form — a distinct credential kind that happens to
// share GeneratedSessionToken's shape, named separately so call sites say which.
export type GeneratedCheckoutToken = GeneratedSessionToken;

/**
 * The capability token behind apps/checkout-ui's /checkout/<token>. 256 bits
 * and only its hash is stored, because the URL is written into a provider's
 * hosted page, a browser history and possibly a Referrer header — a location
 * the payer's own bank, not nID, controls. Distinct from generateSessionToken's
 * 192 bits for the same reason: this one unlocks a payment, not a status read.
 */
export function generateCheckoutToken(): GeneratedCheckoutToken {
  const plaintext = randomBytes(CHECKOUT_TOKEN_BYTE_LENGTH).toString('base64url');
  return { plaintext, hash: sha256Hex(plaintext) };
}
