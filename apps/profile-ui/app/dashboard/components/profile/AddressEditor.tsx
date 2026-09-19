'use client';

import { useState } from 'react';
import { ApiError } from '../../../../lib/api';
import { updateProfile, type OwnerProfile } from '../../../../lib/owner-api';

interface Props {
  token: string;
  profile: OwnerProfile;
  onSaved: (profile: OwnerProfile) => void;
}

export function AddressEditor({ token, profile, onSaved }: Props) {
  const [form, setForm] = useState({
    addressLine1: profile.addressLine1 ?? '',
    addressLine2: profile.addressLine2 ?? '',
    city: profile.city ?? '',
    region: profile.region ?? '',
    countryCode: profile.countryCode ?? '',
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
      for (const key of ['addressLine1', 'addressLine2', 'city', 'region', 'countryCode'] as const) {
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
        Address
      </h2>
      <label htmlFor="addressLine1">Address line 1</label>
      <input id="addressLine1" type="text" {...field('addressLine1')} />
      <label htmlFor="addressLine2">Address line 2</label>
      <input id="addressLine2" type="text" {...field('addressLine2')} />
      <div className="field-grid">
        <div>
          <label htmlFor="city">City</label>
          <input id="city" type="text" {...field('city')} />
        </div>
        <div>
          <label htmlFor="region">Region</label>
          <input id="region" type="text" {...field('region')} />
        </div>
      </div>
      <label htmlFor="countryCode">Country code</label>
      <input id="countryCode" type="text" maxLength={2} {...field('countryCode')} />

      <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={saving}>
        {saving ? 'Saving…' : 'Save address'}
      </button>
      {saved && <p className="success-text">Saved.</p>}
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
