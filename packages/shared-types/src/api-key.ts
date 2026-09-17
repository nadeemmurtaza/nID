import { randomBytes, createHash } from 'node:crypto';

const KEY_BYTE_LENGTH = 24;
const PREFIX_VISIBLE_CHARS = 8;

export interface GeneratedApiKey {
  /** Full plaintext key — shown once, never stored. */
  plaintext: string;
  /** Non-secret prefix stored alongside the hash for dashboard identification. */
  prefix: string;
  /** SHA-256 hash of the plaintext key — what actually gets stored. */
  hash: string;
}

export function generateApiKey(env: 'live' | 'test' = 'live'): GeneratedApiKey {
  const raw = randomBytes(KEY_BYTE_LENGTH).toString('base64url');
  const plaintext = `nid_${env}_${raw}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, `nid_${env}_`.length + PREFIX_VISIBLE_CHARS),
    hash: hashApiKey(plaintext),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}
