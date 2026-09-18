import { isUsernameLocked, slugifyRealName, slugMatchesRealName, USERNAME_RECONSIDERATION_WINDOW_MS } from './username';

describe('slugifyRealName', () => {
  it('lowercases and hyphenates a plain name', () => {
    expect(slugifyRealName('Anna Maria Eriksson')).toBe('anna-maria-eriksson');
  });

  it('strips diacritics rather than dropping the letter entirely', () => {
    expect(slugifyRealName('José Núñez')).toBe('jose-nunez');
  });

  it('collapses punctuation and repeated separators into single hyphens', () => {
    expect(slugifyRealName("O'Brien-Smith  Jr.")).toBe('o-brien-smith-jr');
  });

  it('trims leading/trailing hyphens produced by leading/trailing punctuation', () => {
    expect(slugifyRealName('  -Test Name- ')).toBe('test-name');
  });
});

describe('slugMatchesRealName', () => {
  it('accepts an exact match', () => {
    expect(slugMatchesRealName('anna-maria-eriksson', 'anna-maria-eriksson')).toBe(true);
  });

  it('accepts a hyphenated suffix for disambiguation', () => {
    expect(slugMatchesRealName('anna-maria-eriksson-2', 'anna-maria-eriksson')).toBe(true);
    expect(slugMatchesRealName('anna-maria-eriksson-nyc', 'anna-maria-eriksson')).toBe(true);
  });

  it('rejects a slug that only shares a prefix without the separating hyphen', () => {
    expect(slugMatchesRealName('anna-maria-erikssonx', 'anna-maria-eriksson')).toBe(false);
  });

  it('rejects a slug unrelated to the real name entirely', () => {
    expect(slugMatchesRealName('cool-username-123', 'anna-maria-eriksson')).toBe(false);
  });

  it('fails closed on an empty real name rather than accepting anything', () => {
    expect(slugMatchesRealName('anything', '')).toBe(false);
  });
});

describe('isUsernameLocked', () => {
  it('is unlocked immediately after usernameSetAt', () => {
    const setAt = new Date('2026-01-01T00:00:00Z');
    expect(isUsernameLocked(setAt, setAt)).toBe(false);
  });

  it('is still unlocked just under 7 days later', () => {
    const setAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(setAt.getTime() + USERNAME_RECONSIDERATION_WINDOW_MS - 1000);
    expect(isUsernameLocked(setAt, now)).toBe(false);
  });

  it('is locked just after 7 days have elapsed', () => {
    const setAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(setAt.getTime() + USERNAME_RECONSIDERATION_WINDOW_MS + 1000);
    expect(isUsernameLocked(setAt, now)).toBe(true);
  });
});
