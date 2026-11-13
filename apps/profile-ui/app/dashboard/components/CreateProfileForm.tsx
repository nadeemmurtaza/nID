'use client';

import { useState } from 'react';
import { ApiError, createProfile, type OwnerProfile } from '../../../lib/owner-api';

export function CreateProfileForm({ token, onCreated }: { token: string; onCreated: (profile: OwnerProfile) => void }) {
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const profile = await createProfile(token, { slug, displayName, category });
      onCreated(profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="center-page">
      <div className="card" style={{ maxWidth: 440, textAlign: 'left' }}>
        <h1 style={{ textAlign: 'center' }}>Create your page</h1>
        <p className="lead" style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
          Pick a URL and a name — everything else can be filled in after.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="slug">Your URL</label>
          <input
            id="slug"
            type="text"
            required
            placeholder="your-name"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
          <label htmlFor="displayName">Display name</label>
          <input id="displayName" type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <label htmlFor="category">Category</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="DOCTOR">Doctor</option>
            <option value="BUSINESS">Business</option>
            <option value="PROFESSIONAL">Professional</option>
            <option value="OTHER">Other</option>
          </select>
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create page'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>
    </main>
  );
}
