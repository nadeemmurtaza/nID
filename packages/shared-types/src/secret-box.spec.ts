import { randomBytes } from 'node:crypto';
import { SecretBox } from './secret-box';

const key = () => randomBytes(32).toString('base64');

describe('SecretBox', () => {
  it('round trips and never contains the plaintext', () => {
    const b = new SecretBox(key());
    const stored = b.encrypt('tenant:t1:webhook', 's3cret-value');
    expect(stored.startsWith('v1.')).toBe(true);
    expect(stored).not.toContain('s3cret');
    expect(b.decrypt('tenant:t1:webhook', stored)).toBe('s3cret-value');
  });

  it('rejects another key, another tenant or field, and tampering', () => {
    const b = new SecretBox(key());
    const stored = b.encrypt('tenant:t1:webhook', 'v');
    expect(() => new SecretBox(key()).decrypt('tenant:t1:webhook', stored)).toThrow();
    expect(() => b.decrypt('tenant:t2:webhook', stored)).toThrow();
    expect(() => b.decrypt('tenant:t1:billing', stored)).toThrow();
    expect(() => b.decrypt('tenant:t1:webhook', stored + 'A')).toThrow();
    expect(() => b.decrypt('c', 'plain-text')).toThrow();
  });

  it('rotates: old values still decrypt, new ones use the new key', () => {
    const k1 = key();
    const k2 = key();
    const stored = new SecretBox(k1).encrypt('c', 'v');
    const rotated = new SecretBox(k2, k1);
    expect(rotated.decrypt('c', stored)).toBe('v');
    expect(new SecretBox(k2).decrypt('c', rotated.encrypt('c', 'v'))).toBe('v');
  });

  it('reads a value written by the Rust implementation', () => {
    // Produced by crates/shared-types/src/secret_box.rs (see its `interop`
    // test) with key = 32 x 0x07, context "tenant:t9:webhook".
    const k = Buffer.alloc(32, 7).toString('base64');
    const fromRust = 'v1.p7IFYtZQmdHkSmUU.YbXg83-B4lsgU8DtyR4phGaQaEy8rNxPkw';
    expect(new SecretBox(k).decrypt('tenant:t9:webhook', fromRust)).toBe('from-rust');
  });
});
