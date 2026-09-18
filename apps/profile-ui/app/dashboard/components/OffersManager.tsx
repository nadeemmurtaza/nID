'use client';

import { useEffect, useState } from 'react';
import { ApiError, createOffer, deleteOffer, listMyOffers, updateOffer, type OwnerOffer } from '../../../lib/owner-api';

export function OffersManager({ token }: { token: string }) {
  const [offers, setOffers] = useState<OwnerOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMyOffers(token)
      .then(setOffers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load offers.'));
  }, [token]);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createOffer(token, {
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
    const updated = await updateOffer(token, offer.id, { isActive: !offer.isActive });
    setOffers((prev) => prev?.map((o) => (o.id === offer.id ? updated : o)) ?? null);
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteOffer(token, id);
      setOffers((prev) => prev?.filter((o) => o.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that offer.');
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Offers
      </h2>
      {offers?.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No offers yet.</p>}
      {offers?.map((offer) => (
        <div className="data-row" key={offer.id}>
          <div>
            <div>{offer.title}</div>
            {offer.validUntil && <div className="meta">Until {new Date(offer.validUntil).toLocaleDateString()}</div>}
            {!offer.isActive && <div className="meta">Inactive</div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="small-btn" onClick={() => handleToggleActive(offer)}>
              {offer.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" className="small-btn danger-btn" onClick={() => handleDelete(offer.id)}>
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
        <button type="submit" style={{ marginTop: 12 }} disabled={submitting}>
          {submitting ? 'Adding…' : 'Add offer'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
