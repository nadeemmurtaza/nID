/**
 * Minimal IANA-timezone wall-clock <-> UTC conversion using only the
 * platform's built-in `Intl` API — no timezone-database dependency to keep
 * current, since Node ships and updates its own tzdata. Used by
 * apps/api's booking module (AvailabilityRule/BusinessHour minute-of-day
 * values are local to a Profile's own timezone, per schema.prisma) and
 * reusable by any UI that needs the same conversion client-side.
 */

export type WeekdayName = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

const WEEKDAY_FROM_SHORT: Record<string, WeekdayName> = {
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
  Sun: 'SUNDAY',
};

function formatPartsMap(date: Date, timeZone: string, extra: Intl.DateTimeFormatOptions = {}): Record<string, string> {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...extra,
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return map;
}

/** How far `timeZone`'s wall clock is ahead of UTC at this instant, in milliseconds. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const map = formatPartsMap(date, timeZone);
  const asUtc = Date.UTC(
    Number(map['year']),
    Number(map['month']) - 1,
    Number(map['day']),
    Number(map['hour']),
    Number(map['minute']),
    Number(map['second']),
  );
  return asUtc - date.getTime();
}

/** The calendar date, weekday, and minute-of-day that `date` renders as in `timeZone`. */
export function getLocalDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: WeekdayName; minuteOfDay: number } {
  const map = formatPartsMap(date, timeZone, { weekday: 'short' });
  const weekday = WEEKDAY_FROM_SHORT[map['weekday'] as string];
  if (!weekday) {
    throw new Error(`Unrecognized weekday "${map['weekday']}" formatting ${date.toISOString()} in ${timeZone}.`);
  }
  return {
    year: Number(map['year']),
    month: Number(map['month']),
    day: Number(map['day']),
    weekday,
    minuteOfDay: Number(map['hour']) * 60 + Number(map['minute']),
  };
}

/**
 * The UTC instant at which `timeZone`'s wall clock reads
 * (year, month, day, hour, minute). Iterative correction against the
 * timezone's actual UTC offset — necessary because the offset itself
 * depends on the instant (DST), so it can't be computed in one step; this
 * converges in at most a couple of passes except inside a DST transition's
 * own (rare, hour-wide) window.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guessMs = naiveUtcMs;
  for (let i = 0; i < 3; i++) {
    const offsetMs = timeZoneOffsetMs(new Date(guessMs), timeZone);
    const correctedMs = naiveUtcMs - offsetMs;
    if (correctedMs === guessMs) {
      break;
    }
    guessMs = correctedMs;
  }
  return new Date(guessMs);
}
