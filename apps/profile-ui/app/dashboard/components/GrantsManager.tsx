'use client';

import { useEffect, useState } from 'react';
import { ApiError, createGrant, listMyGrants, revokeGrant, type GrantField, type OwnerFieldGrant } from '../../../lib/owner-api';

const FIELDS: { id: GrantField; label: string }[] = [
  { id: 'PHONE', label: 'Phone' },
  { id: 'WHATSAPP', label: 'WhatsApp' },
  { id: 'EMAIL', label: 'Email' },
  { id: 'ADDRESS', label: 'Address' },
  { id: 'REAL_NAME', label: 'Verified legal name' },
];

/**
 * "User can show only one specific info to only one person or
 * organization by his own will" — a private exception to the public
 * show* toggles on the Profile tab, granted to one recipient at a time by
 * their own nID username, never anyone else's.
 */
export function GrantsManager({ token }: { token: string }) {
  const [grants, setGrants] = useState<OwnerFieldGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<GrantField>('PHONE');
  const [granteeSlug, setGranteeSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMyGrants(token)
      .then(setGrants)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your grants.'));
  }, [token]);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createGrant(token, field, granteeSlug.trim());
      setGrants((prev) => [created, ...(prev ?? []).filter((g) => g.id !== created.id)]);
      setGranteeSlug('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that grant.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string): Promise<void> {
    await revokeGrant(token, id);
    setGrants((prev) => prev?.filter((g) => g.id !== id) ?? null);
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Private shares
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8, marginBottom: 16 }}>
        Share one field with one specific person or organization, by their nID username — without making it public to
        everyone on your page.
      </p>

      {grants?.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No active shares.</p>}
      {grants?.map((g) => (
        <div className="data-row" key={g.id}>
          <span>{FIELDS.find((f) => f.id === g.field)?.label ?? g.field}</span>
          <button type="button" className="small-btn danger-btn" onClick={() => handleRevoke(g.id)}>
            Revoke
          </button>
        </div>
      ))}

      <form onSubmit={handleCreate}>
        <label htmlFor="grant-field">Field to share</label>
        <select id="grant-field" value={field} onChange={(e) => setField(e.target.value as GrantField)}>
          {FIELDS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <label htmlFor="grant-slug">Their nID username</label>
        <input
          id="grant-slug"
          type="text"
          required
          placeholder="jane-doe"
          value={granteeSlug}
          onChange={(e) => setGranteeSlug(e.target.value)}
        />
        <button type="submit" style={{ marginTop: 12 }} disabled={submitting}>
          Share
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
