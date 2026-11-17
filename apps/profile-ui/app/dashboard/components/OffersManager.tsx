'use client';

import { useConfirm } from '@newax/design-tokens/ConfirmDialog';
import { useEffect, useState } from 'react';
import {
  ApiError,
  createOffer,
  createOrgOffer,
  deleteOffer,
  deleteOrgOffer,
  listMyOffers,
  listOrgOffers,
  updateOffer,
  updateOrgOffer,
  type OfferInput,
  type OwnerOffer,
} from '../../../lib/owner-api';

/** organizationId present -> this organization's work profile; absent ->
 * the caller's own personal profile -- see ServicesManager.tsx's doc
 * comment for the pattern this mirrors. */
export function OffersManager({ token, organizationId }: { token: string; organizationId?: string }) {
  const { confirm, dialog } = useConfirm();
  const [offers, setOffers] = useState<OwnerOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function list() {
    return organizationId ? listOrgOffers(token, organizationId) : listMyOffers(token);
  }
  function create(input: OfferInput) {
    return organizationId ? createOrgOffer(token, organizationId, input) : createOffer(token, input);
  }
  function update(id: string, input: OfferInput) {
    return organizationId ? updateOrgOffer(token, organizationId, id, input) : updateOffer(token, id, input);
  }
  function remove(id: string) {
    return organizationId ? deleteOrgOffer(token, organizationId, id) : deleteOffer(token, id);
  }

  useEffect(() => {
    list()
      .then(setOffers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load offers.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizationId]);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await create({
        title,
        description: description || undefined,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      });
      setOffers((prev) => [created, ...(prev ?? [])]);
      setTitle('');
      setDescription('');
      setValidUntil('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that offer.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(offer: OwnerOffer): Promise<void> {
    const updated = await update(offer.id, { isActive: !offer.isActive });
    setOffers((prev) => prev?.map((o) => (o.id === offer.id ? updated : o)) ?? null);
  }

  async function handleDelete(id: string): Promise<void> {
    if (!(await confirm({ title: 'Delete this offer?', body: 'It is removed from your public profile and cannot be restored.', confirmLabel: 'Delete offer' }))) return;
    try {
      await remove(id);
      setOffers((prev) => prev?.filter((o) => o.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that offer.');
    }
  }

  return (
    <div>
      {dialog}
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Offers
      </h2>
      {offers?.length === 0 && <p className="empty-state">No offers yet, add your first one below.</p>}
      {offers?.map((offer) => (
        <div className="data-row" key={offer.id}>
          <div>
            <div>{offer.title}</div>
            {offer.validUntil && <div className="meta">Until {new Date(offer.validUntil).toLocaleDateString()}</div>}
            {!offer.isActive && <div className="meta">Inactive</div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleToggleActive(offer)}>
              {offer.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDelete(offer.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}

      <h2 className="section-title">Add an offer</h2>
      <form onSubmit={handleCreate}>
        <label htmlFor="offer-title">Title</label>
        <input id="offer-title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="offer-desc">Description</label>
        <textarea id="offer-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        <label htmlFor="offer-until">Valid until (optional)</label>
        <input id="offer-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? 'Adding…' : 'Add offer'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
