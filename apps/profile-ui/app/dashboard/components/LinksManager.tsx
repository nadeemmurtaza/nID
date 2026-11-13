'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  createCustomLink,
  createSocialLink,
  deleteCustomLink,
  deleteSocialLink,
  listMyCustomLinks,
  listMySocialLinks,
  type OwnerCustomLink,
  type OwnerSocialLink,
} from '../../../lib/owner-api';

const PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER', 'YOUTUBE', 'TIKTOK', 'OTHER'];

export function LinksManager({ token }: { token: string }) {
  const [customLinks, setCustomLinks] = useState<OwnerCustomLink[] | null>(null);
  const [socialLinks, setSocialLinks] = useState<OwnerSocialLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('INSTAGRAM');
  const [socialUrl, setSocialUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([listMyCustomLinks(token), listMySocialLinks(token)])
      .then(([c, s]) => {
        setCustomLinks(c);
        setSocialLinks(s);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load links.'));
  }, [token]);

  async function handleAddCustom(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createCustomLink(token, { label, url });
      setCustomLinks((prev) => [...(prev ?? []), created]);
      setLabel('');
      setUrl('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that link.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddSocial(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createSocialLink(token, { platform, url: socialUrl });
      setSocialLinks((prev) => [...(prev ?? []), created]);
      setSocialUrl('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that link.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCustom(id: string): Promise<void> {
    await deleteCustomLink(token, id);
    setCustomLinks((prev) => prev?.filter((l) => l.id !== id) ?? null);
  }

  async function handleDeleteSocial(id: string): Promise<void> {
    await deleteSocialLink(token, id);
    setSocialLinks((prev) => prev?.filter((l) => l.id !== id) ?? null);
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Custom links
      </h2>
      {customLinks?.length === 0 && <p className="empty-state">No custom links yet — add one below.</p>}
      {customLinks?.map((link) => (
        <div className="data-row" key={link.id}>
          <span>
            {link.label} — <span className="meta">{link.url}</span>
          </span>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteCustom(link.id)}>
            Delete
          </button>
        </div>
      ))}
      <form onSubmit={handleAddCustom}>
        <label htmlFor="link-label">Label</label>
        <input id="link-label" type="text" required value={label} onChange={(e) => setLabel(e.target.value)} />
        <label htmlFor="link-url">URL</label>
        <input id="link-url" type="text" required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting}>
          Add link
        </button>
      </form>

      <h2 className="section-title">Social links</h2>
      {socialLinks?.length === 0 && <p className="empty-state">No social links yet — add one below.</p>}
      {socialLinks?.map((link) => (
        <div className="data-row" key={link.id}>
          <span>
            {link.platform} — <span className="meta">{link.url}</span>
          </span>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteSocial(link.id)}>
            Delete
          </button>
        </div>
      ))}
      <form onSubmit={handleAddSocial}>
        <label htmlFor="social-platform">Platform</label>
        <select id="social-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label htmlFor="social-url">URL</label>
        <input
          id="social-url"
          type="text"
          required
          placeholder="https://…"
          value={socialUrl}
          onChange={(e) => setSocialUrl(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={submitting}>
          Add social link
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
