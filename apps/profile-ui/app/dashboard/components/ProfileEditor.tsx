'use client';

import { useState } from 'react';
import { ApiError, apiUrl } from '../../../lib/api';
import { updateProfile, uploadPhoto, type OwnerProfile } from '../../../lib/owner-api';

interface Props {
  token: string;
  profile: OwnerProfile;
  onSaved: (profile: OwnerProfile) => void;
}

export function ProfileEditor({ token, profile, onSaved }: Props) {
  const [form, setForm] = useState({
    slug: profile.slug,
    displayName: profile.displayName,
    headline: profile.headline ?? '',
    category: profile.category,
    bio: profile.bio ?? '',
    phone: profile.phone ?? '',
    whatsapp: profile.whatsapp ?? '',
    publicEmail: profile.publicEmail ?? '',
    addressLine1: profile.addressLine1 ?? '',
    addressLine2: profile.addressLine2 ?? '',
    city: profile.city ?? '',
    region: profile.region ?? '',
    countryCode: profile.countryCode ?? '',
    timezone: profile.timezone,
  });
  const [toggles, setToggles] = useState({
    showPhone: profile.showPhone,
    showWhatsapp: profile.showWhatsapp,
    showEmail: profile.showEmail,
    showAddress: profile.showAddress,
    showBadges: profile.showBadges,
    showBooking: profile.showBooking,
    showOffers: profile.showOffers,
    showHours: profile.showHours,
    isPublished: profile.isPublished,
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

  function toggle(key: keyof typeof toggles) {
    return {
      checked: toggles[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setToggles((t) => ({ ...t, [key]: e.target.checked })),
    };
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      // An empty text input is "cleared", not "an empty string" — the API's
      // validators (e.g. @IsEmail on publicEmail) reject '' since
      // @IsOptional only skips null/undefined, so a blank optional field
      // must become undefined here for Prisma's own "field omitted" update
      // semantics to apply (owner-api.ts's ProfileInput comment).
      const OPTIONAL_TEXT_FIELDS = [
        'headline',
        'bio',
        'phone',
        'whatsapp',
        'publicEmail',
        'addressLine1',
        'addressLine2',
        'city',
        'region',
        'countryCode',
      ] as const;
      const sanitized = { ...form } as Record<string, string | undefined>;
      for (const key of OPTIONAL_TEXT_FIELDS) {
        if (sanitized[key] === '') {
          sanitized[key] = undefined;
        }
      }
      const updated = await updateProfile(token, { ...sanitized, ...toggles });
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
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
        <label className="small-btn" style={{ cursor: 'pointer' }}>
          {uploadingPhoto ? 'Uploading…' : 'Change photo'}
          <input type="file" accept="image/*" onChange={handlePhoto} disabled={uploadingPhoto} style={{ display: 'none' }} />
        </label>
      </div>

      <form onSubmit={handleSave}>
        <h2 className="section-title">Basics</h2>
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

        <h2 className="section-title">Contact</h2>
        <label htmlFor="phone">Phone</label>
        <input id="phone" type="tel" {...field('phone')} />
        <label htmlFor="whatsapp">WhatsApp</label>
        <input id="whatsapp" type="tel" {...field('whatsapp')} />
        <label htmlFor="publicEmail">Public email</label>
        <input id="publicEmail" type="email" {...field('publicEmail')} />

        <h2 className="section-title">Address</h2>
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

        <h2 className="section-title">What&apos;s public</h2>
        <div className="toggle-row">
          <span>Show phone</span>
          <input type="checkbox" {...toggle('showPhone')} />
        </div>
        <div className="toggle-row">
          <span>Show WhatsApp</span>
          <input type="checkbox" {...toggle('showWhatsapp')} />
        </div>
        <div className="toggle-row">
          <span>Show email</span>
          <input type="checkbox" {...toggle('showEmail')} />
        </div>
        <div className="toggle-row">
          <span>Show address</span>
          <input type="checkbox" {...toggle('showAddress')} />
        </div>
        <div className="toggle-row">
          <span>Show verified badges</span>
          <input type="checkbox" {...toggle('showBadges')} />
        </div>
        <div className="toggle-row">
          <span>Show booking</span>
          <input type="checkbox" {...toggle('showBooking')} />
        </div>
        <div className="toggle-row">
          <span>Show offers</span>
          <input type="checkbox" {...toggle('showOffers')} />
        </div>
        <div className="toggle-row">
          <span>Show hours</span>
          <input type="checkbox" {...toggle('showHours')} />
        </div>
        <div className="toggle-row">
          <span>
            <strong>Published</strong> (live at your URL)
          </span>
          <input type="checkbox" {...toggle('isPublished')} />
        </div>

        <button type="submit" style={{ marginTop: 16, width: '100%' }} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <p className="success-text">Saved.</p>}
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
