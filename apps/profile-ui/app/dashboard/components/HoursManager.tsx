'use client';

import { useEffect, useState } from 'react';
import { ApiError, listMyBusinessHours, upsertBusinessHour, type OwnerBusinessHour } from '../../../lib/owner-api';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(minutes: number | null): string {
  if (minutes === null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface Row {
  open: string;
  close: string;
  closed: boolean;
}

export function HoursManager({ token }: { token: string }) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(DAYS.map((d) => [d, { open: '09:00', close: '17:00', closed: false }])),
  );
  const [error, setError] = useState<string | null>(null);
  const [savingDay, setSavingDay] = useState<string | null>(null);

  useEffect(() => {
    listMyBusinessHours(token)
      .then((hours: OwnerBusinessHour[]) => {
        setRows((prev) => {
          const next = { ...prev };
          for (const hour of hours) {
            next[hour.day] = {
              open: minutesToTime(hour.openMinute) || '09:00',
              close: minutesToTime(hour.closeMinute) || '17:00',
              closed: hour.isClosed,
            };
          }
          return next;
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load hours.'));
  }, [token]);

  async function saveDay(day: string): Promise<void> {
    setSavingDay(day);
    setError(null);
    const row = rows[day];
    try {
      await upsertBusinessHour(token, day, {
        isClosed: row?.closed,
        openMinute: row?.closed ? undefined : timeToMinutes(row?.open ?? '09:00'),
        closeMinute: row?.closed ? undefined : timeToMinutes(row?.close ?? '17:00'),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that day.');
    } finally {
      setSavingDay(null);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Display hours
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
        Shown on your page as information — booking uses the bookable-hours windows instead.
      </p>
      {DAYS.map((day) => {
        const row = rows[day] ?? { open: '09:00', close: '17:00', closed: false };
        return (
          <div key={day} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>
                {day[0]}
                {day.slice(1).toLowerCase()}
              </strong>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={row.closed}
                  onChange={(e) => setRows((prev) => ({ ...prev, [day]: { ...row, closed: e.target.checked } }))}
                />
                Closed
              </label>
            </div>
            {!row.closed && (
              <div className="field-grid" style={{ marginBottom: 6 }}>
                <input
                  type="text"
                  placeholder="09:00"
                  value={row.open}
                  onChange={(e) => setRows((prev) => ({ ...prev, [day]: { ...row, open: e.target.value } }))}
                />
                <input
                  type="text"
                  placeholder="17:00"
                  value={row.close}
                  onChange={(e) => setRows((prev) => ({ ...prev, [day]: { ...row, close: e.target.value } }))}
                />
              </div>
            )}
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => saveDay(day)} disabled={savingDay === day}>
              {savingDay === day ? 'Saving…' : 'Save'}
            </button>
          </div>
        );
      })}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
