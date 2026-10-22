'use client';

import { useState } from 'react';
import { ApiError, bookAppointment, getFreeSlots, type FreeSlot, type Service } from '../../lib/api';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function BookingWidget({ slug, services }: { slug: string; services: Service[] }) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [slots, setSlots] = useState<FreeSlot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<FreeSlot | null>(null);

  if (services.length === 0) {
    return null;
  }

  async function loadSlots(forServiceId: string) {
    setLoadingSlots(true);
    setError(null);
    setSlots(null);
    setSelectedSlot(null);
    try {
      const result = await getFreeSlots(slug, forServiceId, todayIso(), daysFromNowIso(13));
      setSlots(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load availability.');
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleBook(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      await bookAppointment(slug, {
        serviceId,
        startsAt: selectedSlot.startsAt,
        visitorName,
        visitorPhone: visitorPhone || undefined,
        visitorEmail: visitorEmail || undefined,
        notes: notes || undefined,
      });
      setConfirmed(selectedSlot);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('That time was just taken — pick another slot.');
        setSelectedSlot(null);
        loadSlots(serviceId);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not book that appointment.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="section-card">
        <p className="success-text">Booked for {formatSlot(confirmed.startsAt)}. See you then!</p>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="service">Service</label>
      <select
        id="service"
        value={serviceId}
        onChange={(e) => {
          setServiceId(e.target.value);
          loadSlots(e.target.value);
        }}
      >
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.durationMinutes} min)
          </option>
        ))}
      </select>

      {!slots && !loadingSlots && (
        <button type="button" style={{ marginTop: 10 }} onClick={() => loadSlots(serviceId)}>
          Check availability
        </button>
      )}

      {loadingSlots && <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>Loading times…</p>}

      {slots && slots.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>No open times in the next two weeks.</p>
      )}

      {slots && slots.length > 0 && (
        <div className="slots-grid">
          {slots.map((slot) => (
            <button
              type="button"
              key={slot.startsAt}
              className={`slot-btn${selectedSlot?.startsAt === slot.startsAt ? ' selected' : ''}`}
              onClick={() => setSelectedSlot(slot)}
            >
              {formatSlot(slot.startsAt)}
            </button>
          ))}
        </div>
      )}

      {selectedSlot && (
        <form onSubmit={handleBook}>
          <label htmlFor="visitorName">Your name</label>
          <input id="visitorName" type="text" required value={visitorName} onChange={(e) => setVisitorName(e.target.value)} />

          <label htmlFor="visitorPhone">Phone (optional)</label>
          <input id="visitorPhone" type="tel" value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)} />

          <label htmlFor="visitorEmail">Email (optional)</label>
          <input id="visitorEmail" type="email" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} />

          <label htmlFor="notes">Notes (optional)</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <button type="submit" style={{ marginTop: 12, width: '100%' }} disabled={submitting}>
            {submitting ? 'Booking…' : `Confirm ${formatSlot(selectedSlot.startsAt)}`}
          </button>
        </form>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
