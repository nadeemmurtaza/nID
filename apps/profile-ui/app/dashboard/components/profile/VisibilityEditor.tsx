'use client';

import { useState } from 'react';
import { ApiError } from '../../../../lib/api';
import { updateProfile, type OwnerProfile } from '../../../../lib/owner-api';

interface Props {
  token: string;
  profile: OwnerProfile;
  onSaved: (profile: OwnerProfile) => void;
}

export function VisibilityEditor({ token, profile, onSaved }: Props) {
  const [toggles, setToggles] = useState({
    showPhone: profile.showPhone,
    showWhatsapp: profile.showWhatsapp,
    showEmail: profile.showEmail,
    showAddress: profile.showAddress,
    showBadges: profile.showBadges,
    showBooking: profile.showBooking,
    showOffers: profile.showOffers,
    showHours: profile.showHours,
    showRealName: profile.showRealName,
    isPublished: profile.isPublished,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
      const updated = await updateProfile(token, toggles);
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
        What&apos;s public
      </h2>
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
        <span>Show verified legal name (private by default)</span>
        <input type="checkbox" {...toggle('showRealName')} />
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

      <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={saving}>
        {saving ? 'Saving…' : 'Save visibility'}
      </button>
      {saved && <p className="success-text">Saved.</p>}
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
