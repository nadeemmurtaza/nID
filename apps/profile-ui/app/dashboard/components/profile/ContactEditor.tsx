'use client';

import { useState } from 'react';
import { ApiError } from '../../../../lib/api';
import { updateProfile, type OwnerProfile } from '../../../../lib/owner-api';

interface Props {
  token: string;
  profile: OwnerProfile;
  onSaved: (profile: OwnerProfile) => void;
}

export function ContactEditor({ token, profile, onSaved }: Props) {
  const [form, setForm] = useState({
    phone: profile.phone ?? '',
    whatsapp: profile.whatsapp ?? '',
    publicEmail: profile.publicEmail ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const sanitized: Record<string, string | undefined> = { ...form };
      for (const key of ['phone', 'whatsapp', 'publicEmail'] as const) {
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

  return (
    <form onSubmit={handleSave}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Contact
      </h2>
      <label htmlFor="phone">Phone</label>
      <input id="phone" type="tel" {...field('phone')} />
      <label htmlFor="whatsapp">WhatsApp</label>
      <input id="whatsapp" type="tel" {...field('whatsapp')} />
      <label htmlFor="publicEmail">Public email</label>
      <input id="publicEmail" type="email" {...field('publicEmail')} />

      <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={saving}>
        {saving ? 'Saving…' : 'Save contact'}
      </button>
      {saved && <p className="success-text">Saved.</p>}
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
