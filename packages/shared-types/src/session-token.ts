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
