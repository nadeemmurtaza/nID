import { generateCheckoutToken, generateSessionToken } from './session-token';
import { sha256Hex } from './crypto';

describe('generateSessionToken', () => {
  it('hashes a 192-bit url-safe token and never returns the hash as plaintext', () => {
    const token = generateSessionToken();
    expect(token.plaintext).not.toEqual(token.hash);
    expect(token.plaintext).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(sha256Hex(token.plaintext)).toEqual(token.hash);
  });

  it('produces a different token every call', () => {
    expect(generateSessionToken().plaintext).not.toEqual(generateSessionToken().plaintext);
  });
});

describe('generateCheckoutToken', () => {
  it('hashes a 256-bit url-safe token and never returns the hash as plaintext', () => {
    const token = generateCheckoutToken();
    expect(token.plaintext).not.toEqual(token.hash);
    expect(token.plaintext).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sha256Hex(token.plaintext)).toEqual(token.hash);
  });

  it('produces a different token every call', () => {
    expect(generateCheckoutToken().plaintext).not.toEqual(generateCheckoutToken().plaintext);
  });
});
