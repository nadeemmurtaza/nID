'use client';

import { useEffect, useState } from 'react';
import { ApiError, cancelAppointment, confirmAppointment, listMyAppointments, type OwnerAppointment } from '../../../lib/owner-api';

function formatRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const startLabel = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endLabel = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel}, ${startLabel} – ${endLabel}`;
}

export function AppointmentsPanel({ token }: { token: string }) {
  const [appointments, setAppointments] = useState<OwnerAppointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load(): void {
    listMyAppointments(token)
      .then(setAppointments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load appointments.'));
  }

  useEffect(load, [token]);

  async function handleConfirm(id: string): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      await confirmAppointment(token, id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm that appointment.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: string): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      await cancelAppointment(token, id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel that appointment.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Appointments
      </h2>
      {appointments?.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No appointments yet.</p>}
      {appointments?.map((appt) => (
        <div className="data-row" key={appt.id} style={{ alignItems: 'flex-start' }}>
          <div>
            <div>
              {appt.visitorName} · {appt.service.name}
            </div>
            <div className="meta">{formatRange(appt.startsAt, appt.endsAt)}</div>
            {appt.visitorPhone && <div className="meta">{appt.visitorPhone}</div>}
            {appt.visitorEmail && <div className="meta">{appt.visitorEmail}</div>}
            {appt.notes && <div className="meta">&ldquo;{appt.notes}&rdquo;</div>}
            <span className={`status-pill ${appt.status}`} style={{ marginTop: 6, display: 'inline-block' }}>
              {appt.status}
            </span>
          </div>
          {(appt.status === 'PENDING' || appt.status === 'CONFIRMED') && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {appt.status === 'PENDING' && (
                <button type="button" className="small-btn" disabled={busyId === appt.id} onClick={() => handleConfirm(appt.id)}>
                  Confirm
                </button>
              )}
              <button type="button" className="small-btn danger-btn" disabled={busyId === appt.id} onClick={() => handleCancel(appt.id)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
