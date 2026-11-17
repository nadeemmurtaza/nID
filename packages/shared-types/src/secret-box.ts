/**
 * Encryption at rest for secrets that must stay recoverable, such as the
 * tenant webhook secrets used to sign outbound webhooks.
 *
 * AES-256-GCM, format `v1.<nonce>.<ciphertext+tag>` (base64url, no padding),
 * identical to crates/shared-types/src/secret_box.rs so Rust and TypeScript
 * read each other's values. The key lives in WEBHOOK_SECRET_KEY (32 bytes,
 * base64), never in the database. `context` (tenant and field) is bound as
 * associated data, so a value copied to another tenant or column fails to
 * decrypt. WEBHOOK_SECRET_KEY_PREVIOUS enables key rotation.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const TAG_BYTES = 16;

function parseKey(b64: string): Buffer {
  const key = Buffer.from(b64.trim(), 'base64');
  if (key.length !== 32) throw new Error('a secret key must be 32 bytes, base64 encoded');
  return key;
}

export class SecretBox {
  private readonly current: Buffer;
  private readonly previous: Buffer | null;

  constructor(currentB64: string, previousB64?: string | null) {
    this.current = parseKey(currentB64);
    this.previous = previousB64 ? parseKey(previousB64) : null;
  }

  static fromEnv(): SecretBox {
    const current = process.env.WEBHOOK_SECRET_KEY;
    if (!current) throw new Error('WEBHOOK_SECRET_KEY is not set');
    return new SecretBox(current, process.env.WEBHOOK_SECRET_KEY_PREVIOUS || null);
  }

  encrypt(context: string, plaintext: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.current, nonce);
    cipher.setAAD(Buffer.from(context));
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    return `v1.${nonce.toString('base64url')}.${ct.toString('base64url')}`;
  }

  decrypt(context: string, stored: string): string {
    const parts = stored.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('stored secret is not in a recognised format');
    const nonce = Buffer.from(parts[1]!, 'base64url');
    const data = Buffer.from(parts[2]!, 'base64url');
    if (nonce.length !== 12 || data.length < TAG_BYTES) throw new Error('stored secret is not in a recognised format');
    const body = data.subarray(0, data.length - TAG_BYTES);
    const tag = data.subarray(data.length - TAG_BYTES);
    for (const key of [this.current, this.previous]) {
      if (!key) continue;
      try {
        const d = createDecipheriv('aes-256-gcm', key, nonce);
        d.setAAD(Buffer.from(context));
        d.setAuthTag(tag);
        return Buffer.concat([d.update(body), d.final()]).toString('utf8');
      } catch {
        // try the previous key
      }
    }
    throw new Error('stored secret could not be decrypted (wrong key, or it belongs to a different tenant or field)');
  }
}

let cached: SecretBox | null = null;
export function secretBox(): SecretBox {
  return (cached ??= SecretBox.fromEnv());
}

export const webhookContext = (tenantId: string) => `tenant:${tenantId}:webhook`;
export const billingWebhookContext = (tenantId: string) => `tenant:${tenantId}:billing`;
