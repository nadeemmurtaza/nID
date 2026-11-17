'use client';

import { useConfirm } from '@newax/design-tokens/ConfirmDialog';
import { useEffect, useState } from 'react';
import {
  ApiError,
  createOrgService,
  createService,
  deleteOrgService,
  deleteService,
  listMyServices,
  listOrgServices,
  updateOrgService,
  updateService,
  type OwnerService,
  type ServiceInput,
} from '../../../lib/owner-api';

/** organizationId present -> this organization's work profile; absent ->
 * the caller's own personal profile. Same UI and behaviour either way,
 * just a different set of API calls underneath -- see owner-api.ts's
 * "services (an organization's work profile)" section. */
export function ServicesManager({ token, organizationId }: { token: string; organizationId?: string }) {
  const { confirm, dialog } = useConfirm();
  const [services, setServices] = useState<OwnerService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [submitting, setSubmitting] = useState(false);

  function list() {
    return organizationId ? listOrgServices(token, organizationId) : listMyServices(token);
  }
  function create(input: ServiceInput) {
    return organizationId ? createOrgService(token, organizationId, input) : createService(token, input);
  }
  function update(id: string, input: ServiceInput) {
    return organizationId ? updateOrgService(token, organizationId, id, input) : updateService(token, id, input);
  }
  function remove(id: string) {
    return organizationId ? deleteOrgService(token, organizationId, id) : deleteService(token, id);
  }

  useEffect(() => {
    list()
      .then(setServices)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load services.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizationId]);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await create({
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
    const updated = await update(service.id, { isActive: !service.isActive });
    setServices((prev) => prev?.map((s) => (s.id === service.id ? updated : s)) ?? null);
  }

  async function handleDelete(id: string): Promise<void> {
    if (!(await confirm({ title: 'Delete this service?', body: 'It is removed from the public profile and cannot be restored.', confirmLabel: 'Delete service' }))) return;
    try {
      await remove(id);
      setServices((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that service.');
    }
  }

  return (
    <div>
      {dialog}
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Services
      </h2>
      {services?.length === 0 && <p className="empty-state">No services yet, add your first one below.</p>}
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
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleToggleActive(service)}>
              {service.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDelete(service.id)}>
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
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? 'Adding…' : 'Add service'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
