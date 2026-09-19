'use client';

import { useState } from 'react';
import { ApiError, apiUrl } from '../../../../lib/api';
import { updateProfile, uploadPhoto, type OwnerProfile } from '../../../../lib/owner-api';

interface Props {
  token: string;
  profile: OwnerProfile;
  onSaved: (profile: OwnerProfile) => void;
}

/** Photo + the fields that answer "who is this" — deliberately one step,
 * not two: the photo control is a single action, not a form section of
 * its own. */
export function BasicsEditor({ token, profile, onSaved }: Props) {
  const [form, setForm] = useState({
    slug: profile.slug,
    displayName: profile.displayName,
    headline: profile.headline ?? '',
    category: profile.category,
    bio: profile.bio ?? '',
    timezone: profile.timezone,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      // A blank optional text input means "cleared", not "an empty string"
      // — see owner-api.ts's ProfileInput comment.
      const sanitized: Record<string, string | undefined> = { ...form };
      for (const key of ['headline', 'bio'] as const) {
        if (sanitized[key] === '') sanitized[key] = undefined;
      }
      const updated = await updateProfile(token, sanitized);
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const updated = await uploadPhoto(token, file);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload your photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Photo
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        {profile.photoKey ? (
          <img
            src={apiUrl(`/v1/profiles/${profile.slug}/photo`)}
            alt=""
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
            }}
          />
        )}
        <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer' }}>
          {uploadingPhoto ? 'Uploading…' : 'Change photo'}
          <input type="file" accept="image/*" onChange={handlePhoto} disabled={uploadingPhoto} style={{ display: 'none' }} />
        </label>
      </div>

      <form onSubmit={handleSave}>
        <label htmlFor="slug">URL</label>
        <input id="slug" type="text" {...field('slug')} />
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" type="text" {...field('displayName')} />
        <label htmlFor="headline">Headline</label>
        <input id="headline" type="text" {...field('headline')} />
        <label htmlFor="category">Category</label>
        <select id="category" {...field('category')}>
          <option value="DOCTOR">Doctor</option>
          <option value="BUSINESS">Business</option>
          <option value="PROFESSIONAL">Professional</option>
          <option value="OTHER">Other</option>
        </select>
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" {...field('bio')} />
        <label htmlFor="timezone">Timezone (IANA)</label>
        <input id="timezone" type="text" placeholder="America/Chicago" {...field('timezone')} />

        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={saving}>
          {saving ? 'Saving…' : 'Save basics'}
        </button>
        {saved && <p className="success-text">Saved.</p>}
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
