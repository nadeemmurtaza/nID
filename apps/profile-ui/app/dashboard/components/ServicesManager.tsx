'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  createService,
  deleteService,
  listMyServices,
  updateService,
  type OwnerService,
} from '../../../lib/owner-api';

export function ServicesManager({ token }: { token: string }) {
  const [services, setServices] = useState<OwnerService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMyServices(token)
      .then(setServices)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load services.'));
  }, [token]);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createService(token, {
        name,
        durationMinutes: Number(duration),
        price: price ? Number(price) : undefined,
        currency: price ? currency : undefined,
      });
      setServices((prev) => [...(prev ?? []), created]);
      setName('');
      setDuration('30');
      setPrice('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that service.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(service: OwnerService): Promise<void> {
    const updated = await updateService(token, service.id, { isActive: !service.isActive });
    setServices((prev) => prev?.map((s) => (s.id === service.id ? updated : s)) ?? null);
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteService(token, id);
      setServices((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that service.');
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Services
      </h2>
      {services?.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No services yet.</p>}
      {services?.map((service) => (
        <div className="data-row" key={service.id}>
          <div>
            <div>{service.name}</div>
            <div className="meta">
              {service.durationMinutes} min{service.price ? ` · ${service.currency ?? ''} ${service.price}` : ''}
              {!service.isActive ? ' · inactive' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="small-btn" onClick={() => handleToggleActive(service)}>
              {service.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" className="small-btn danger-btn" onClick={() => handleDelete(service.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}

      <h2 className="section-title">Add a service</h2>
      <form onSubmit={handleCreate}>
        <label htmlFor="svc-name">Name</label>
        <input id="svc-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        <div className="field-grid">
          <div>
            <label htmlFor="svc-duration">Duration (minutes)</label>
            <input
              id="svc-duration"
              type="text"
              inputMode="numeric"
              required
              value={duration}
              onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label htmlFor="svc-price">Price (optional)</label>
            <input id="svc-price" type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        {price && (
          <>
            <label htmlFor="svc-currency">Currency</label>
            <input id="svc-currency" type="text" maxLength={8} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </>
        )}
        <button type="submit" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? 'Adding…' : 'Add service'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
