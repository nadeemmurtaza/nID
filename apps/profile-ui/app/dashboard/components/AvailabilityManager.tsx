'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  createAvailabilityRule,
  deleteAvailabilityRule,
  listMyAvailabilityRules,
  type OwnerAvailabilityRule,
} from '../../../lib/owner-api';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function AvailabilityManager({ token }: { token: string }) {
  const [rules, setRules] = useState<OwnerAvailabilityRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState('MONDAY');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMyAvailabilityRules(token)
      .then(setRules)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load availability.'));
  }, [token]);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createAvailabilityRule(token, {
        day,
        startMinute: timeToMinutes(start),
        endMinute: timeToMinutes(end),
      });
      setRules((prev) => [...(prev ?? []), created]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that window.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteAvailabilityRule(token, id);
      setRules((prev) => prev?.filter((r) => r.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that window.');
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Bookable hours
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
        When visitors can actually book a service — separate from the display-only hours below.
      </p>
      {rules?.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No recurring windows yet.</p>}
      {rules?.map((rule) => (
        <div className="data-row" key={rule.id}>
          <span>
            {rule.day[0]}
            {rule.day.slice(1).toLowerCase()} · {minutesToTime(rule.startMinute)}–{minutesToTime(rule.endMinute)}
          </span>
          <button type="button" className="small-btn danger-btn" onClick={() => handleDelete(rule.id)}>
            Remove
          </button>
        </div>
      ))}

      <h2 className="section-title">Add a window</h2>
      <form onSubmit={handleCreate}>
        <label htmlFor="avail-day">Day</label>
        <select id="avail-day" value={day} onChange={(e) => setDay(e.target.value)}>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d[0]}
              {d.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <div className="field-grid">
          <div>
            <label htmlFor="avail-start">From</label>
            <input id="avail-start" type="text" placeholder="09:00" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label htmlFor="avail-end">To</label>
            <input id="avail-end" type="text" placeholder="17:00" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <button type="submit" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? 'Adding…' : 'Add window'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
