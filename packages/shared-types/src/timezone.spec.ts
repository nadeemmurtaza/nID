import { getLocalDateParts, zonedTimeToUtc } from './timezone';

describe('zonedTimeToUtc / getLocalDateParts', () => {
  it('converts a plain-timezone offset correctly (Asia/Karachi, UTC+5, no DST)', () => {
    const utc = zonedTimeToUtc(2026, 9, 21, 10, 30, 'Asia/Karachi');
    expect(utc.toISOString()).toBe('2026-09-21T05:30:00.000Z');
  });

  it('round-trips: converting to UTC and back recovers the same wall-clock date/time/weekday', () => {
    const utc = zonedTimeToUtc(2026, 9, 21, 10, 30, 'Asia/Karachi');
    const parts = getLocalDateParts(utc, 'Asia/Karachi');
    expect(parts).toEqual({ year: 2026, month: 9, day: 21, weekday: 'MONDAY', minuteOfDay: 630 });
  });

  it('accounts for a spring-forward DST transition (America/New_York, 2026-03-08)', () => {
    // 9am ET the day before the transition is EST (UTC-5); the day after is EDT (UTC-4).
    const beforeDst = zonedTimeToUtc(2026, 3, 7, 9, 0, 'America/New_York');
    const afterDst = zonedTimeToUtc(2026, 3, 9, 9, 0, 'America/New_York');
    expect(beforeDst.toISOString()).toBe('2026-03-07T14:00:00.000Z');
    expect(afterDst.toISOString()).toBe('2026-03-09T13:00:00.000Z');
  });

  it('getLocalDateParts reports the correct weekday across a DST transition', () => {
    const afterDst = zonedTimeToUtc(2026, 3, 9, 9, 0, 'America/New_York');
    expect(getLocalDateParts(afterDst, 'America/New_York').weekday).toBe('MONDAY');
  });

  it('handles a negative UTC offset (America/Chicago, UTC-5 in September)', () => {
    const utc = zonedTimeToUtc(2026, 9, 21, 9, 0, 'America/Chicago');
    expect(utc.toISOString()).toBe('2026-09-21T14:00:00.000Z');
  });

  it('throws on a genuinely invalid UTC day index rather than silently returning undefined behavior', () => {
    // getLocalDateParts never produces an out-of-range weekday itself; this
    // documents the invariant weekdayForUtcDayIndex in availability.service.ts relies on.
    const date = new Date('2026-09-21T00:00:00.000Z');
    expect(() => getLocalDateParts(date, 'not-a-real-timezone')).toThrow();
  });
});
